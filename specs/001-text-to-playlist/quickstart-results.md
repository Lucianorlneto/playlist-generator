# Execução dos cenários do quickstart (T104)

**Feature**: `001-text-to-playlist` | **Data**: 2026-08-05

Registro da execução dos cenários A a I de [quickstart.md](./quickstart.md) e dos
desvios encontrados.

## Como cada cenário foi exercitado

Todos os cenários foram executados **com o Spotify simulado** — as rotas do
Playwright em `e2e/support/spotify-mock.ts` cobrem exatamente os endpoints de
[contracts/spotify-api.md](./contracts/spotify-api.md), incluindo o retorno do
consentimento com validação de `state`.

**Limite desta execução**: nenhum cenário foi rodado contra uma conta Spotify
real, porque não há Client ID nem conta disponível neste ambiente. O que a
simulação **não** prova está na última seção — são as verificações que dependem
do comportamento do serviço real e que precisam ser feitas por uma pessoa com
conta.

## Resultado por cenário

| Cenário | Cobertura automatizada | Situação |
| --- | --- | --- |
| **A** — Credencial e conexão (US1, SC-004) | `e2e/connect.spec.ts` (3 testes) · `tests/components/credential-form.spec.tsx` (8) | ✅ passa |
| **B** — Colar, analisar e revisar (US2, SC-002, SC-003) | `tests/unit/parser.spec.ts` (12) · `tests/unit/normalize.spec.ts` (10) · `tests/components/review.spec.tsx` (9) · `tests/unit/scoring-reference.spec.ts` (3) | ✅ passa |
| **C** — Re-busca por linha (FR-017) | `tests/components/review.spec.tsx` — "editar uma linha só busca de novo na confirmação" e "a re-busca de uma linha não altera as demais" | ✅ passa |
| **D** — Criar a playlist (US3, SC-007) | `e2e/create-playlist.spec.ts` (4) · `tests/unit/validation.spec.ts` (14) · `tests/integration/playlists.spec.ts` (8) | ✅ passa |
| **E** — Rascunho e recuperação (US4, SC-006) | `e2e/draft-recovery.spec.ts` (3) · `tests/integration/draft-recovery.spec.ts` (6) | ✅ passa |
| **F** — Volume, vazão e cancelamento (SC-005, SC-010, SC-011) | `tests/unit/throughput.spec.ts` (4) · `tests/unit/rate-limiter.spec.ts` (10) · `e2e/keyboard.spec.ts` — cancelamento durante a busca | ✅ passa (relógio simulado) |
| **G** — Telas estreitas e teclado (SC-012, FR-046) | `e2e/narrow-viewport.spec.ts` (2) · `e2e/keyboard.spec.ts` (4) · `tests/a11y/steps.spec.tsx` (5) | ✅ passa |
| **H** — Falha parcial na adição (SC-009) | `tests/integration/partial-failure.spec.ts` (6) · `e2e/create-playlist.spec.ts` — retomada | ✅ passa |
| **I** — Erros acionáveis (US4, FR-042) | `tests/integration/auth-exchange.spec.ts` (9) · `tests/integration/auth-refresh.spec.ts` (9) · `tests/integration/session-recovery.spec.ts` (4) | ✅ passa |

Checagens de segurança e privacidade do quickstart:

| Checagem | Como foi verificada | Situação |
| --- | --- | --- |
| Nenhuma requisição fora dos três hosts | `e2e/create-playlist.spec.ts` registra todas as origens do fluxo completo e falha se alguma escapar | ✅ |
| Apenas as chaves previstas no armazenamento local | `tests/unit/storage.spec.ts` (16 testes sobre os 5 invariantes) | ✅ |
| `tp.v1.pkce` só existe entre conectar e voltar | `tests/unit/storage.spec.ts` — "takePkce lê e destrói o registro na mesma operação" | ✅ |
| Nenhuma credencial em texto claro sem revelar | `tests/components/credential-form.spec.tsx` · `e2e/connect.spec.ts` | ✅ |
| `grep -ri "client_secret\|clientSecret" src/` sem resultado | `tests/unit/no-secrets.spec.ts` faz a varredura como teste | ✅ |

Validação de SC-008 (hospedagem estática): `npm run build` seguido de
`npx serve dist -l 8080`, com a suíte E2E apontada para lá por
`E2E_BASE_URL=http://127.0.0.1:8080` — **16 de 16 testes passam contra o
`dist/` servido como arquivos estáticos**, com a CSP de produção ativa.

## Desvios encontrados e corrigidos

1. **`style` inline seria bloqueado pela CSP de produção.** A barra de progresso
   da busca usava `style={{ width: … }}`. Como a CSP do build declara
   `style-src 'self'`, atributos `style` inline também são bloqueados — a barra
   simplesmente não encheria em produção, e a falha não aparece em
   desenvolvimento (onde não há CSP). Trocada pelo elemento `<progress>` nativo.

2. **Persistência do rascunho morria sob `StrictMode`.** A inicialização fazia o
   trabalho de uma vez só atrás de uma guarda e devolvia a limpeza no mesmo
   efeito. No ciclo montar → desmontar → montar do StrictMode, a limpeza
   desligava a persistência e a segunda montagem caía na guarda sem religá-la:
   o rascunho parava de ser gravado, em silêncio. As assinaturas foram movidas
   para efeitos próprios, com par montar/desmontar simétrico.

3. **O Prettier reescrevia os documentos de especificação.** A formatação
   automática trocava os marcadores `- [X]` de `tasks.md` por `- [x]` e refluía
   tabelas. `specs/` entrou no `.prettierignore`.

Nenhum desvio permaneceu em aberto.

## O que ainda precisa de uma conta real

Estes pontos dependem do comportamento do serviço do Spotify e **não** foram
executados aqui:

- **Cenário A.5 com consentimento real**: o redirecionamento a
  `accounts.spotify.com` e a volta com um `code` legítimo. A simulação valida o
  fluxo e a checagem de `state`, mas não a aceitação do Redirect URI cadastrado.
- **Cenário B/SC-002 com o catálogo real**: a taxa de ≥ 90% de Confiantes
  corretas é verificada contra `tests/fixtures/reference-50.json` com candidatas
  sintéticas (versão certa, karaokê, tributo e outra faixa do mesmo artista).
  A distribuição real de resultados da busca pode diferir; se diferir, os
  limiares em `src/domain/scoring/thresholds.ts` são o único ponto a ajustar.
- **Cenário F com latência real**: a vazão foi medida com relógio simulado e
  latência de 400 ms por busca (o topo da faixa típica de [research §4](./research.md)).
  O tempo de parede com 250 linhas depende da rede e da cota da conta.
- **Cenário I com um app em modo de desenvolvimento**: `access_denied` por conta
  fora da lista de usuários permitidos é tratado e tem mensagem própria, mas só
  uma conta real reproduz a condição.
