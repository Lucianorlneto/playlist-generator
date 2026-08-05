---
description: 'Lista de tarefas — Importador de Playlist por Texto (Text-to-Playlist)'
---

# Tasks: Importador de Playlist por Texto (Text-to-Playlist)

**Input**: Documentos de design em `/specs/001-text-to-playlist/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: **incluídos**. O plano fixa uma stack de testes (Vitest + MSW + Playwright + axe-core) e três critérios de sucesso da spec só são verificáveis por teste automatizado — SC-002 (dataset de referência), SC-009 (falha parcial sem duplicar) e SC-012 (375 px). Os testes de domínio puro carregam a maior parte das regras da spec.

**Organization**: tarefas agrupadas por user story, para permitir implementação e validação independentes.

## Format: `[ID] [P?] [Story] Descrição`

- **[P]**: pode rodar em paralelo (arquivos distintos, sem dependência pendente)
- **[Story]**: user story correspondente (US1, US2, US3, US4)
- Todo caminho de arquivo é relativo à raiz do repositório

## Path Conventions

Projeto único na raiz: `src/`, `tests/`, `e2e/`. Sem backend — ver Structure Decision em [plan.md](./plan.md).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: inicialização do projeto e configuração de ferramental

- [X] T001 Criar `package.json` na raiz com React 19, Vite 7, TypeScript 5, Zustand, `tailwindcss@4.3` e `@tailwindcss/vite`, e os scripts `dev`, `build`, `preview`, `test`, `test:coverage`, `test:e2e`, `lint`, `typecheck`
- [X] T002 [P] Criar `tsconfig.json` com `strict: true`, `target: ES2022`, `noUncheckedIndexedAccess` e alias `@/` para `src/`
- [X] T003 Criar `vite.config.ts` com o plugin `@tailwindcss/vite`, `server.host = '127.0.0.1'`, `server.port = 5173` e `base: './'` — o host literal é exigência do Redirect URI (research §2) e o `base` relativo é o que permite servir de subdiretório em hospedagem estática
- [X] T004 Criar `index.html` com `lang="pt-BR"` e injetar a meta CSP **apenas no build** (plugin `transformIndexHtml` em `vite.config.ts`), permitindo conexão a `accounts.spotify.com`, `api.spotify.com` e `i.scdn.co` com `style-src 'self'` — o dev server do Vite injeta CSS inline e exigiria afrouxar a política, o que não pode vazar para produção (research §8)
- [X] T005 [P] Configurar ESLint + Prettier em `eslint.config.js` e `.prettierrc` com `prettier-plugin-tailwindcss`, adicionando duas regras: proibir literais de texto de UI fora de `src/i18n/` e proibir `className` construído por template literal ou concatenação — classes montadas em tempo de execução não são emitidas pelo Tailwind (research §14)
- [X] T006 [P] Criar `vitest.config.ts` com ambiente happy-dom e `tests/setup.ts` registrando Testing Library e o servidor MSW
- [X] T007 [P] Criar `playwright.config.ts` com projeto desktop e projeto de viewport 375×667
- [X] T008 [P] Criar a árvore de diretórios de `src/` conforme plan.md, com `src/main.tsx` e `src/styles/index.css` contendo `@import "tailwindcss"` e o bloco `@theme` com os tokens do produto — incluindo as cores dos três status de correspondência (`confident`, `uncertain`, `not-found`). Sem `tailwind.config.js`: a configuração é CSS-first (research §14)
- [X] T009 [P] Criar `src/i18n/pt-BR.ts` exportando objeto congelado com as chaves de texto das 4 etapas (FR-048)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: infraestrutura compartilhada que toda user story consome

**⚠️ CRITICAL**: nenhuma user story pode começar antes desta fase terminar

- [X] T010 [P] Definir todas as entidades de [data-model.md](./data-model.md) como tipos discriminados em `src/domain/types.ts` (`Credential`, `Session`, `SpotifyUser`, `InputLine`, `TrackCandidate`, `MatchItem`, `MatchStatus`, `PlaylistConfig`, `WorkDraft`, `CreationProgress`, `CreationResult`, `WizardStep`)
- [X] T011 [P] Implementar leitura/gravação versionada em `src/services/storage/schema.ts` — valida a forma, descarta conteúdo corrompido ou de `schemaVersion` desconhecida com aviso, nunca lança ([contracts/storage.md](./contracts/storage.md))
- [X] T012 Implementar `src/services/storage/credentialRepo.ts` sobre `localStorage` chave `tp.v1.credential` (depende de T011)
- [X] T013 Implementar `src/services/storage/sessionRepo.ts` sobre `tp.v1.session`, garantindo que limpar a sessão não toque em credencial nem rascunho (depende de T011)
- [X] T014 Implementar `src/services/storage/draftRepo.ts` sobre `tp.v1.draft` com a degradação em dois passos para `QuotaExceededError` (research §8) (depende de T011)
- [X] T015 Implementar `src/services/storage/pkceRepo.ts` sobre `sessionStorage` chave `tp.v1.pkce`, destruindo o registro assim que o `code` é consumido (depende de T011)
- [X] T016 [P] Implementar `src/services/rate-limiter.ts`: token bucket de 5 req/s com rajada 10, pool de concorrência 4 e `AbortSignal` que interrompe **inclusive durante a espera de backoff** (research §4, FR-026)
- [X] T017 [P] Criar `src/services/spotify/errors.ts` mapeando cada falha de [contracts/spotify-api.md](./contracts/spotify-api.md) para `{ causaProvável, próximoPasso }` em pt-BR (FR-042)
- [X] T018 Implementar `src/services/spotify/client.ts`: wrapper de `fetch` com `Authorization: Bearer`, renovação em `401` (uma tentativa, promessa coalescida), espera por `Retry-After` em `429`, backoff exponencial em `5xx` com teto de 3 tentativas e propagação de `AbortSignal` (depende de T016, T017)
- [X] T019 [P] Criar `tests/msw/handlers.ts` e `tests/msw/server.ts` cobrindo os 8 endpoints de [contracts/spotify-api.md](./contracts/spotify-api.md), com cenários de `401`, `429` (com e sem `Retry-After`), `5xx` e paginação
- [X] T020 [P] Criar os slices Zustand em `src/store/` (`wizardSlice`, `credentialSlice`, `sessionSlice`, `itemsSlice`, `playlistConfigSlice`) sobre os tipos de T010
- [X] T021 Implementar `src/store/draftPersistence.ts` — middleware `persist` com `partialize` que grava apenas os campos de `WorkDraft`, debounce de 500 ms, e **gravação síncrona sem debounce** para `creation.committedBatches` (depende de T014, T020)
- [X] T022 [P] Criar primitivos acessíveis em `src/ui/` (`Button`, `TextField`, `TextArea`, `Toggle`, `CopyButton`, `LiveRegion`, `StepHeading`) sobre elementos nativos, estilizados com utilitários Tailwind, com rótulos e `aria-describedby` (FR-046). Variantes resolvidas por **mapa explícito de literais** (`const variants = { primary: 'bg-… ', danger: '…' }`), nunca por concatenação; recorrências que aparecerem em 3+ lugares viram `@utility` em `src/styles/index.css` (research §14)
- [X] T023 Implementar `src/app/App.tsx` e `src/app/Wizard.tsx` com o fluxo linear de 4 etapas e movimentação de foco para o cabeçalho a cada transição (FR-041, FR-046) (depende de T020, T022)
- [X] T024 Escrever `tests/unit/storage.spec.ts` verificando os 5 invariantes de [contracts/storage.md](./contracts/storage.md) — inclusive que nenhuma chave contém segredo de cliente e que o rascunho nunca contém token (depende de T012–T015)

**Checkpoint**: infraestrutura pronta — as user stories podem começar

---

## Phase 3: User Story 1 — Configurar credencial e conectar a conta (Priority: P1) 🎯 MVP

**Goal**: o usuário informa o Client ID na interface, autoriza a conta e vê o nome conectado, sem tocar em arquivo de configuração.

**Independent Test**: abrir o app sem credencial salva, colar um Client ID válido, salvar, autorizar no Spotify, retornar e ver o nome de exibição da conta.

### Tests for User Story 1

- [X] T025 [P] [US1] `tests/unit/pkce.spec.ts` — `code_verifier` aleatório, `code_challenge` = base64url(SHA-256), `state` de 32 bytes
- [X] T026 [P] [US1] `tests/unit/redirect-uri.spec.ts` — cálculo de `origin + BASE_URL` em raiz e em subdiretório
- [X] T027 [P] [US1] `tests/integration/auth-exchange.spec.ts` — troca de código via MSW: corpo `form-urlencoded`, **sem** header `Authorization`, `state` divergente descarta o código
- [X] T028 [P] [US1] `tests/integration/auth-refresh.spec.ts` — renovação com e sem novo `refresh_token`; 4 chamadas concorrentes disparam **uma única** renovação
- [X] T029 [P] [US1] `tests/components/credential-form.spec.tsx` — campo vazio na primeira abertura, valor mascarado após salvar, alternância revelar/ocultar com `aria-pressed`, ação de remover
- [X] T030 [P] [US1] `e2e/connect.spec.ts` — fluxo de conexão ponta a ponta com Spotify mockado, verificando que a URL fica sem `?code=` no retorno

### Implementation for User Story 1

- [X] T031 [P] [US1] Implementar `src/services/spotify/pkce.ts` (geração de verifier, challenge S256 via `crypto.subtle`, state)
- [X] T032 [P] [US1] Implementar `src/features/credential/redirectUri.ts` calculando o Redirect URI em tempo de execução — nunca hardcoded (research §2)
- [X] T033 [US1] Implementar `src/services/spotify/auth.ts` — `buildAuthorizeUrl` com os 3 escopos mínimos, `exchangeCode`, `refreshSession` com coalescência de chamadas (depende de T031, T018)
- [X] T034 [US1] Implementar `src/features/connect/callback.ts` — detecta `?code=`/`?error=` na carga, valida `state`, consome o PKCE e limpa a query com `history.replaceState` (depende de T033, T015)
- [X] T035 [US1] Implementar `src/services/spotify/profile.ts` — `GET /v1/me` extraindo `id` e `displayName` com fallback para `id` quando o nome vier vazio (depende de T018)
- [X] T036 [US1] Implementar `src/features/credential/CredentialForm.tsx` — campo, salvar, aviso não bloqueante para formato divergente (depende de T012, T022)
- [X] T037 [US1] Implementar `src/features/credential/MaskedValue.tsx` — máscara com últimos 4 caracteres e botão revelar/ocultar com rótulo dinâmico (FR-003, FR-046)
- [X] T038 [US1] Implementar `src/features/credential/RedirectUriHint.tsx` — instruções de obtenção do Client ID e o Redirect URI exato com botão de copiar, incluindo o aviso de que `localhost` não é aceito (FR-011)
- [X] T039 [US1] Implementar `src/features/credential/RemoveCredential.tsx` — ação explícita e separada de "Desconectar" (FR-004)
- [X] T040 [US1] Implementar `src/features/connect/ConnectButton.tsx` e `src/features/connect/SessionHeader.tsx` — nome de exibição sempre visível e ação de desconectar que preserva credencial e rascunho (FR-009)
- [X] T041 [US1] Ligar os erros de autorização de T017 à interface em `src/features/connect/AuthError.tsx`, cobrindo `invalid_client`, `redirect_uri_mismatch` e `access_denied` — este último citando a lista de usuários permitidos de apps em modo de desenvolvimento (US4 cenário 4)
- [X] T042 [US1] Integrar a etapa Credencial ao Wizard em `src/app/Wizard.tsx` e persistir a sessão via `src/services/storage/sessionRepo.ts` (depende de T023, T013)

**Checkpoint**: US1 funcional e testável isoladamente — o usuário conecta e vê a conta

---

## Phase 4: User Story 2 — Colar a lista e obter correspondências (Priority: P1)

**Goal**: transformar o texto colado em faixas identificadas, com status revisável e alternativas.

**Independent Test**: colar 10 linhas, acionar a busca e ver a tabela linha original → faixa encontrada com título, artista, álbum, duração, capa e status.

### Tests for User Story 2

- [X] T043 [P] [US2] `tests/unit/parser.spec.ts` — os 4 separadores, prefixos de numeração, **último** separador delimitando o artista, extração de `feat.`, linhas em branco descartadas, linha sem separador vira `unparsed` sem interromper as demais
- [X] T044 [P] [US2] `tests/unit/normalize.spec.ts` — acentos, caixa, sufixos promocionais removidos; `remix`, `live`/`ao vivo`, `acoustic` e `remaster` **preservados** (research §6)
- [X] T045 [P] [US2] `tests/unit/scoring.spec.ts` — casos de fronteira dos limiares, incluindo título idêntico com artista errado (deve ficar abaixo de 0,82)
- [X] T046 [P] [US2] Criar `tests/fixtures/reference-50.json` (50 faixas populares bem formatadas com a faixa esperada) e `tests/unit/scoring-reference.spec.ts` verificando ≥ 90% de Confiantes corretas (SC-002)
- [X] T047 [P] [US2] `tests/unit/dedupe.spec.ts` — duplicata por chave normalizada e por `selectedUri`; primeira ocorrência intacta, ordem preservada
- [X] T048 [P] [US2] `tests/unit/rate-limiter.spec.ts` — vazão sustentada ≥ 2/s com relógio falso, respeito ao `Retry-After`, cancelamento **durante** a espera (SC-010, SC-011)
- [X] T049 [P] [US2] `tests/integration/search.spec.ts` — busca por campos, fallback de texto livre em zero resultados, `429` com espera, falha de uma linha não aborta as demais
- [X] T050 [P] [US2] `tests/components/review.spec.tsx` — status exibidos, Confiantes marcadas e Incertas desmarcadas por padrão, até 5 alternativas, edição de linha que só rebusca ao confirmar

### Implementation for User Story 2

- [X] T051 [P] [US2] Implementar `src/domain/normalize/index.ts` — pipeline NFD + diacríticos + minúsculas pt-BR + sufixos promocionais + colapso de pontuação
- [X] T052 [P] [US2] Implementar `src/domain/parser/index.ts` com `parseInput` e `parseLine` (FR-012 a FR-015)
- [X] T053 [US2] Implementar `src/domain/scoring/thresholds.ts` (0,82 / 0,55) e `src/domain/scoring/index.ts` com `scoreCandidate` e `classify` (depende de T051)
- [X] T054 [US2] Implementar `src/domain/dedupe/index.ts` com as duas passagens (depende de T051)
- [X] T055 [US2] Implementar `src/services/spotify/search.ts` — `q=track:"…" artist:"…"`, `limit=5`, sem `market`, fallback de texto livre único (depende de T018)
- [X] T056 [US2] Implementar `src/features/input/InputScreen.tsx` — área de texto, contagem de linhas, botão desabilitado com texto vazio e aviso de duração acima de 500 linhas
- [X] T057 [US2] Implementar `src/features/input/matchRunner.ts` — orquestra busca + pontuação + deduplicação pelo limitador, emitindo progresso e aceitando `AbortController` (depende de T016, T053, T054, T055)
- [X] T058 [US2] Implementar `src/features/review/ReviewScreen.tsx` — lista ordenada por `line.index`, nunca reordenada (FR-019)
- [X] T059 [US2] Implementar `src/features/review/MatchRow.tsx` — título, artista, álbum, duração `m:ss`, capa, status e seleção
- [X] T060 [US2] Implementar `src/features/review/Alternatives.tsx` — até 5 candidatas, trocar a escolhida ou descartar o item (FR-023, FR-024)
- [X] T061 [US2] Implementar `src/features/review/LineEditor.tsx` — rebusca apenas da linha editada, disparada em Enter ou blur, preservando o estado de todas as demais (FR-017)
- [X] T062 [US2] Implementar `src/features/review/SearchProgress.tsx` — barra com região `aria-live`, contagem textual, estado "aguardando limite" e botão de cancelar sempre alcançável (FR-026, SC-011)
- [X] T063 [US2] Adicionar os selos de duplicata e de "formato não reconhecido" em `src/features/review/StatusBadge.tsx`, com ação de correção inline e mapa explícito de `MatchStatus` → classes literais (FR-015, FR-018)
- [X] T064 [US2] Integrar as etapas Entrada e Revisão ao Wizard em `src/app/Wizard.tsx` e gravar `rawText` e `items` no rascunho via `src/store/draftPersistence.ts` (depende de T021, T023)

**Checkpoint**: US1 e US2 funcionam de forma independente — texto vira correspondências revisáveis, sem escrever nada na conta

---

## Phase 5: User Story 3 — Criar a playlist e ver o resultado (Priority: P1)

**Goal**: nomear, confirmar, criar e receber link, caminho efetivo e resumo de sucessos e falhas.

**Independent Test**: com correspondências revisadas e nome preenchido, acionar a criação e receber link, caminho e resumo.

### Tests for User Story 3

- [X] T065 [P] [US3] `tests/unit/validation.spec.ts` — nome vazio, nome só com espaços, nome duplicado variando caixa e espaços de borda, nenhuma faixa selecionada (FR-028, FR-029, FR-035)
- [X] T066 [P] [US3] `tests/unit/batching.spec.ts` — ordem preservada, particionamento em 100, `remainingBatches` nunca reenvia lote confirmado
- [X] T067 [P] [US3] `tests/integration/playlists.spec.ts` — paginação de `/me/playlists` até `next === null`, filtro por `owner.id`, criação e adição em lotes
- [X] T068 [P] [US3] `tests/integration/partial-failure.spec.ts` — falha no 2º de 3 lotes; a retomada completa a playlist **sem duplicatas nem faltantes** e sem criar segunda playlist (SC-009)
- [X] T069 [P] [US3] `e2e/create-playlist.spec.ts` — fluxo completo até a tela de resultado, verificando caminho efetivo e aviso de pastas

### Implementation for User Story 3

- [X] T070 [P] [US3] Implementar `src/domain/validation/index.ts` com `validatePlaylistName` e `canCreate` aplicando as 4 regras na ordem de [data-model.md](./data-model.md)
- [X] T071 [P] [US3] Implementar `src/domain/batching/index.ts` com `buildOrderedUris`, `chunk` e `remainingBatches`
- [X] T072 [US3] Implementar `src/services/spotify/playlists.ts` — `listMyPlaylists` paginado, `createPlaylist`, `addTracks` em lotes de 100 (depende de T018)
- [X] T073 [P] [US3] Implementar `src/features/result/effectivePath.ts` — `Sua Biblioteca / {displayName} / {name}` (FR-036)
- [X] T074 [US3] Implementar `src/features/review/PlaylistConfigForm.tsx` — nome obrigatório, descrição opcional, alternância privada (padrão) / pública (FR-030)
- [X] T075 [US3] Implementar `src/features/review/nameCheck.ts` — consulta de nomes existentes, bloqueio com pedido de outro nome e bloqueio com opção de repetir quando a **consulta** falha (FR-029) (depende de T070, T072)
- [X] T076 [US3] Implementar `src/features/result/creationRunner.ts` — cria a playlist, envia lotes em série, incrementa e grava `committedBatches` de forma síncrona após cada confirmação (FR-032, FR-033) (depende de T071, T072, T021)
- [X] T077 [US3] Implementar `src/features/result/ResultScreen.tsx` — nome, total adicionado, total ignorado, link direto e caminho efetivo (FR-039)
- [X] T078 [P] [US3] Implementar `src/features/result/FolderNotice.tsx` — aviso de que a plataforma não permite criar playlist dentro de pastas (FR-037, SC-007)
- [X] T079 [US3] Implementar `src/features/result/FailedLines.tsx` — lista das linhas não encontradas na ordem original com botão de copiar em bloco (FR-040)
- [X] T080 [US3] Implementar `src/features/result/RetryRemaining.tsx` — "tentar novamente" apenas para os lotes restantes (FR-033)
- [X] T081 [US3] Apagar o rascunho em `src/services/storage/draftRepo.ts` após criação bem-sucedida e integrar a etapa Resultado ao Wizard em `src/app/Wizard.tsx` (FR-045) (depende de T014, T023)

**Checkpoint**: as três user stories P1 estão completas — o produto entrega valor ponta a ponta

---

## Phase 6: User Story 4 — Recuperação de erros e limites (Priority: P2)

**Goal**: sessão expirada, limitação de requisições e recarga não fazem o usuário perder trabalho.

**Independent Test**: simular sessão expirada e resposta de limitação durante a busca; verificar que o app se recupera e conclui sem perder o estado.

### Tests for User Story 4

- [X] T082 [P] [US4] `tests/integration/session-recovery.spec.ts` — `401` no meio da busca renova e repete sem perder o texto digitado (US4 cenário 1)
- [X] T083 [P] [US4] `tests/integration/draft-recovery.spec.ts` — falha de renovação limpa a sessão e **preserva** texto, nome e correspondências revisadas (SC-006)
- [X] T084 [P] [US4] `e2e/draft-recovery.spec.ts` — recarga da página no meio da revisão retoma na mesma etapa com as escolhas manuais intactas

### Implementation for User Story 4

- [X] T085 [US4] Implementar `src/app/DraftRecoveryBanner.tsx` — informa o trabalho recuperado com a data e oferece continuar ou descartar (FR-044)
- [X] T086 [US4] Implementar a restauração de etapa e estado a partir de `WorkDraft` na inicialização do store em `src/store/restoreDraft.ts` (FR-043, FR-044) (depende de T021)
- [X] T087 [US4] Tratar falha de renovação em `src/features/connect/reconnect.ts`: limpar sessão, pedir reconexão e restaurar a etapa exata após o retorno do consentimento (US4 cenário 2)
- [X] T088 [US4] Implementar `src/ui/RateLimitWaiting.tsx` — estado de espera por limitação com cancelamento ativo, usado na busca e na criação (FR-034, SC-011)
- [X] T089 [US4] Implementar `src/services/spotify/offline.ts` — detecção de perda de conexão com mensagem clara e repetição sem recomeçar o fluxo (US4 cenário 5)
- [X] T090 [US4] Completar o catálogo de mensagens acionáveis em `src/i18n/pt-BR.ts`, cada uma com causa provável e próximo passo (FR-042)
- [X] T091 [US4] Exibir o Redirect URI exato com botão de copiar dentro da mensagem de falha de autorização em `src/features/connect/AuthError.tsx` (US4 cenário 4)
- [X] T092 [US4] Implementar a ação "descartar rascunho" em `src/app/DraftRecoveryBanner.tsx`, preservando a credencial (FR-045)

**Checkpoint**: todas as user stories funcionam de forma independente

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: qualidade transversal e validação dos critérios de sucesso restantes

- [X] T093 [P] Criar `tests/a11y/steps.spec.tsx` rodando axe-core nas 4 etapas (FR-046)
- [X] T094 [P] Criar `e2e/narrow-viewport.spec.ts` — fluxo completo em 375 px sem rolagem horizontal da página e com todos os controles alcançáveis (SC-012)
- [X] T095 [P] Criar `e2e/keyboard.spec.ts` — as 4 etapas navegáveis somente por teclado, incluindo o botão de revelar credencial (FR-046)
- [X] T096 Implementar o layout responsivo da revisão em `src/features/review/` de forma **mobile-first**: cartões empilhados por padrão, tabela a partir do breakpoint `sm:` (640 px), sem nenhuma largura fixa em pixels (FR-047, research §12)
- [X] T097 [P] Criar `tests/unit/no-secrets.spec.ts` — falha se `src/` contiver `client_secret`/`clientSecret` e se alguma URL de rede sair da lista de hosts autorizados (FR-005, FR-010)
- [X] T098 Calibrar os limiares de `src/domain/scoring/thresholds.ts` contra `tests/fixtures/reference-50.json` até atingir SC-002, sem alterar a lógica de pontuação
- [X] T099 Medir a vazão real com 250 linhas e ajustar `ratePerSecond`/`concurrency` se necessário para cumprir SC-005 e SC-010
- [X] T100 [P] Escrever `README.md` — como obter o Client ID, qual Redirect URI cadastrar (e por que `localhost` não serve) e como publicar o `dist/` em hospedagem estática
- [X] T101 Revisar todos os textos da interface em `src/i18n/pt-BR.ts` quanto a acentuação e clareza, confirmando que nenhum literal de UI ficou fora do módulo (FR-048)
- [X] T102 Conferir a CSP no `dist/index.html` gerado — confirmando que `style-src` ficou em `'self'` (o Tailwind emite CSS estático) — e que nenhuma requisição sai dos hosts autorizados durante um fluxo completo (FR-010)
- [X] T103 Rodar `npm run build` e servir `dist/` por um servidor de arquivos estáticos, repetindo o fluxo completo (SC-008)
- [X] T104 Executar todos os cenários de [quickstart.md](./quickstart.md) (A a I) e registrar os desvios

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Fase 1)**: sem dependências
- **Foundational (Fase 2)**: depende da Fase 1 — **bloqueia todas as user stories**
- **US1 / US2 / US3 / US4 (Fases 3-6)**: dependem da Fase 2; podem ser paralelizadas entre pessoas
- **Polish (Fase 7)**: depende das user stories desejadas

### User Story Dependencies

- **US1 (P1)**: independente após a Fase 2
- **US2 (P1)**: independente após a Fase 2 — testável com sessão simulada, sem depender de US1 implementada
- **US3 (P1)**: independente após a Fase 2 — testável com correspondências simuladas. Em produção consome o resultado de US2, mas o acoplamento é o store, não o código
- **US4 (P2)**: independente após a Fase 2. As demais stories já funcionam sem ela; US4 acrescenta a camada de recuperação visível

### Dentro de cada user story

- Testes escritos antes da implementação, e devem falhar antes de passar
- Domínio puro (`src/domain/`) antes dos serviços; serviços antes da interface
- Fiação no Wizard sempre por último — é o que fecha o incremento

### Parallel Opportunities

- **Fase 1**: T002, T005, T006, T007, T008, T009 em paralelo (T003 e T004 tocam arquivos próprios mas dependem de T001)
- **Fase 2**: T010, T011, T016, T017, T019, T020, T022 em paralelo; T012-T015 em paralelo entre si após T011
- **US1**: os 6 testes (T025-T030) em paralelo; depois T031 e T032 em paralelo
- **US2**: os 8 testes (T043-T050) em paralelo; depois T051 e T052 em paralelo
- **US3**: os 5 testes (T065-T069) em paralelo; depois T070, T071 e T073 em paralelo
- **US4**: T082-T084 em paralelo
- **Fase 7**: T093, T094, T095, T097, T100 em paralelo

---

## Parallel Example: User Story 2

```bash
# Testes da US2, todos em arquivos distintos:
Task: "tests/unit/parser.spec.ts — separadores, numeração, feat., unparsed"
Task: "tests/unit/normalize.spec.ts — acentos, sufixos promocionais, remix preservado"
Task: "tests/unit/scoring.spec.ts — fronteiras dos limiares"
Task: "tests/unit/dedupe.spec.ts — duas passagens de duplicata"
Task: "tests/unit/rate-limiter.spec.ts — vazão e cancelamento"
Task: "tests/integration/search.spec.ts — filtros, fallback, 429"

# Depois, os dois módulos puros sem dependência entre si:
Task: "src/domain/normalize/index.ts"
Task: "src/domain/parser/index.ts"
```

---

## Implementation Strategy

### MVP

Há três user stories **P1** porque nenhuma delas entrega valor sozinha: conectar sem colar não serve, colar sem criar não serve. O menor incremento **demonstrável** é US1; o menor incremento **entregável ao usuário** é US1 + US2 + US3.

1. Fase 1: Setup
2. Fase 2: Foundational (bloqueia tudo)
3. Fase 3: US1 → **PARE e valide** o Cenário A do quickstart
4. Fase 4: US2 → valide os Cenários B e C
5. Fase 5: US3 → valide os Cenários D e H → **produto utilizável**

### Entrega incremental

US4 (P2) e a Fase 7 vêm depois do produto já funcionar. US4 aumenta a taxa de conclusão em listas longas; a Fase 7 fecha os critérios de sucesso de acessibilidade, tela estreita, vazão e hospedagem estática.

### Time paralelo

Após a Fase 2: uma pessoa em US1 (autorização), outra em US2 (domínio + busca — a maior fase), outra em US3 (criação). US4 entra depois, pois costura estados das três.

---

## Notes

- `[P]` = arquivos distintos, sem dependência pendente
- Todo o domínio em `src/domain/` é puro: sem `fetch`, sem DOM, sem `localStorage`. É o que torna T043-T047, T065 e T066 rápidos e determinísticos
- Nenhuma tarefa cria campo de pasta de playlist, e nenhuma simula tal recurso (FR-038)
- Classes Tailwind são sempre literais estáticas. Um `className` montado por concatenação some do CSS emitido — falha que não aparece em desenvolvimento e só se manifesta no build (research §14). A regra de ESLint de T005 é a proteção contra isso
- Nenhum teste toca a rede real — MSW cobre o contrato inteiro
- Commit por tarefa ou grupo lógico; parar em qualquer checkpoint para validar
