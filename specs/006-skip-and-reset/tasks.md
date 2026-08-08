---
description: 'Lista de tarefas — Pular sem tela fantasma e recomeçar de qualquer ponto'
---

# Tasks: Pular sem tela fantasma e recomeçar de qualquer ponto

**Input**: Design documents from `/specs/006-skip-and-reset/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: **obrigatórios**. O Princípio IV da constituição diz que invariante sem teste não é invariante, e FR-001 a FR-026 têm consequência observável. As 21 verificações de [research §12](./research.md) estão distribuídas pelas fases abaixo, cada tarefa de teste citando a sua.

**Organization**: agrupadas por história de usuário. As duas histórias P1 são as duas metades do mesmo defeito e **saem juntas** — ver § Implementation Strategy, que explica por que US1 sozinha não é publicável.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência)
- **[Story]**: a qual história a tarefa pertence (US1, US2, US3, US4)
- Todo caminho de arquivo é relativo à raiz do repositório

## Path Conventions

Projeto único, web estático sem backend: `src/` e `tests/` na raiz, `e2e/` na raiz para Playwright.

---

## ⚠️ Regra de não regressão que vale para todas as fases

Estas suítes **devem passar sem edição** do começo ao fim. Editar qualquer uma delas é o sinal de que a implementação saiu do contrato ([quickstart](./quickstart.md), [research §12](./research.md)):

```text
tests/unit/run-machine.spec.ts             tests/integration/draft-recovery.spec.ts
tests/unit/no-secrets.spec.ts              tests/integration/draft-after-quota.spec.ts
tests/unit/i18n-stability.spec.ts          e2e/multi-destination.spec.ts
```

`run-machine.spec.ts` é a mais importante das seis: **`src/domain/run/machine.ts` não pode aparecer no `git diff` desta feature**. O defeito nunca esteve no redutor ([plan.md § Summary](./plan.md)).

`e2e/multi-destination.spec.ts:156` é o teste do sexto ponto de pulo, que já funciona hoje. Ele passar sem edição é a prova de que a unificação não mudou o comportamento de quem já estava certo ([ui-contract §4](./contracts/ui-contract.md)).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: fixar a linha de base. Nenhuma dependência nova é instalada nesta feature.

- [X] T001 Rodar `npm run lint && npm run typecheck && npm test` e registrar a linha de base (esperado: 69 arquivos, 902 testes, verdes), confirmando antes de qualquer alteração que as 6 suítes de não regressão listadas acima passam
- [X] T002 [P] Acrescentar a `tests/fixtures/factories.ts` um auxiliar `makeQueueWithOutcomes(order, outcomes)` que monta uma fila com desfechos arbitrários por destino — base de V0, V2, V3 e V4, que precisam de `completed`, `partial`, `failed` e `skipped` combinados

**Checkpoint**: linha de base conhecida e fábrica de filas com desfecho mistos disponível.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: os três consertos de pré-requisito, as duas funções puras e a ação única. Tudo aqui é compartilhado por mais de uma história, e os consertos precisam vir antes dos testes que medem o comportamento novo — sem o cancelamento, os testes de FR-011 e FR-022 mediriam um comportamento que a própria feature vai mudar ([plan.md § Ordem de implementação](./plan.md)).

**⚠️ CRITICAL**: nenhuma história pode começar antes desta fase terminar.

### Pré-requisito 1: descarte larga a busca em voo (FR-022)

- [X] T003 [P] Escrever V12 em `tests/integration/reset-aborts.spec.ts` (arquivo novo) — com uma busca em voo, `resetWork()` e `discardDraft()` devem deixar `controller.signal.aborted === true`. Deve **falhar** medindo `false`, que é o valor atual ([research §6](./research.md))
- [X] T004 Chamar `get().searchAbort?.abort()` no início de `resetWork` e de `discardDraft` em `src/store/draftSlice.ts`, **antes** do `set()` e mantendo o `clearDraft()` depois — a ordem existente está correta e o comentário que a justifica permanece válido ([research §10](./research.md))

### Pré-requisito 2: o foco não se move entre serviços (FR-024)

- [X] T005 [P] Escrever V14 em `tests/components/skip-service.spec.tsx` (arquivo novo) — `advance()` incrementa `stepToken`, e o cabeçalho da tela que passa a ser exibida recebe o foco. Deve **falhar** medindo `stepToken: 0` ([research §7](./research.md))
- [X] T006 Incrementar `stepToken` em `advance` no `src/store/runSlice.ts`. Verificado na Fase 0 que nenhum teste do repositório afirma foco em transição de etapa, então isto não pode quebrar suíte existente

### As funções puras (Princípio III)

- [X] T007 [P] Escrever V0 em `tests/unit/flow-exit.spec.ts` (arquivo novo) percorrendo **as seis linhas** da tabela de verdade de [flow-contract §1](./contracts/flow-contract.md), incluindo os dois casos que a tabela deixa explícitos: pular o primeiro de dois nunca devolve `summary` nem `discard`, e `partial`/`failed` contam como "rodou"
- [X] T008 [P] Implementar `FlowExit` e `exitAfterSkip(queue, provider)` em `src/domain/run/exit.ts` (arquivo novo), pura e total (invariantes E1 e E2 de [data-model §1](./data-model.md)). O critério de "rodou" é `outcome !== null && outcome !== 'skipped'` — **não** `phase`
- [X] T009 [P] Escrever V1 em `tests/unit/has-work.spec.ts` (arquivo novo) cobrindo as seis linhas de [flow-contract §2](./contracts/flow-contract.md), com e sem `queueCounts`
- [X] T010 [P] Implementar `hasWork(work, options?)` em `src/domain/work.ts` (arquivo novo), extraído do predicado embutido em `restoreDraft.ts:26` ([data-model §2](./data-model.md))
- [X] T011 Substituir o predicado embutido de `src/store/restoreDraft.ts` por `hasWork(draft)` **sem** `queueCounts`, preservando o comportamento — `tests/integration/draft-recovery.spec.ts` e `draft-after-quota.spec.ts` devem continuar passando sem edição

### A ação única (FR-008)

- [X] T012 [P] Escrever V6 e V7 em `tests/integration/skip-aborts.spec.ts` (arquivo novo) — pular durante a busca aborta o controlador (FR-011), e pular não emite nenhuma requisição de criação ou adição a nenhum provedor, contando requisições no MSW (FR-009, garantia G1 de [flow-contract §3](./contracts/flow-contract.md))
- [X] T013 Declarar `skipService: (provider: ProviderId) => void` em `src/store/types.ts` e implementá-la em `src/store/runSlice.ts` na ordem contratada — `cancelSearch()` → `exitAfterSkip` → `dispatchRun('skipped')` → `advance()` → aplicar o `exit` (invariantes S1, S2 e S3 de [data-model §3](./data-model.md)). A ação **não** abre diálogo

**Checkpoint**: o domínio decide para onde ir, a ação executa o pulo inteiro e os dois defeitos latentes de foco e cancelamento estão consertados. `src/domain/run/machine.ts` continua intocado.

---

## Phase 3: User Story 1 — Pular leva ao próximo, não a uma tela fantasma (Priority: P1) 🎯

**Goal**: pular um destino em qualquer das quatro fases coloca o usuário na primeira fase do próximo destino, em um clique, sem passar pela tela de criação do serviço dispensado.

**Independent Test**: com dois destinos selecionados, pular o primeiro em `connect`, `estimate`, `search`/`review` e `awaiting_reauth`, verificando que a tela seguinte é a conexão do segundo e que o título "Criando playlist…" do primeiro nunca aparece.

### Tests for User Story 1

- [X] T014 [P] [US1] Escrever V2 em `tests/components/skip-service.spec.tsx` — pular o primeiro de dois destinos nas quatro fases leva à primeira fase do segundo, sem diálogo de confirmação e **sem** que o título `t.playlistConfig.creating` apareça em nenhum momento (FR-002, FR-004, FR-007, FR-008)
- [X] T015 [P] [US1] Acrescentar a `tests/components/skip-service.spec.tsx` a verificação de FR-010 — pular um destino não altera `outcome`, `result` nem `frozenLines` de nenhum destino já encerrado (garantia G3)

### Implementation for User Story 1

- [X] T016 [US1] Criar `src/features/service/SkipButton.tsx` — gatilho único que recebe `provider`, consulta `exitAfterSkip` e chama `skipService`. Rótulo `t.queue.skipService`, variante `ghost`, sem confirmação nesta fase (o ramo `discard` entra em US2)
- [X] T017 [US1] Substituir os dois `dispatchRun({ type: 'skipped' })` de `src/features/service/ServiceStep.tsx` (fases `connect` e `awaiting_reauth`) por `SkipButton`
- [X] T018 [P] [US1] Substituir os dois `dispatchRun({ type: 'skipped' })` de `src/features/quota/QuotaEstimateScreen.tsx` (estimativa e estimativa bloqueada) por `SkipButton`
- [X] T019 [P] [US1] Substituir o `dispatchRun({ type: 'skipped' })` de `src/features/review/ReviewScreen.tsx` por `SkipButton`
- [X] T020 [US1] Substituir em `src/features/result/ResultScreen.tsx` a sequência que pula o **próximo** destino (`dispatchRun` + `advance` + `goToStep('summary')`) por `SkipButton` apontando para `nextProvider`. `e2e/multi-destination.spec.ts:156` deve continuar passando **sem edição** ([ui-contract §4](./contracts/ui-contract.md))

**Checkpoint**: os seis pontos de pulo chamam o mesmo caminho. Pular com destino seguinte funciona nas quatro fases. O caminho do último destino ainda não confirma — é o que US2 entrega.

---

## Phase 4: User Story 2 — Pular o último encerra o fluxo pelo caminho certo (Priority: P1)

**Goal**: pular o último destino leva ao resumo consolidado quando algum destino rodou, e descarta o trabalho voltando à seleção de serviços quando todos foram pulados — com confirmação explícita apenas neste segundo caso.

**Independent Test**: com um destino só, pular na conexão e verificar que, após confirmar, a tela é a seleção de serviços com a lista zerada e **sem tela em branco em nenhum instante**; com dois destinos e o primeiro concluído, pular o segundo e verificar que a tela é o resumo, sem confirmação.

### Tests for User Story 2

- [X] T021 [P] [US2] Escrever V3 em `tests/components/skip-service.spec.tsx` — o cenário do beco sem saída de [research §2](./research.md): destino único, pular, confirmar, chegar a `destinations` com o trabalho zerado. O teste deve afirmar explicitamente que `container.innerHTML !== ''` em todos os passos (FR-004, FR-007)
- [X] T022 [P] [US2] Escrever V4 em `tests/components/skip-service.spec.tsx` — pular o último com o anterior em `completed`, depois em `partial`, depois em `failed`: os três vão ao resumo, **sem** diálogo e **sem** descarte (FR-003, FR-012)
- [X] T023 [P] [US2] Escrever V5 em `tests/components/skip-service.spec.tsx` — recusar a confirmação, fechar pelo véu e fechar por `Esc` deixam etapa, fase, fila e trabalho idênticos, e devolvem o foco ao botão que abriu (FR-005, FR-020, SC-007, SC-009)

### Implementation for User Story 2

- [X] T024 [US2] Acrescentar `queue.skipEndsFlowTitle` e `queue.skipEndsFlowBody` a `src/i18n/pt-BR.ts` com os valores de [ui-contract §7](./contracts/ui-contract.md). **Nenhum valor existente pode ser alterado** — `tests/unit/i18n-stability.spec.ts` deve passar sem regravação de instantâneo
- [X] T025 [US2] Acrescentar a `src/features/service/SkipButton.tsx` o diálogo de confirmação, aberto **apenas** quando `exitAfterSkip` devolve `discard`, sobre o componente `Dialog` de `src/ui/Dialog.tsx`, com botão destrutivo `danger` rotulado `t.common.discard` e cancelamento `ghost` ([ui-contract §3](./contracts/ui-contract.md))

**Checkpoint**: as duas metades do defeito estão fechadas. O beco sem saída deixou de existir e nenhum trabalho é descartado sem confirmação.

---

## Phase 5: User Story 3 — Recomeçar todo o fluxo de qualquer lugar (Priority: P2)

**Goal**: um comando único no cabeçalho, presente em todas as etapas, que descarta o trabalho em andamento após confirmação e devolve o usuário à seleção de serviços, preservando credenciais e sessões.

**Independent Test**: entrar em qualquer etapa após a seleção de serviços, acionar o comando, confirmar, e verificar que o usuário está na seleção de serviços com o trabalho zerado, as credenciais intactas e o rascunho apagado.

### Tests for User Story 3

- [X] T026 [P] [US3] Escrever V8 em `tests/components/reset-flow.spec.tsx` (arquivo novo) — o botão está ausente na seleção de serviços de uma sessão recém-iniciada e presente depois de destinos escolhidos e etapa avançada (FR-021)
- [X] T027 [P] [US3] Escrever V9 e V13 em `tests/components/reset-flow.spec.tsx` — confirmar zera texto, linhas, configuração, fila e seleção, leva a `destinations`, **preserva `credentials` e `sessions`**, e apaga o rascunho de modo que uma restauração subsequente não o traga de volta (FR-016, FR-017, FR-018, SC-005)
- [X] T028 [P] [US3] Escrever V10 em `tests/components/reset-flow.spec.tsx` — recusar, fechar pelo véu e fechar por `Esc` não mudam nada e devolvem o foco ao botão (FR-020, SC-007)
- [X] T029 [P] [US3] Acrescentar a `tests/integration/reset-aborts.spec.ts` a verificação de FR-019 — recomeçar não emite nenhuma requisição a nenhum provedor, contando no MSW

### Implementation for User Story 3

- [X] T030 [US3] Acrescentar o bloco `flow` a `src/i18n/pt-BR.ts` com `reset`, `resetTitle`, `resetBody`, `resetKeeps` e `resetConfirm`, nos valores de [ui-contract §7](./contracts/ui-contract.md). Nenhum valor existente alterado
- [X] T031 [US3] Criar `src/app/ResetFlow.tsx` — botão `ghost` tamanho `sm` rotulado `t.flow.reset`, visível apenas quando `hasWork(state, { queueCounts: true })`, abrindo um `Dialog` com botão destrutivo `danger` que chama `resetWork()` ([ui-contract §1](./contracts/ui-contract.md), §2)
- [X] T032 [US3] Montar `ResetFlow` no cabeçalho de `src/app/Wizard.tsx`, **depois** de `ThemeControl` e `SessionHeader` no mesmo agrupamento — é a única adição desta feature à ordem de tabulação

**Checkpoint**: o usuário tem saída de qualquer ponto do fluxo, e ela não desconecta nenhuma conta.

---

## Phase 6: User Story 4 — Recomeçar não apaga playlist já criada (Priority: P3)

**Goal**: quando já existe playlist criada, a confirmação diz explicitamente que ela permanece na conta, e nenhum caminho de descarte emite remoção.

**Independent Test**: concluir a criação em um destino, acionar o comando de recomeçar e verificar que o diálogo cita a playlist preservada e que nenhuma requisição de remoção é emitida.

### Tests for User Story 4

- [X] T033 [P] [US4] Escrever V11 em `tests/components/reset-flow.spec.tsx` — a linha sobre playlists preservadas aparece **apenas** quando alguma execução tem `result !== null`, e não aparece quando nenhuma tem (FR-015)
- [X] T034 [P] [US4] Acrescentar a `tests/integration/reset-aborts.spec.ts` a verificação de SC-003 — com playlist já criada no MSW, recomeçar não emite nenhuma requisição `DELETE` nem de alteração a nenhum provedor

### Implementation for User Story 4

- [X] T035 [US4] Acrescentar `flow.resetKeepsPlaylist` a `src/i18n/pt-BR.ts` no valor de [ui-contract §7](./contracts/ui-contract.md)
- [X] T036 [US4] Exibir condicionalmente `t.flow.resetKeepsPlaylist` em `src/app/ResetFlow.tsx` quando alguma execução da fila tiver `result !== null`

**Checkpoint**: todas as histórias estão funcionais e o usuário sabe o que sobrevive ao descarte.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: acessibilidade, ponta a ponta e o portão final.

- [X] T037 [P] Escrever V15 em `tests/a11y/steps.spec.tsx` — axe sem violação séria ou crítica com o diálogo de pulo aberto e com o diálogo de recomeço aberto (FR-023, SC-008)
- [X] T038 [P] Escrever V16 em `e2e/keyboard.spec.ts` — percurso completo por teclado, pulando um destino e recomeçando o fluxo sem mouse, com foco visível em cada parada (FR-023)
- [X] T039 Escrever V17 em `e2e/multi-destination.spec.ts` como cenário **novo**, sem tocar no existente da linha 156 — destino único, pular na revisão, confirmar, chegar à seleção de serviços; e afirmar que em nenhum passo a página fica sem cabeçalho e sem botão (SC-001, SC-002)
- [X] T040 [P] Verificar em `e2e/narrow-viewport.spec.ts` que os dois diálogos novos não produzem rolagem horizontal em tela estreita ([ui-contract §6](./contracts/ui-contract.md))
- [X] T041 Rodar `npm run lint && npm run typecheck && npm test && npm run test:e2e` e confirmar que o número de testes **cresceu** e que nenhum existente virou vermelho
- [X] T042 Confirmar que `git diff` **não toca** `src/domain/run/machine.ts` e que as 6 suítes de não regressão do topo deste arquivo passaram sem uma linha alterada
- [X] T043 Executar à mão o cenário V1 de [quickstart.md](./quickstart.md) no navegador (`npm run dev`), com um destino só — é o defeito pior, e é o único que nenhum teste automatizado prova ter sumido da experiência real

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências
- **Foundational (Phase 2)**: depende da Fase 1 — **bloqueia todas as histórias**
- **US1 (Phase 3)** e **US2 (Phase 4)**: dependem da Fase 2. US2 depende de US1, porque o diálogo de T025 é acrescentado ao `SkipButton` que T016 cria
- **US3 (Phase 5)**: depende da Fase 2 apenas. **Independente de US1 e US2** — pode ser feita em paralelo por outra pessoa
- **US4 (Phase 6)**: depende de US3, porque acrescenta uma linha ao diálogo que T031 cria
- **Polish (Phase 7)**: depende de todas as histórias desejadas

### Dependências dentro da Fase 2

```text
T003 ──► T004        (teste falha antes do conserto)
T005 ──► T006
T007 ──► T008        (tabela de verdade antes da função)
T009 ──► T010 ──► T011
T008 ─┐
T004 ─┼─► T013       (skipService usa exitAfterSkip, cancelSearch e advance)
T006 ─┘
T012 ──► T013
```

T006 e T013 tocam o mesmo arquivo (`src/store/runSlice.ts`) — **não** são paralelos.

### Parallel Opportunities

- T003, T005, T007, T009 e T012 são cinco testes em cinco arquivos novos distintos: todos em paralelo, e todos devem falhar antes da implementação correspondente
- T008 e T010 criam dois arquivos novos independentes em `src/domain/`
- T018 e T019 tocam arquivos diferentes e podem sair juntos; T017 e T020 também são independentes entre si, mas T017 vem depois de T016
- T021, T022 e T023 escrevem no mesmo arquivo `skip-service.spec.tsx` — marcados [P] por serem casos independentes, mas exigem coordenação se feitos por pessoas diferentes
- US3 inteira pode correr em paralelo com US1+US2 depois da Fase 2

### Parallel Example: Fase 2

```bash
# Os cinco testes que devem falhar primeiro, em paralelo:
Task: "V12 em tests/integration/reset-aborts.spec.ts"
Task: "V14 em tests/components/skip-service.spec.tsx"
Task: "V0 em tests/unit/flow-exit.spec.ts"
Task: "V1 em tests/unit/has-work.spec.ts"
Task: "V6 e V7 em tests/integration/skip-aborts.spec.ts"

# Depois, as duas funções puras em paralelo:
Task: "exitAfterSkip em src/domain/run/exit.ts"
Task: "hasWork em src/domain/work.ts"
```

---

## Implementation Strategy

### O MVP são as duas histórias P1 juntas, não a primeira sozinha

US1 é independentemente **testável** — dois destinos, pular o primeiro, chegar ao segundo — mas **não é publicável sozinha**. Com US1 aplicada e US2 ausente, `skipService` já aplica o ramo `discard`, e pular o último destino descartaria o trabalho **sem confirmação**. Isso viola FR-005 e o Princípio V da constituição, que é NÃO NEGOCIÁVEL.

Duas saídas possíveis, e a escolhida é a primeira:

1. **entregar US1 e US2 juntas** — são as duas metades do mesmo defeito, ambas P1, e somam 12 tarefas;
2. fazer o ramo `discard` cair em `summary` provisoriamente — recusada: criaria um comportamento intermediário que nenhum requisito descreve e que alguém teria de lembrar de remover.

### Ordem recomendada

1. Fase 1 → Fase 2. Aqui `src/domain/run/machine.ts` já está provado intocado e os dois defeitos latentes sumiram
2. Fase 3 + Fase 4 → **PARE e VALIDE**: cenário V1 do quickstart à mão, com um destino só. É o defeito pior e o que motivou a feature
3. Fase 5 → valide US3 isoladamente: recomeçar de três etapas diferentes
4. Fase 6 → valide US4
5. Fase 7 → portão completo, incluindo `npm run test:e2e`, que é obrigatório antes de publicar porque esta feature altera o fluxo do assistente

### Entrega incremental

- **Fases 1–2**: nada muda para o usuário, mas duas buscas fantasma param de acontecer e o foco passa a se mover entre serviços. Já vale um commit
- **Fases 3–4**: o defeito relatado está corrigido. Publicável
- **Fase 5**: a capacidade nova. Publicável
- **Fase 6**: honestidade sobre o que o descarte não apaga. Publicável

---

## Notes

- Toda tarefa de teste deve **falhar antes** da implementação correspondente. As de pré-requisito (T003, T005) já têm o valor medido registrado em [research §6](./research.md) e §7 — se passarem de primeira, o teste está errado
- `src/domain/run/machine.ts` não pode ser tocado. T042 é a verificação disso
- Nenhum texto existente de `src/i18n/pt-BR.ts` pode ser alterado; só adição de chave
- `queue.skipConfirm` e `queue.endService` continuam mortos de propósito — o primeiro tranquiliza sobre o caso em que algo rodou, e FR-012 proíbe confirmar justamente nesse caso ([research §11](./research.md))
- Migrar os dois `window.confirm` de `DraftRecoveryBanner` para `Dialog` está **fora de escopo**: nenhum FR pede, e misturar isso aqui repetiria o erro que a 005 recusou cometer com copy ([research §8](./research.md))
- Commit após cada tarefa ou grupo lógico; parar em qualquer checkpoint para validar
