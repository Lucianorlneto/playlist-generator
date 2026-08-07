---
description: 'Lista de tarefas — Reconexão Sem Descartar o Trabalho'
---

# Tasks: Reconexão Sem Descartar o Trabalho (YouTube Reconnect)

**Input**: Design documents from `/specs/004-youtube-reconnect/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: **obrigatórios**. FR-034 exige verificação executável para todo requisito com consequência observável, e o Princípio IV da constituição diz que invariante sem teste não é invariante. As 37 verificações de [research §14](./research.md) estão distribuídas pelas fases abaixo, cada tarefa de teste citando a sua.

**Organization**: agrupadas por história de usuário, para que cada uma possa ser implementada, testada e entregue de forma independente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência)
- **[Story]**: a qual história a tarefa pertence (US1, US2, US3, US4)
- Todo caminho de arquivo é relativo à raiz do repositório

## Path Conventions

Projeto único, web estático sem backend: `src/` e `tests/` na raiz, `e2e/` na raiz para Playwright.

---

## ⚠️ Regra de não regressão que vale para todas as fases

Estas suítes **devem passar sem edição** do começo ao fim. Editar qualquer uma delas é o sinal de que a implementação saiu do contrato ([quickstart](./quickstart.md), [research §14](./research.md)):

```text
tests/unit/no-secrets.spec.ts              tests/integration/search.spec.ts
tests/unit/throughput.spec.ts              tests/integration/search-free-shape.spec.ts
tests/integration/partial-failure.spec.ts  tests/integration/search-retry.spec.ts
tests/integration/draft-recovery.spec.ts   tests/integration/session-recovery.spec.ts
```

`session-recovery.spec.ts` é a cobertura existente de `002/FR-035` — o caso "serviço sem sessão quando a etapa começa", que a spec exige que não regrida (§ Edge Cases, último item).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: fixar a linha de base e preparar a infraestrutura de teste. Nenhuma dependência nova é instalada nesta feature.

- [X] T001 Rodar o portão local de base (`npm run lint && npm run typecheck && npm test`) e registrar como verdes, antes de qualquer alteração, as 8 suítes de não regressão listadas em `specs/004-youtube-reconnect/quickstart.md` § "Não regressão"
- [X] T002 [P] Estender `tests/msw/handlers.ts` com respostas de autorização inválida (`401`) para busca e para criação nos dois provedores, sem introduzir host novo (N1, `tests/unit/no-secrets.spec.ts` deve continuar passando)
- [X] T003 [P] Estender `tests/integration/support/clients.ts` com um auxiliar que conta requisições emitidas por provedor — base de V5, V11 e V12

**Checkpoint**: linha de base conhecida e mocks de `401` disponíveis.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: o pré-requisito de cota, a regra nova de classificação de erro, o contrato de retorno da busca, a fase nova no domínio e o primitivo de diálogo. Tudo aqui é compartilhado por mais de uma história; a mudança de assinatura de `search` quebra a compilação do projeto inteiro enquanto não estiver completa.

**⚠️ CRITICAL**: nenhuma história pode começar antes desta fase terminar.

### Pré-requisito: cota fantasma (passo 1 da ordem de implementação do plan.md)

- [X] T004 [P] Escrever o teste V7/Q3 — N linhas respondendo `401` **não** registram consumo — em `tests/integration/quota-401.spec.ts` (arquivo novo, isolado: a Fase 2 não compartilha arquivo de teste com nenhuma história). Deve **falhar** medindo `100·N` unidades fantasma antes do conserto
- [X] T005 Remover o registro de consumo quando `response.status === 401` em `src/services/providers/http.ts` (linha ~212), mantendo o registro para todos os demais status, inclusive `403` e `5xx` (Q1, Q2 de [provider-contract §4](./contracts/provider-contract.md))

### A regra: falha de linha vira item, falha de sessão derruba a execução

- [X] T006 [P] Escrever o teste V1 — `isSessionLevel` verdadeira **exatamente** para `reauth_required` e `session_expired`, falsa para `quota_exhausted` e para `kind` desconhecido — em `tests/unit/session-level.spec.ts`
- [X] T007 [P] Implementar `isSessionLevel(error: AppError): boolean` em `src/services/providers/errors.ts`, genérica e sem `ProviderId` (E1–E3 de [provider-contract §2](./contracts/provider-contract.md)). Não tocar em `src/services/providers/youtube/errors.ts:isItemLevel`

### Tipos e domínio

- [X] T008 Acrescentar em `src/domain/types.ts`: o valor `'awaiting_reauth'` em `RunPhase`, o campo `resumeFrom: 'search' | 'creating' | null` em `ServiceRun` e a interface `SearchOutcome { items: MatchItem[]; interruption: AppError | null }` ([data-model §1, §2, §5](./data-model.md))
- [X] T009 Escrever o teste V10 — todas as transições da tabela de [data-model §3](./data-model.md), incluindo identidade sob R2 (execução encerrada ignora `session_lost`) e A1/A2 (`resumeFrom !== null` ⟺ `phase === 'awaiting_reauth'`) — estendendo `tests/unit/run-machine.spec.ts`
- [X] T010 Implementar em `src/domain/run/machine.ts`: o evento `{ type: 'session_lost'; from: 'search' | 'creating'; items?: MatchItem[] }` em `RunEvent`, as transições da tabela, `'awaiting_reauth'` em `OPEN_PHASES` e `resumeFrom: null` em `emptyRun`
- [X] T011 [P] Escrever os testes V8 e A4 — `remainingLineIds` devolve subconjunto ordenado de `run.lineIds`, só itens `pending`, e a marcação de duplicidade é recalculada sobre o conjunto completo — em `tests/unit/remaining-lines.spec.ts`
- [X] T012 Implementar a função pura `remainingLineIds(run: ServiceRun): string[]` em `src/domain/run/lines.ts`, fonte única de FR-013 (texto de custo) e FR-013b (o que é buscado na retomada)
- [X] T013 [P] Atualizar `tests/fixtures/factories.ts` para produzir `ServiceRun` com `resumeFrom` e para montar execuções em `awaiting_reauth` nas duas origens de retomada

### Contrato de busca

- [X] T014 Alterar a assinatura de `search` para `Promise<SearchOutcome>` em `src/services/providers/types.ts` ([provider-contract §1](./contracts/provider-contract.md))
- [X] T015 Reescrever o isolamento de falha em `src/services/providers/searchRunner.ts`: `searchOne` relança quando `isSessionLevel(error)`, um `AbortController` interno encadeado a `ctx.signal` aborta as demais linhas na primeira falha de sessão, e `runProviderSearch` devolve `SearchOutcome` (S1–S6, P1–P6). Linhas não emitidas e em voo voltam `pending`, nunca `not_found`
- [X] T016 Fazer a interrupção ser reportada como cancelamento — `interruption: null` — quando `ctx.signal.aborted` no momento de consolidar, em `src/services/providers/searchRunner.ts` (S5, FR-008, [research §11](./research.md))
- [X] T017 [P] Propagar `SearchOutcome` no adaptador do YouTube em `src/services/providers/youtube/index.ts` e `src/services/providers/youtube/search.ts`
- [X] T018 [P] Propagar `SearchOutcome` no adaptador do Spotify em `src/services/providers/spotify/index.ts` e `src/services/providers/spotify/search.ts`
- [X] T019 Propagar `SearchOutcome` em `src/features/input/matchRunner.ts`: `runMatching` devolve `SearchOutcome` aplicando `markDuplicates` sobre `items`; `matchLine` lê `outcome.items[0]` e **lança** quando `interruption !== null`
- [X] T020 Consumir `.items[0]` na re-busca de linha em `src/features/review/LineEditor.tsx`
- [X] T021 Rodar `npm run typecheck` e corrigir todo chamador remanescente do retorno antigo de `search` — são 4 chamadores conhecidos: os dois adaptadores, `matchRunner` e `LineEditor` ([research §3](./research.md))

### Armazenamento

- [X] T022 [P] Escrever o teste A6 — rascunho gravado em `awaiting_reauth` relê a mesma fase e o mesmo `resumeFrom`; conteúdo inválido em `resumeFrom` lê como `null` — estendendo `tests/unit/storage.spec.ts`
- [X] T023 Serializar `resumeFrom` (validado contra exatamente `'search' | 'creating'`) e aceitar `'awaiting_reauth'` em `RUN_PHASES` em `src/services/storage/draftRepo.ts`. **Não** incrementar `SCHEMA_VERSION` e **não** escrever migração ([research §13](./research.md))

### Primitivo de interface

- [X] T024 [P] Escrever V33 (U1–U6 e A3) — `showModal()` ao abrir e `close()` ao fechar, evento `close` nativo chamando `onClose` uma vez, foco inicial dentro, foco devolvido ao fechar, `aria-labelledby` presente e papel de diálogo anunciado a leitor de tela — em `tests/components/dialog.spec.tsx`
- [X] T025 Implementar `src/ui/Dialog.tsx` sobre o elemento `<dialog>` nativo com `showModal()`, sem `z-index` e sem dependência nova (U1–U7 de [ui-contract §1](./contracts/ui-contract.md)). A contenção de foco **não** é afirmada aqui — ela é provada em e2e (D1 do plan.md)
- [X] T026 [P] Acrescentar em `src/i18n/pt-BR.ts` os textos compartilhados de reconexão, **reutilizando** `connect.reconnect`, `connect.reconnectNeeded` e `connect.resumeAt`, que já existem e nunca foram renderizados (FR-033)

**Checkpoint**: `npm run typecheck` limpo, V1, V7, V8, V10, V33 e A6 verdes, e as 8 suítes de não regressão ainda passando sem edição. As histórias podem começar.

---

## Phase 3: User Story 1 - Reconectar quando a busca revela sessão perdida (Priority: P1) 🎯 MVP

**Goal**: a perda de autorização durante a busca vira pedido de reautorização retomável, com modal em primeiro plano; ao reconectar, só as linhas que faltam são buscadas.

**Independent Test**: com um rascunho na etapa do YouTube e a busca respondendo autorização inválida na primeira linha, verificar que (a) o modal aparece, (b) a execução **não** aparece como falhada, (c) após reconectar a busca recomeça e o rascunho — texto, nome da playlist e decisões de destinos já concluídos — continua íntegro.

### Tests for User Story 1 ⚠️

> Escrever primeiro e conferir que falham pela razão certa. V0 do quickstart é o `reauth-search.spec.ts` desta lista: antes do conserto ele deve falhar mostrando todas as linhas em `not_found` com o texto "Autorize o YouTube de novo para continuar".

- [X] T027 [P] [US1] Escrever V2, V11, V12 e V13 em `tests/integration/reauth-search.spec.ts`: `401` não produz item `not_found`; execução vai a `awaiting_reauth` com `outcome` ainda `null`; uma única interrupção com 100 linhas falhando juntas; nenhuma requisição emitida após a detecção; cancelamento explícito do usuário não vira pedido de reautorização
- [X] T028 [P] [US1] Escrever em `tests/integration/reauth-search.spec.ts` a verificação de FR-003 (rascunho gravado **antes** de qualquer mudança de estado) e de FR-004/FR-005/SC-005 (sessão, credencial e resultado do outro provedor intactos)
- [X] T029 [P] [US1] Escrever V3, V4, V5 e V6 em `tests/integration/reauth-partial-search.spec.ts` (arquivo novo): as N linhas resolvidas antes do `401` sobrevivem, as demais voltam `pending`, a retomada emite requisição só para as que faltam, e o consumo total (interrompida + retomada) iguala o de uma execução ininterrupta
- [X] T030 [P] [US1] Acrescentar em `tests/integration/reauth-partial-search.spec.ts` os casos de borda: zero linhas resolvidas (degrada para a lista inteira) e todas resolvidas (a retomada não consome cota nem emite requisição)
- [X] T031 [P] [US1] Escrever V15 e o contrato de conteúdo do modal em `tests/components/reauth-dialog.spec.tsx`: abre por estado derivado, título nomeia o serviço, progresso de busca, custo da retomada só no provedor com orçamento diário e calculado sobre `remainingLineIds`, ações de reconectar e fechar, `Esc` fecha, foco inicial dentro e devolvido ao fechar
- [X] T032 [P] [US1] Escrever V19 em `tests/components/reauth-resume.spec.tsx`: reconectar **sem recarregar a página** reinicia a busca (armadilha da guarda `startedFor`), busca só o que falta, e a tela de estimativa **não** é reexibida
- [X] T033 [P] [US1] Escrever V16a em `tests/integration/reauth-search.spec.ts`: credencial removida com pedido de reautorização aberto informa que o Client ID precisa ser cadastrado e **não** descarta o trabalho preservado (FR-016a)
- [X] T076 [P] [US1] Escrever V30 em `tests/integration/reauth-search.spec.ts`: reconexão que **falha** — consentimento negado ou Redirect URI inválido — exibe o erro de autorização com causa e próximo passo, nenhuma retomada automática dispara sem sessão válida, e o trabalho preservado permanece intacto (FR-016, R4)
- [X] T077 [P] [US1] Escrever V31 em `tests/unit/run-machine.spec.ts` e `tests/integration/reauth-search.spec.ts`: retomar de `awaiting_reauth` não altera a ordem da fila, não inicia o destino seguinte antes da vez e não reabre destino já encerrado — cobre o edge case "sessão perdida no primeiro serviço enquanto o segundo ainda nem começou" (FR-017)
- [X] T078 [P] [US1] Escrever V34 em `tests/components/reauth-dialog.spec.tsx`: o ponto de retomada exibido vem de `run.resumeFrom` e nunca é a fase corrente `awaiting_reauth` (FR-009)
- [X] T082 [P] [US1] Escrever V36 em `tests/integration/reauth-search.spec.ts`: reconexão a uma conta **diferente** durante a busca refaz a checagem de nome de playlist contra a conta atual, e o `existingNames` gravado contra a conta antiga é invalidado na perda de sessão em vez de continuar legível (FR-015)

### Implementation for User Story 1

- [X] T034 [US1] Despachar `session_lost { from: 'search', items }` ao receber `interruption !== null` da busca, percorrendo `handleSessionLoss` (gravar rascunho → limpar sessão daquele provedor → registrar `authError`) antes de qualquer mudança de estado, em `src/features/service/ServiceStep.tsx` (FR-001 a FR-003, FR-006)
- [X] T035 [US1] Acrescentar o ramo `awaiting_reauth` em `src/features/service/ServiceStep.tsx`, **atribuindo `startedFor.current`** como todos os outros ramos (T2 de [ui-contract §3](./contracts/ui-contract.md)); sem isso a volta a `search` não reinicia a busca e FR-014 quebra em silêncio
- [X] T036 [US1] Ao retomar de `awaiting_reauth` para `search`, buscar apenas `linesFor(lines, remainingLineIds(run))` e **não** reexibir a fase de estimativa, em `src/features/service/ServiceStep.tsx` (T3, T5, FR-013b, FR-014)
- [X] T037 [US1] Implementar `src/features/connect/ReauthDialog.tsx` sobre `Dialog`, aberto por estado derivado (`run.phase === 'awaiting_reauth'`), exibindo serviço, trabalho preservado, de onde retoma, progresso da busca e ações **Reconectar** / **Fechar sem reconectar** (R1, R4, R6 de [ui-contract §2](./contracts/ui-contract.md), FR-009 a FR-011)
- [X] T038 [US1] Fazer o botão **Reconectar** do diálogo reusar o caminho de `src/features/connect/ConnectButton.tsx` — `flushDraftNow` antes de navegar, autorização apenas do provedor afetado — em `src/features/connect/ReauthDialog.tsx` (R1, FR-024)
- [X] T039 [US1] Exibir o custo em cota da retomada no diálogo, calculado por `nominalCost` sobre `remainingLineIds(run)` e a reserva recontada sobre esse subconjunto, e omitido em provedor sem orçamento diário, em `src/features/connect/ReauthDialog.tsx` (FR-013, C1–C4 de [provider-contract §5](./contracts/provider-contract.md))
- [X] T040 [US1] Tratar credencial ausente com pedido aberto: mensagem sobre cadastrar o Client ID e caminho para isso, sem descartar o trabalho, em `src/features/connect/ReauthDialog.tsx` (R5, FR-016a)
- [X] T041 [US1] Montar `ReauthDialog` no ponto onde a execução corrente é conhecida, em `src/features/service/ServiceStep.tsx`
- [X] T042 [P] [US1] Acrescentar em `src/i18n/pt-BR.ts` os textos do modal de busca — progresso de linhas, custo da retomada, credencial ausente — sem literal de interface fora de `src/i18n/` (FR-033, V29)
- [X] T079 [US1] Fazer `resumePointOf` derivar de `run.resumeFrom` quando `run.phase === 'awaiting_reauth'`, em `src/features/connect/reconnect.ts`. Hoje devolve `run.phase`, o que faria `connect.resumeAt` dizer "awaiting_reauth" em vez de "search" ou "creating" (FR-009, V34)
- [X] T059 [US1] Refazer a checagem de nome de playlist já existente contra a conta atual após reconexão a uma conta diferente, em `src/features/review/nameCheck.ts` e `src/features/service/ServiceStep.tsx`, **invalidando `existingNames` no store no momento da perda de sessão** — hoje `handleSessionLoss` não o limpa, e a lista da conta antiga continua legível (FR-015, [data-model §9](./data-model.md)). **Estava em US3 e foi movida**: a metade de FR-015 que exibe o nome da conta nova é do cabeçalho (T057), mas a recheca do nome de playlist pertence ao caminho de retomada — deixá-la em US3 tiraria FR-015 do MVP

**Checkpoint**: US1 completa e testável sozinha. `npx vitest run tests/integration/reauth-search.spec.ts tests/integration/reauth-partial-search.spec.ts tests/components/reauth-dialog.spec.tsx tests/components/reauth-resume.spec.tsx` verde, e as 8 suítes de não regressão intocadas. **MVP entregável.**

---

## Phase 4: User Story 2 - Reconectar durante a criação, sem duplicar faixas (Priority: P2)

**Goal**: perda de autorização durante a adição de faixas vira o mesmo pedido de reautorização, informando o que já entrou; ao reconectar, a adição retoma do lote seguinte ao último confirmado.

**Independent Test**: com a criação em andamento e a autorização caindo após o primeiro lote confirmado, verificar que a playlist criada não é removida, que o aviso informa o que já foi escrito, e que após reconectar a adição retoma sem repetir nem pular faixa.

> A retomada por lote **já existe** ([research §5](./research.md)): `sendRemainingItems` só incrementa `committedItems` após sucesso, e `retryRemaining()` parte do `playlistId` sem criar segunda playlist. FR-029, FR-030 e FR-032 saem satisfeitos pelo que existe — o trabalho é ligar o pedido de reautorização a esse caminho.

### Tests for User Story 2 ⚠️

- [X] T043 [P] [US2] Escrever V24 e V26 em `tests/integration/reauth-creation.spec.ts`: `401` na adição leva a `awaiting_reauth` com `resumeFrom: 'creating'` e sem desfecho; nada é escrito na conta entre a interrupção e a reconexão
- [X] T044 [P] [US2] Escrever em `tests/integration/reauth-creation.spec.ts` a verificação de FR-030 (playlist já criada não é removida, recriada nem renomeada) e do cenário 4 de US2 (recarregar sem reconectar retoma na mesma execução com o índice de confirmação válido)
- [X] T045 [P] [US2] Escrever V27 em `tests/integration/reauth-creation.spec.ts`: reconexão a uma conta **diferente** daquela que criou a playlist parcial informa que a retomada não é possível e encerra o destino como **parcial**, sem criar uma segunda playlist (FR-031)
- [X] T046 [P] [US2] Escrever em `tests/components/reauth-resume.spec.tsx` a verificação de T4: voltar de `awaiting_reauth` para `creating` chama `retryRemaining()` e não repete a confirmação de revisão (FR-032)
- [X] T047 [P] [US2] Confirmar V25 rodando `tests/integration/partial-failure.spec.ts` **sem editar o arquivo** — a prova de que a retomada por lote existente não foi alterada
- [X] T080 [P] [US2] Escrever V35 em `tests/components/reauth-dialog.spec.tsx`: com `resumeFrom === 'creating'`, o diálogo informa quantas faixas já entraram e quantas faltam, a partir de `committedItemCount(run.creation)` (FR-028)

### Implementation for User Story 2

- [X] T048 [US2] Reconhecer erro de sessão no `catch` de `sendRemainingItems` e despachar `session_lost { from: 'creating' }` em vez de apenas `setCreationError`, em `src/features/result/creationRunner.ts` (FR-027)
- [X] T049 [US2] Retomar a criação a partir de `awaiting_reauth` chamando `retryRemaining()`, sem nova confirmação de revisão e sem escrever nada antes da reconexão bem-sucedida, em `src/features/service/ServiceStep.tsx` e `src/features/result/RetryRemaining.tsx` (T4, FR-029, FR-032)
- [X] T050 [US2] Exibir no diálogo, quando `resumeFrom === 'creating'`, quantas faixas já entraram e quantas faltam, a partir de `committedItemCount(run.creation)`, em `src/features/connect/ReauthDialog.tsx` (FR-028)
- [X] T051 [US2] Encerrar o destino como **parcial**, com a contagem real do que foi escrito, quando o usuário opta por não reconectar ou reconecta a uma conta diferente da que criou a playlist, em `src/features/result/creationRunner.ts` e `src/features/service/ServiceStep.tsx` (FR-031)
- [X] T052 [P] [US2] Acrescentar em `src/i18n/pt-BR.ts` os textos do modal na fase de criação e o aviso de conta diferente (FR-033)

**Checkpoint**: US1 e US2 funcionam independentemente. `partial-failure.spec.ts` passou sem edição.

---

## Phase 5: User Story 3 - Reconectar manualmente, a qualquer momento (Priority: P2)

**Goal**: o cabeçalho lista todo destino selecionado com credencial salva, conectado ou não, sempre oferecendo **Reconectar** — nenhum caminho leva a um serviço desconectado sem saída.

**Independent Test**: com o YouTube conectado, acionar "Reconectar" no cabeçalho e verificar que a autorização é iniciada e o rascunho sobrevive à ida e à volta. Com o YouTube desconectado, verificar que ele continua listado, oferecendo reconectar.

> Independente das demais: não depende da fase `awaiting_reauth` nem do diálogo. Pode ser feita em paralelo com US1 e US2 assim que a Fase 2 terminar.

### Tests for User Story 3 ⚠️

- [X] T053 [P] [US3] Escrever V20, V21 e V22 em `tests/components/session-header.spec.tsx`: serviço desconectado com credencial continua listado com **Reconectar**; conectado oferece **Reconectar** e **Desconectar** com rótulos inequívocos; sem credencial não é listado; desconectar mantém o serviço listado
- [X] T054 [P] [US3] Escrever em `tests/components/session-header.spec.tsx` a verificação de H4 (provedor fora de `destinations.selected` não é listado; antes da etapa de destinos o cabeçalho não lista nada) e de H7 (nenhuma ação do cabeçalho escreve na conta — FR-026)
- [X] T055 [P] [US3] Escrever em `tests/components/session-header.spec.tsx` a verificação de H8 e do cenário 4 de US3: reconectar um serviço não toca sessão nem credencial do outro, e reconectar a uma conta diferente passa a exibir o nome novo antes de qualquer confirmação de criação (FR-004, FR-005, FR-015)

### Implementation for User Story 3

- [X] T056 [US3] Trocar a fonte da lista de `PROVIDER_ORDER.filter((p) => sessions[p] !== null)` para "provedores em `destinations.selected` **com credencial salva**", na ordem de `PROVIDER_ORDER`, em `src/features/connect/SessionHeader.tsx` (H3, H4, FR-019, FR-023)
- [X] T057 [US3] Exibir o estado de cada serviço listado — conectado com o nome da conta, ou desconectado — em `src/features/connect/SessionHeader.tsx` (H1, H2, FR-020)
- [X] T058 [US3] Oferecer **Reconectar** para todo serviço listado, conectado ou não, reusando `src/features/connect/ConnectButton.tsx` (que já grava o rascunho antes de navegar), e manter **Desconectar** apenas quando conectado, em `src/features/connect/SessionHeader.tsx` (H1, H5, H6, FR-021, FR-022, FR-024, FR-025)
- [X] T060 [P] [US3] Acrescentar em `src/i18n/pt-BR.ts` os rótulos do cabeçalho — estado desconectado e a distinção inequívoca entre reconectar e desconectar (FR-022, FR-033)

**Checkpoint**: US1, US2 e US3 funcionam independentemente. SC-004 satisfeito: nenhum caminho deixa um serviço com credencial desconectado e sem ação de reconexão visível.

---

## Phase 6: User Story 4 - Adiar a reconexão sem perder nada (Priority: P3)

**Goal**: fechar o modal não é caminho destrutivo nem armadilha — a etapa continua exibindo o pedido com reconectar e pular, e recarregar reapresenta o pedido.

**Independent Test**: exibir o modal, fechá-lo sem reconectar, e verificar que a etapa mostra o pedido de reautorização com ação de reconectar, sem desfecho de falha e sem rascunho descartado.

### Tests for User Story 4 ⚠️

- [X] T061 [P] [US4] Escrever V18 em `tests/components/reauth-dialog.spec.tsx`: fechar sem reconectar deixa a etapa exibindo o pedido, com **Reconectar** e **Pular este serviço**, e a execução permanece retomável sem desfecho (FR-012, US4 cenário 1)
- [X] T062 [P] [US4] Escrever em `tests/components/reauth-dialog.spec.tsx` a verificação de R3: a dispensa é estado local e **não** é persistida — recarregar reapresenta o pedido na etapa (US4 cenário 3)
- [X] T063 [P] [US4] Escrever em `tests/integration/reauth-search.spec.ts` a verificação do cenário 2 de US4: acionar **Pular este serviço** a partir de `awaiting_reauth` encerra aquele destino como `skipped`, avança a fila e preserva o que já foi feito

### Implementation for User Story 4

- [X] T064 [US4] Guardar a dispensa como estado local do componente, nunca persistido, em `src/features/connect/ReauthDialog.tsx` (R3)
- [X] T065 [US4] Exibir no ramo `awaiting_reauth` da etapa o pedido de reautorização com **Reconectar** e **Pular este serviço**, em `src/features/service/ServiceStep.tsx` (T1, FR-012)
- [X] T066 [P] [US4] Acrescentar em `src/i18n/pt-BR.ts` os textos do pedido exibido na etapa após a dispensa (FR-033)

**Checkpoint**: todas as quatro histórias funcionam independentemente.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: acessibilidade, ponta a ponta, precedência de cota e as provas de não regressão que fecham os critérios de sucesso.

- [X] T067 [P] Escrever V14 em `tests/integration/youtube-quota.spec.ts`: cota esgotada **não** exibe modal de reconexão e continua encerrando sem repetir; os casos existentes do arquivo devem continuar passando ([research §12](./research.md))
- [X] T068 [P] Escrever V23 estendendo `tests/integration/draft-recovery.spec.ts`: perda de sessão em um provedor não toca sessão, credencial nem resultado do outro, e o rascunho sobrevive à ida e à volta da autorização (FR-004, FR-005, SC-005)
- [X] T069 [P] Escrever V17 em `tests/a11y/steps.spec.tsx`: axe-core sem violação séria ou crítica com o diálogo de reconexão aberto (SC-006, A4)
- [X] T070 [P] Escrever V16 em `e2e/reconnect.spec.ts`: **contenção de foco** no diálogo em navegador real e fluxo completo — aviso, reconexão, retomada — operável só por teclado (FR-011, SC-006, A1, A2). É aqui que D1 do plan.md é provado; happy-dom não emula a top layer
- [X] T071 [P] Verificar ausência de rolagem horizontal com o diálogo aberto em tela estreita, estendendo `e2e/narrow-viewport.spec.ts` (A5)
- [X] T081 [P] Escrever V32 em `e2e/reconnect.spec.ts`: do aviso até a busca recomeçar, o usuário executa no máximo **duas** ações no app — acionar reconectar e conceder consentimento no serviço (SC-003)
- [X] T072 Rodar `npm run lint` e confirmar V29 — nenhum literal de texto de interface fora de `src/i18n/` (regra `tp/no-ui-text-literals`, FR-033)
- [X] T073 Rodar as 8 suítes de não regressão e confirmar que passaram **sem edição** (V9, V25, V28, e o teto de vazão de `tests/unit/throughput.spec.ts`)
- [X] T074 Rodar o portão completo — `npm run lint && npm run typecheck && npm test && npm run test:e2e` — ✅ verde (761 testes, 66 e2e). **O roteiro manual de `quickstart.md` § "Verificação manual" NÃO foi executado**: exige um humano operando o navegador com Client IDs reais. O que ele verifica está coberto por V16/V32 em `e2e/reconnect.spec.ts`, contra um Google simulado. Registrado em [quickstart-results.md](./quickstart-results.md)
- [X] T075 [P] Registrar o resultado da validação e atualizar o `README.md` com o comportamento de reconexão, seguindo o padrão de documentação das features 002 e 003

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Fase 1)**: sem dependências
- **Foundational (Fase 2)**: depende da Fase 1 — **bloqueia todas as histórias**
- **US1 (Fase 3)**, **US2 (Fase 4)**, **US3 (Fase 5)**, **US4 (Fase 6)**: dependem só da Fase 2
- **Polish (Fase 7)**: depende das histórias que se deseja entregar

### Dependências internas da Fase 2 (a ordem importa)

```text
T004 → T005                      (o teste de cota falha antes do conserto)
T005 → tudo o mais               (passo 1 do plan.md: com a cota fantasma gravando,
                                  os testes de consumo mediriam um valor que a
                                  própria feature vai mudar)
T006 → T007                      (teste antes)
T008 → T010, T012, T014, T023    (os tipos primeiro)
T009 → T010 · T011 → T012        (teste antes)
T014 → T015 → T016 → T017, T018 → T019 → T020 → T021
T022 → T023
T024 → T025
```

### Dependências entre histórias

- **US1 (P1)**: só a Fase 2. Nenhuma dependência de outra história
- **US2 (P2)**: só a Fase 2 para o caminho de criação. Reusa `ReauthDialog` de US1 (T037) para o progresso de criação em T050 — se US2 for feita antes de US1, T037 entra junto
- **US3 (P2)**: **totalmente independente**. Não toca a fase `awaiting_reauth` nem o diálogo
- **US4 (P3)**: precisa do ramo `awaiting_reauth` de US1 (T035) e do `ReauthDialog` (T037)

### Dentro de cada história

Testes primeiro, falhando pela razão certa → domínio → serviços → orquestração → interface → textos.

Dependências pontuais dentro de US1:

```text
T078 → T079                      (o teste do ponto de retomada falha antes do conserto)
T082 → T059                      (o teste da recheca de nome falha antes do conserto)
```

### Parallel Opportunities

- T002 e T003 em paralelo na Fase 1
- Na Fase 2: T004/T006 juntos; T011/T013/T022/T024/T026 juntos; T017 e T018 juntos (adaptadores distintos)
- Todos os testes de uma história marcados [P] rodam juntos — arquivos distintos
- **US3 inteira em paralelo com US1 e US2**, por times distintos: nenhum arquivo em comum além de `src/i18n/pt-BR.ts`
- Na Fase 7: T067 a T071 e T081 em paralelo

---

## Parallel Example: User Story 1

```bash
# Escrever todos os testes de US1 juntos (devem falhar antes da implementação):
Task: "V2/V11/V12/V13, V30, V31 e V36 em tests/integration/reauth-search.spec.ts"
Task: "V3/V4/V5/V6 em tests/integration/reauth-partial-search.spec.ts"
Task: "V15 e V34 em tests/components/reauth-dialog.spec.tsx"
Task: "V19 em tests/components/reauth-resume.spec.tsx"

# V0 — provar que o defeito existe antes de consertar:
npx vitest run tests/integration/reauth-search.spec.ts
# Esperado: falha com todas as linhas em not_found e "Autorize o YouTube de novo para continuar"
```

## Parallel Example: US1 e US3 em times distintos

```bash
# Time A — US1: ServiceStep, ReauthDialog, searchRunner, nameCheck
# Time B — US3: SessionHeader
# Único ponto de contato: src/i18n/pt-BR.ts (T042 e T060) — chaves distintas
```

---

## Implementation Strategy

### MVP First (US1 apenas)

1. Fase 1 — Setup
2. Fase 2 — Foundational (**crítica**: bloqueia tudo, e o conserto de cota vem antes de qualquer medição de consumo)
3. Fase 3 — US1
4. **PARAR E VALIDAR**: C1, C2, C4 e C5 do quickstart verdes; as 8 suítes de não regressão intocadas
5. Entregável: a dor relatada some do caminho mais frequente

### Incremental Delivery

1. Setup + Foundational → base pronta, `typecheck` limpo
2. + US1 → testar → entregar (**MVP**)
3. + US3 → testar → entregar (independente; pode sair antes de US2 se o time preferir)
4. + US2 → testar → entregar (o caso de maior consequência: mexe no que já existe na conta)
5. + US4 → testar → entregar (fecha a armadilha modal-ou-nada)
6. + Fase 7 → acessibilidade, e2e e provas de não regressão

### Parallel Team Strategy

1. O time inteiro fecha Setup + Foundational — a mudança de assinatura de `search` quebra a compilação enquanto não estiver completa, então dividi-la entre times custaria mais do que integrá-la
2. Depois:
   - Dev A: US1 (`searchRunner`, `ServiceStep`, `ReauthDialog`)
   - Dev B: US3 (`SessionHeader`) — zero sobreposição de arquivos
   - Dev C: US2 assim que T037 existir (`creationRunner`, retomada por lote)
3. US4 fecha depois de US1, e é pequena

---

## Notes

- **Os IDs T076–T082 não são contíguos na ordem de execução**, e **T059 mudou de fase** (de US3 para US1). Ambas as coisas vêm de `/speckit-analyze`, que rodou depois da geração; as tarefas estão posicionadas fisicamente na fase correta e os IDs de T001 a T075 permaneceram estáveis de propósito
- **A ordem de execução é a ordem do arquivo, não a ordem numérica.** `/speckit-implement` lê a posição
- **Nenhuma dependência nova.** `<dialog>` nativo cobre FR-011; biblioteca de modal foi recusada por escrito ([research §8](./research.md))
- **`SCHEMA_VERSION` não muda e não há migração.** Um bump invalidaria o rascunho de quem atualizasse no meio do trabalho — provocando exatamente a perda que a feature existe para evitar
- **A contenção de foco não é provada no portão local** (D1 do plan.md): happy-dom expõe `showModal()` mas não emula a top layer. A prova está em T070, no navegador real
- **T035 é a armadilha silenciosa**: sem atribuir `startedFor.current` no ramo novo, a busca não reinicia e nenhum erro aparece. T032 é o único teste que a pega, porque retoma sem recarregar
- **`youtube/errors.ts:isItemLevel` fica como está** — código morto desde a 002. Removê-lo junto tornaria uma regressão mais difícil de localizar
- Commitar a cada tarefa ou grupo lógico; parar em qualquer checkpoint para validar a história isoladamente
