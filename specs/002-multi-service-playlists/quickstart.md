# Quickstart — Execução e Validação (002)

**Feature**: 002-multi-service-playlists

Guia de execução e cenários de validação. Não contém implementação — isso é `tasks.md`.

---

## 1. Pré-requisitos

- Node.js ≥ 22 (só para build e teste; o artefato final não roda Node)
- Uma conta Spotify **e/ou** uma conta Google — a feature funciona com apenas uma das duas

### Credencial do Spotify (inalterada em relação à 001)

1. <https://developer.spotify.com/dashboard> → **Create app**
2. Redirect URI: exatamente o valor que a tela de configuração exibe (`http://127.0.0.1:5173/` em desenvolvimento)
3. Copie o **Client ID**. O Client Secret **não** é usado e não deve ser colado em lugar nenhum.

### Credencial do YouTube (nova)

1. <https://console.cloud.google.com/> → criar projeto
2. **APIs & Services → Library → YouTube Data API v3 → Enable**
3. **OAuth consent screen**: tipo **External**; enquanto o app estiver em *Testing*, adicione a própria conta em **Test users** — sem isso a autorização falha, e a tela exibirá o aviso de app não verificado
4. **Credentials → Create credentials → OAuth client ID → Web application**
   - **Authorized JavaScript origins**: `http://127.0.0.1:5173`
   - **Authorized redirect URIs**: `http://127.0.0.1:5173/`
5. Copie o **Client ID**. O Client Secret **não** é usado.

> O escopo solicitado é apenas `https://www.googleapis.com/auth/youtube` (FR-045).

---

## 2. Executar

```bash
npm install
npm run dev          # http://127.0.0.1:5173  (IPv4 literal: 'localhost' é recusado)
npm run build && npm run preview
```

Portões locais, obrigatórios antes de commit (constituição):

```bash
npm run lint && npm run typecheck && npm test
npm run test:e2e     # antes de publicar mudança no assistente, autorização ou criação
```

---

## 3. Cenários de validação

Cada cenário cita o requisito que prova. Todos são executáveis sem tocar a rede real: os provedores são mockados por MSW (integração) e por Playwright (E2E).

### V1 — Credenciais opcionais e seletor (US1 · FR-001, FR-002, FR-009 a FR-011)

1. Abrir sem nenhuma credencial → tentar avançar ⇒ **bloqueado**, com explicação (FR-002).
2. Cadastrar só o Client ID do YouTube ⇒ YouTube habilitado e marcado; Spotify desabilitado, motivo visível e atalho para cadastrar (SC-002).
3. Cadastrar também o do Spotify ⇒ **os dois** marcados por padrão (SC-003).
4. Desmarcar um ⇒ avanço permitido com um destino. Desmarcar os dois ⇒ bloqueado (FR-011).
5. Remover a credencial do YouTube ⇒ destino desmarcado e desabilitado; credencial e seleção do Spotify **intactas** (FR-006).
6. Qualquer credencial exibida ⇒ mascarada por padrão (FR-003).

**Esperado**: ≤ 2 min do zero até o seletor com os dois Client IDs em mãos (SC-001).

### V2 — Fluxo só YouTube (US2 · FR-023 a FR-028)

1. Selecionar apenas YouTube, colar 50 linhas, informar nome e visibilidade.
2. **Antes de qualquer requisição de busca**, a estimativa de cota aparece com o consumo previsto e a fração do orçamento (SC-011).
3. Prosseguir ⇒ revisão mostra, por linha: título, **canal**, **duração** e miniatura. **Nenhum campo de álbum** (FR-024).
4. Candidato com indício de versão diferente ⇒ marcador visível; item nunca vem como `Confiante` (FR-025).
5. Confirmar ⇒ playlist criada; resultado traz link, total adicionado, total ignorado e não encontradas copiáveis em bloco (FR-041).
6. Repetir com o mesmo nome ⇒ **bloqueado**, exigindo nome diferente (FR-022).
7. O resultado informa o caminho efetivo e que pastas não são gerenciáveis (FR-027).

**Esperado**: ≥ 75% das 50 faixas de referência com correspondência `Confiante` correta (SC-006), medido por `tests/unit/scoring-youtube-reference.spec.ts`.

### V3 — Dois destinos em sequência (US3 · FR-013 a FR-022)

1. Selecionar os dois; informar texto, nome e visibilidade **uma vez** (FR-013).
2. O ciclo do Spotify começa; a tela mostra "Spotify — 1 de 2" em **todas** as telas do ciclo (FR-018).
3. Verificar que **nenhuma** requisição saiu para o YouTube até aqui (SC-005) — o teste falha se um handler do YouTube for tocado.
4. Concluído o Spotify, o ciclo do YouTube começa: autorização pedida só agora (FR-017), revisão obrigatória e independente (FR-019).
5. Corrigir a grafia de um artista na revisão do Spotify ⇒ a busca do YouTube usa o texto corrigido; **nenhuma escolha de candidata** é transferida (SC-013).
6. Ao final, resumo por serviço com estado, link, totais e não encontradas (FR-040).

**Esperado**: duas playlists, uma em cada conta, ordem original preservada, sem duplicatas (SC-004); processamento total ≤ 2 min (SC-015).

### V4 — Cota e expiração (US4 · FR-029 a FR-035)

1. Lista maior que o saldo ⇒ destino **bloqueado na estimativa**, antes de qualquer requisição; saídas: reduzir a lista e pular o destino; a mensagem declara que o cálculo parte do orçamento padrão (FR-029, SC-008).
2. Forçar `403 quotaExceeded` no meio da adição ⇒ execução encerrada em **uma** mensagem, sem repetição em laço, informando o que entrou e o que faltou (FR-031, SC-009); a playlist incompleta **não** é removida e o aviso de nome duplicado aparece (FR-032).
3. Expirar a sessão do YouTube durante a revisão ⇒ reautorização pedida, revisão **integralmente preservada**, retomada no mesmo ponto (FR-035).
4. Expirar no meio da adição ⇒ após reautorizar, continua de onde parou, sem faixa duplicada nem faltante (SC-010).
5. Fechar e reabrir com um serviço concluído e outro pendente ⇒ rascunho preservado, retomada oferece continuar apenas o pendente (SC-014).

### V5 — Rascunho legado (FR-042)

1. Gravar manualmente um `tp.v1.draft` no formato da 001 e recarregar.
2. **Esperado**: restaurado como fluxo de destino único com Spotify selecionado, na etapa em que parou, com o banner de recuperação de sempre — nenhum aviso adicional, nenhuma interpretação multi-serviço.

### V6 — Divergência de listas (FR-013, SC-018)

1. Concluir o Spotify com 50 linhas; reduzir para 30 antes do YouTube ⇒ permitido.
2. Tentar **acrescentar** ou **editar** uma linha nesse ponto ⇒ bloqueado (FR-013).
3. **Esperado**: resumo final declara a divergência com as contagens por serviço, e o relato do Spotify permanece idêntico ao exibido na conclusão dele (SC-018).

### V7 — Superfície fechada e privacidade (Princípio II)

```bash
npm test -- no-secrets          # tabela de hosts exata, por provedor, sem falta nem sobra
grep -ri "client_secret\|clientSecret" src/   # deve não retornar nada
```

Com o `dist/` servido, o painel de rede não deve mostrar **nenhuma** requisição fora de `api.spotify.com`, `i.scdn.co`, `www.googleapis.com` e `i.ytimg.com`; `accounts.spotify.com` e `accounts.google.com` aparecem como **navegação**, nunca como `fetch` (SC-017).

### V8 — Acessibilidade e telas estreitas (FR-047)

- `tests/a11y/` sem violação séria ou crítica nas telas novas: destinos, fila, estimativa, resumo.
- `e2e/narrow-viewport.spec.ts` estendido: fluxo completo com dois destinos em **375 px**, sem rolagem horizontal da página (SC-016).
- Todo texto novo vem de `src/i18n/pt-BR.ts` — `npm run lint` falha se algum literal escapar.

---

## 4. Mapa de verificação → requisito

| Verificação | Cobre |
| --- | --- |
| `tests/unit/quota.spec.ts` | FR-029, FR-030, SC-008 |
| `tests/unit/version-hints.spec.ts` | FR-025 |
| `tests/unit/scoring-youtube-reference.spec.ts` | FR-023, SC-006 |
| `tests/unit/run-machine.spec.ts` | FR-013 a FR-021, FR-040, SC-018 |
| `tests/unit/storage-migration.spec.ts` | FR-042 |
| `tests/unit/no-secrets.spec.ts` | FR-004, FR-044, Princípios II e IV |
| `tests/integration/youtube-quota.spec.ts` | FR-031, FR-032, SC-009 |
| `tests/integration/youtube-auth.spec.ts` | FR-035, SC-005 |
| `tests/integration/partial-failure.spec.ts` | FR-033, SC-010 |
| `tests/a11y/` | FR-047, SC-016 |
| `e2e/multi-destination.spec.ts` | FR-016 a FR-020, SC-004, SC-007, SC-012 |
