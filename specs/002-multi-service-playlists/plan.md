# Implementation Plan: Destinos Múltiplos — Spotify e YouTube

**Branch**: `002-multi-service-playlists` (checkout atual: `feat/youtube`) | **Data**: 2026-08-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-multi-service-playlists/spec.md`

## Summary

Generalizar o Importador de Playlist por Texto de um destino para **dois**, mantendo intactas as garantias da 001. O usuário cadastra o Client ID de cada serviço de forma independente e opcional, escolhe os destinos em um seletor de múltipla escolha, informa texto/nome/visibilidade **uma vez**, e o sistema executa o ciclo completo — autorizar, buscar, revisar, criar, resultado — de um serviço por vez, na ordem fixa Spotify → YouTube, terminando em um resumo consolidado.

**Abordagem técnica**: introduzir uma interface `PlaylistProvider` com dois adaptadores, transformando as diferenças entre provedores em **dados** (`capabilities`) em vez de ramificações espalhadas pela interface. O fluxo de FR-016 é escrito uma vez; Spotify e YouTube são configuração. O cliente HTTP genérico (401/429/5xx/`AbortSignal`) e o módulo de hosts sobem de `services/spotify/` para `services/providers/`, este último por exigência literal do Princípio II.

Três consequências da plataforma de vídeo governam o desenho e não têm contorno:

1. **A autorização do Google não é renovável em silêncio.** Verificado na Fase 0: o token endpoint recusa `authorization_code + PKCE` sem `client_secret` para clientes do tipo *Web application*. Sem backend — vedado pelo Princípio I — resta o *implicit flow*: token de ~1 hora, sem refresh. A reautorização explícita passa a ser comportamento previsto da interface, com o rascunho preservado integralmente (FR-035).
2. **Há orçamento diário de cota.** Uma lista de 50 linhas consome ≈ 7 556 das 10 000 unidades/dia. A estimativa vira gate de primeira classe: **bloqueia antes de qualquer requisição** o que não couber (FR-029), e o esgotamento durante a execução encerra o serviço sem repetir em laço (FR-031).
3. **O catálogo é de vídeos.** Não há álbum nem ISRC, e a mesma faixa aparece como clipe, áudio, ao vivo, cover e remix. A revisão mostra canal e duração, sinaliza indícios de versão diferente, e o limiar de `Confiante` é mais exigente (0,88 contra 0,82) — o erro caro é aceitar o cover, então ele é empurrado para o lado de pedir confirmação humana.

Duas garantias estruturais atravessam tudo: **o rascunho registra a seleção, a fila e o desfecho de cada serviço**, e o registro de um serviço concluído é imutável — uma redução de lista posterior nunca reescreve o relato de quem já terminou (SC-018); e **o índice de confirmação persistido passa de lotes para itens**, mantendo a retomada exata com `batchSize` 100 (Spotify) ou 1 (YouTube).

## Technical Context

**Language/Version**: TypeScript 5.x em modo `strict`, alvo ES2022 · Node.js ≥ 22 apenas para build e testes

**Primary Dependencies**: React 19 · Vite 7 · Tailwind CSS 4.3 · Zustand · **nenhuma dependência nova** — sem SDK do Google, sem biblioteca de fuso horário (`Intl` resolve a virada em Pacific Time), sem biblioteca de máquina de estados (a fila cabe em um redutor puro)

**Storage**: `localStorage` para credencial, sessão, rascunho e Registro de Consumo Diário, **com chave por provedor**; `sessionStorage` para o registro de autorização em voo. Esquema v2 com migração explícita da v1 em [contracts/storage.md](./contracts/storage.md)

**Testing**: Vitest + Testing Library + happy-dom · MSW (integração, **ambos** os provedores mockados) · Playwright (E2E, incluindo 375 px) · axe-core

**Target Platform**: navegadores modernos de desktop (2 últimas versões); telas estreitas suportadas em nível de usabilidade

**Project Type**: aplicação web estática de página única, sem backend — inalterado

**Performance Goals**: ≥ 2 linhas/s sustentadas por provedor (`001/FR-027`); 50 linhas nos **dois** destinos em ≤ 2 min somados, sem contar revisão humana (SC-015); estimativa em ≈ 45 s ([research §16](./research.md))

**Constraints**: nenhum servidor próprio (Princípio I, SC-017) · nenhum segredo de cliente de nenhum provedor (Princípio II) · superfície de rede fechada em 6 hosts, 3 por provedor · nenhuma requisição a provedor não selecionado (Princípio II, SC-005) · nenhuma escrita sem confirmação por serviço (Princípio V, FR-019) · orçamento diário de 10 000 unidades no YouTube, teto prático de ~66 linhas/dia · rascunho ≈ 800 KB no pior caso previsto (dois serviços), com degradação em três passos · toda a interface em pt-BR

**Scale/Scope**: 2 provedores · uma conta por provedor por navegador · caso de uso real ≤ 50 linhas · 5 etapas globais + 6 fases por serviço · 13 endpoints consumidos (8 Spotify + 5 YouTube)

## Constitution Check

_GATE: deve passar antes da Fase 0. Reavaliado após a Fase 1._

Constituição avaliada: **v1.1.0** (emendada em 2026-08-05 justamente para esta feature).

| Princípio / Seção | Exigência | Pré-Fase 0 | Pós-Fase 1 |
| --- | --- | --- | --- |
| **I. Sem Servidor Próprio** | artefato estático; fluxo sem segredo mesmo que desconfortável; reautorização explícita é comportamento previsto | ✅ | ✅ Implicit flow escolhido **porque** é o único sem backend; ausência de refresh vira estado de interface, não erro ([research §1](./research.md)) |
| **II. Superfície de rede fechada** | lista fechada por provedor, módulo único, escopo mínimo, nada a provedor não selecionado | ✅ tabela já emendada | ✅ `services/providers/hosts.ts` único; CSP espelhada; escopo `auth/youtube` isolado; adaptador só instanciado para provedor selecionado ([research §14](./research.md)) |
| **II. Nenhum segredo** | Client Secret nunca solicitado, aceito ou armazenado | ✅ | ✅ Nenhum tipo tem campo de segredo; o implicit flow sequer possui etapa que o usaria |
| **III. Domínio puro, I/O isolado** | regra de negócio em `src/domain/`, I/O em `src/services/` | ✅ | ✅ `quota/`, `versionHints/`, `run/` são puros com `now` injetado; adaptadores só traduzem formato ([contracts/provider-contract.md](./contracts/provider-contract.md) §3) |
| **IV. Invariante sem teste** | verificação executável para cada regra; hosts verificados provedor a provedor, falhando por falta **e** por sobra; nenhum teste toca a rede | ✅ | ✅ 11 verificações mapeadas ([research §15](./research.md)); `no-secrets.spec.ts` estendido para a tabela inteira |
| **V. Nenhuma escrita sem confirmação** | revisão obrigatória; retomada sem duplicar; rascunho apagado só após sucesso ou descarte explícito | ✅ | ⚠️ **Cumprido pelo plano**, com divergência na redação de FR-038 — ver abaixo |
| **Honestidade sobre limites** | não simular o que a API não oferece | ✅ | ✅ Sem YouTube Music, sem pastas, sem "não listada"; cota exposta como limite real |
| **Assimetria entre provedores** | expor a diferença onde ela muda o que o usuário pode fazer | ✅ | ✅ Estimativa de cota, aviso de reautorização e ausência de álbum aparecem **no contexto do YouTube**, não como aviso genérico |
| **Idioma / Acessibilidade** | pt-BR de `src/i18n/`; teclado, foco, axe-core, 375 px | ✅ | ✅ Telas novas cobertas em `tests/a11y/` e no E2E de viewport estreito |
| **Desempenho** | ≥ 2 linhas/s, `Retry-After` respeitado | ✅ | ✅ Limitador reaproveitado; `403 rateLimitExceeded` entra no mesmo caminho de backoff do `429` |
| **Simplicidade proporcional** | dependência nova exige justificativa escrita | ✅ | ✅ **Zero** dependências novas; três alternativas com biblioteca recusadas por escrito ([research §5, §12](./research.md)) |
| **Armazenamento** | chaves versionadas e tipadas, migração ou descarte seguro, isolamento por provedor | ✅ | ✅ Esquema v2, migração explícita e testada, uma chave por provedor ([contracts/storage.md](./contracts/storage.md) §4) |

**Veredito**: sem violação. O plano cumpre os cinco princípios, inclusive o V. **Complexity Tracking permanece vazio.**

O que existe é uma **divergência de redação entre a spec e a constituição**, herdada da emenda v1.1.0 e registrada como follow-up obrigatório por ela. Está detalhada abaixo; o plano segue a constituição, que prevalece por governança.

## Divergências internas da spec — **resolvidas**

> **Situação em 2026-08-05, após `/speckit-clarify`**: as três divergências abaixo foram corrigidas na spec, cada uma na direção que este plano já adotava. O texto é mantido por rastreabilidade — descreve o que estava errado e como ficou. **Nenhuma ação pendente.**
>
> | # | Resolução registrada na spec |
> | --- | --- |
> | D1 | FR-038 reescrito: rascunho apagado só após sucesso ou descarte explícito; encerramento por cota preserva, e a reabertura só oferece relato + descarte |
> | D2 | FR-029 e SC-008 alinhados: duas ações acionáveis + declaração da premissa, sem a saída "ampliar o orçamento" |
> | D3 | Cabeçalho corrigido para `002-multi-service-playlists` |
>
> A mesma sessão acrescentou três decisões que **não** eram divergências, e sim lacunas: sem segunda checagem de cota após a revisão (FR-029), redução de lista como ação opcional com dois pontos de entrada (FR-013), e aviso de amplitude do escopo na configuração do YouTube (FR-045). Todas já são compatíveis com este plano; ver "Ajustes absorvidos" ao final desta seção.

### D1 — FR-038 × Princípio V (rascunho apagado por encerramento de cota)

FR-038 manda apagar o rascunho "quando todos os serviços tiverem terminado — concluídos, pulados ou **encerrados**". Uma execução encerrada por esgotamento de cota é "encerrada", mas **não** é sucesso nem ação explícita de descarte — as duas únicas causas que o Princípio V admite para apagar trabalho em andamento.

A emenda v1.1.0 decidiu isso explicitamente: "a colisão foi resolvida **na spec, não na constituição**: a execução encerrada por cota preserva o rascunho até descarte explícito. O Princípio V permanece literal." A spec ainda não foi ajustada.

**Resolução adotada**: o plano preserva o rascunho após encerramento por cota (invariante W2 do [data-model](./data-model.md) e §3 de [contracts/storage.md](./contracts/storage.md)). **Ação requerida na spec**: reescrever FR-038 removendo "encerrados" da lista de causas de apagamento, e atualizar o gate constitucional no topo do documento — que ainda apresenta as opções (a)/(b) como abertas e declara a feature "bloqueada por emenda", quando a emenda já foi ratificada.

### D2 — FR-029 e FR-034 × SC-008, US4/AC1 e Edge Cases (saídas do bloqueio prévio)

FR-029 oferece **duas** saídas no bloqueio prévio (reduzir a lista, pular o destino). FR-034 é explícito: a orientação de ampliar o orçamento junto ao provedor **não deve** aparecer como saída do bloqueio prévio, "porque ampliar a cota no provedor não altera o saldo que a aplicação calcula" — já que o cálculo assume sempre o orçamento padrão. Mas SC-008, o cenário 1 de US4 e o caso de borda "cota insuficiente antes de começar" descrevem **três** saídas, incluindo ampliar o orçamento.

**Resolução adotada**: prevalece o par FR-029/FR-034, que é a regra mais específica e a única com justificativa registrada. A tela de bloqueio oferece **duas ações** — reduzir a lista (com o número de linhas que caberiam, calculado por `maxLinesThatFit`) e pular o destino — mais um **texto explicativo**, sem ação associada, esclarecendo que o cálculo parte do orçamento padrão do provedor e que ampliar a cota junto a ele não altera esse cálculo. **Ação requerida na spec**: reescrever SC-008 e o cenário 1 de US4 para "duas saídas acionáveis + declaração da premissa", ou alterar FR-034 se a intenção era mesmo oferecer as três.

### D3 — Metadado do cabeçalho da spec

O cabeçalho declarava `Feature Branch: main`; o trabalho está em `feat/youtube` e o diretório é `002-multi-service-playlists`. Sem efeito técnico. **Corrigido.**

### Ajustes absorvidos da sessão de clarificação

| Decisão | Efeito neste plano |
| --- | --- |
| **Sem segunda checagem de cota** após a revisão (FR-029) | Nenhum. A fase `estimate` do ciclo já era única e anterior à busca, e [research §3](./research.md) já calculava o custo nominal supondo **todas** as linhas confirmadas — o cenário de maior custo. A margem de 10% e o tratamento de esgotamento em execução seguem sendo a rede de proteção. |
| **Redução da lista como ação opcional**, alcançável do resultado do serviço anterior e da saída "reduzir a lista" do bloqueio por cota (FR-013) | Confirma a ausência de etapa nova no fluxo de FR-043. `QuotaEstimate.maxLinesThatFit` alimenta o segundo ponto de entrada; `isSubsetOf` valida o resultado nos dois casos. A tela entra em `features/input/` e na cobertura de acessibilidade de FR-047. |
| **Aviso de amplitude do escopo** na configuração do YouTube (FR-045) | Texto novo em `src/i18n/pt-BR.ts`, exibido por `features/credential/` no contexto do provedor. Reforça a seção "Assimetria entre provedores" do Constitution Check: a limitação é dita onde afeta, não diluída em nota genérica. |

## Project Structure

### Documentation (this feature)

```text
specs/002-multi-service-playlists/
├── plan.md                      # Este arquivo
├── spec.md                      # Especificação da feature
├── research.md                  # Fase 0 — 16 decisões técnicas
├── data-model.md                # Fase 1 — entidades, invariantes, rastreabilidade
├── quickstart.md                # Fase 1 — execução e 8 cenários de validação
├── contracts/                   # Fase 1
│   ├── provider-contract.md     #   interface PlaylistProvider (contrato interno)
│   ├── youtube-api.md           #   superfície consumida da YouTube Data API v3
│   ├── storage.md               #   esquema v2 por provedor + migração v1→v2
│   └── domain-api.md            #   assinaturas dos módulos puros novos e alterados
├── checklists/
│   └── requirements.md          # Qualidade da spec
└── tasks.md                     # Fase 2 — gerado por /speckit-tasks, NÃO por este comando
```

### Source Code (repository root)

Legenda: **[N]** novo · **[M]** movido · **[A]** alterado · sem marca = intocado.

```text
vite.config.ts                          [A] CSP: + googleapis, i.ytimg, accounts.google (form-action)

src/
├── app/
│   ├── Wizard.tsx                      [A] 5 etapas: Configuração → Destinos → Entrada → Serviço → Resumo
│   ├── StepIndicator.tsx               [A] fase do ciclo dentro da etapa "Serviço"
│   ├── DraftRecoveryBanner.tsx         [A] retomada por serviço e etapa (FR-039)
│   └── bootstrap.ts                    [A] dispara a migração v1→v2 antes de restaurar
├── features/
│   ├── credential/                     [A] um formulário por provedor; instruções, Redirect URI
│   │                                   #   e aviso de amplitude do escopo próprios (FR-045)
│   ├── destinations/                   [N] seletor de múltipla escolha (US1, FR-008 a FR-012)
│   ├── connect/                        [A] autorização por provedor; retorno por query ou fragmento
│   ├── input/                          [A] fonte única de linhas; ajuste opcional em modo
│   │                                   #   somente-remoção para destinos posteriores (FR-013)
│   ├── quota/                          [N] estimativa, bloqueio e relato de esgotamento (US4)
│   ├── queue/                          [N] "Spotify — 1 de 2" e navegação entre ciclos (FR-018)
│   ├── review/                         [A] canal/duração no lugar de álbum; indícios de versão
│   ├── result/                         [A] resultado por serviço; playlist incompleta por cota
│   └── summary/                        [N] resumo consolidado (US3, FR-040)
├── domain/                             # PURO — sem rede, sem DOM, sem relógio ambiente
│   ├── providers.ts                    [N] ProviderId, PROVIDER_ORDER, capacidades
│   ├── quota/                          [N] estimativa, saldo, dia do provedor (FR-029, FR-030)
│   ├── versionHints/                   [N] léxico + duração destoante (FR-025)
│   ├── run/                            [N] fila, ciclo, desfechos, resumo (FR-013 a FR-021, FR-040)
│   ├── scoring/thresholds.ts           [A] limiares por provedor; bônus de canal canônico
│   ├── batching/                       [A] partição por batchSize; índice em itens
│   ├── validation/                     [A] credencial mínima, seleção mínima, subconjunto
│   └── types.ts                        [A] ProviderSession, ServiceRun, WorkDraft v2
├── services/
│   ├── providers/
│   │   ├── types.ts                    [N] interface PlaylistProvider
│   │   ├── registry.ts                 [N] ordem fixa Spotify → YouTube (FR-015)
│   │   ├── hosts.ts                    [M] de services/spotify/hosts.ts — tabela por provedor
│   │   ├── http.ts                     [M] de services/spotify/client.ts — genérico por provedor
│   │   ├── spotify/                    [M] auth, search, playlists, errors
│   │   └── youtube/                    [N] auth (implicit), search, videos, playlists, quota, errors
│   ├── rate-limiter.ts                 [A] uma instância por provedor
│   └── storage/                        [A] repositórios por provedor + migrations.ts [N]
├── store/                              [A] destinationsSlice [N], runSlice [N];
│                                       #   credential e session passam a ser por provedor
├── i18n/pt-BR.ts                       [A] textos por serviço, estimativa, fila, resumo
└── ui/                                 [A] marcador de indício de versão

tests/
├── unit/                               [A] + quota, version-hints, run-machine,
│                                       #     storage-migration, scoring-youtube-reference
├── integration/                        [A] + youtube-auth, youtube-quota; partial-failure estendido
├── fixtures/reference-50-youtube.json  [N] fixture que valida SC-006
└── a11y/                               [A] + destinos, fila, estimativa, resumo

e2e/
└── multi-destination.spec.ts           [N] fluxo completo com dois destinos, ambos mockados
```

**Structure Decision**: projeto único na raiz, sem backend — inalterado e reafirmado pelo Princípio I. A mudança estrutural da feature é a introdução de `src/services/providers/`, que substitui `src/services/spotify/` como fronteira de I/O. Não é reorganização estética: o Princípio II exige que a lista de hosts viva em **um único módulo**, e um segundo provedor sob `services/spotify/` seria contradição literal. `src/domain/` cresce com três módulos puros (`quota`, `versionHints`, `run`) que concentram as regras novas de maior consequência — o que mantém a maior parte do esforço de teste fora do navegador, como o Princípio III pede. `src/features/` ganha quatro diretórios que mapeiam um a um às User Stories: `destinations` (US1), `quota` (US4), `queue` e `summary` (US3), preservando a possibilidade de entregar as histórias em fatias verticais independentes.

## Complexity Tracking

> Preenchido apenas se o Constitution Check tiver violações a justificar.

Sem violações. Nenhuma entrada.

A abstração `PlaylistProvider` acrescenta uma camada de indireção que não existia. Não é exceção a princípio e por isso não entra nesta tabela, mas a justificativa fica registrada em [research §10](./research.md): sem ela, cada tela e cada runner precisaria ramificar por `ProviderId`, e FR-016 — que descreve **um** ciclo aplicado a cada serviço — viraria dois fluxos paralelos destinados a divergir.
