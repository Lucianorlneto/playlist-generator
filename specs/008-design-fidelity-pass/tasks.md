# Tasks: Correções de fidelidade ao design oficial

**Input**: Documentos de design em `/specs/008-design-fidelity-pass/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: incluídos e **obrigatórios**. O Princípio IV da constituição — *invariante sem
teste não é invariante* — e FR-030b tornam a verificação executável parte do escopo, não
um extra. Cada teste cita o `FR-xxx` / `SC-xxx` que garante, como o projeto já faz.

**Organization**: as tarefas são agrupadas por história de usuário, para que cada uma
possa ser implementada, verificada e revisada isoladamente.

## Format: `[ID] [P?] [Story] Descrição`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: a qual história a tarefa pertence (US1…US6)
- Todo caminho de arquivo é relativo à raiz do repositório
- **Identificador com sufixo** (`T021a`, `T043a`, `T046a`): tarefa acrescentada depois da
  numeração inicial, na posição em que ela pertence. É a mesma convenção que a spec usa em
  FR-004a, FR-015a e FR-030a, e custa menos que renumerar cinquenta e seis referências

## Convenções desta feature

- **Nenhuma mudança de comportamento** (FR-032). Se uma tarefa exigir alterar um teste de
  fluxo, validação, cota, retomada ou armazenamento, pare: ou o escopo foi ultrapassado,
  ou o teste dependia de estrutura de apresentação — e nesse caso a edição precisa ser
  registrada com justificativa (SC-009).
- **Todo texto visível vem de `src/i18n/pt-BR.ts`**, em pt-BR (FR-031). `tp/no-ui-text-literals`
  é o portão.
- **Todo valor visual vem da camada de tokens** (FR-035). `tp/no-raw-visual-values` é o portão.
- O arquivo de design é lido pela ferramenta que o edita (MCP `pencil`), **nunca** por
  captura de tela.

---

## Phase 1: Setup (levantamento da fonte de verdade)

**Purpose**: pôr o arquivo de design dentro do repositório como material conferível, antes
de tocar em código. Sem isto, as histórias voltam a ser feitas a olho — que é exatamente o
método que falhou na 007.

- [X] T001 Ler as quatorze telas do arquivo de design nó a nó via MCP `pencil` (`get_app_state` com o esquema, depois `export_nodes` por tela) e registrar o levantamento em `specs/008-design-fidelity-pass/checklists/design-fidelity.md`, criando o arquivo com uma seção por tela conforme a tabela de `contracts/text-inventory.md` §4: para cada tela, os textos visíveis com o id do nó e as superfícies desenhadas (com contorno ou substrato próprio)
- [X] T002 Completar `specs/008-design-fidelity-pass/checklists/design-fidelity.md` com a lista de conferência **de forma** — composição, espaçamento, alinhamento, ritmo e peso tipográfico —, tela a tela, com colunas para os dois temas e as duas larguras, e uma seção de superfícies que existem na aplicação e não no arquivo (diálogos, selo de versão, aviso de limite de taxa) marcadas como mantidas por FR-008

**Checkpoint**: o arquivo de design está descrito no repositório; qualquer divergência
apontada adiante tem um nó de origem citável.

---

## Phase 2: Foundational (camada de tokens e a fechadura da exceção nomeada)

**Purpose**: o substrato de identidade por provedor e os três trincos que impedem a
exceção de virar regra geral. Bloqueia US1 e US5, que consomem os tokens.

**⚠️ CRITICAL**: nenhuma superfície pode usar `bg-brand-tint-*` antes de T007 e T008 — a
fechadura precisa existir antes da porta.

- [X] T003 Declarar `--brand-tint-amount` por tema (`12%` no tema Papel, `15%` no tema Noite, ao lado de `--state-tint-amount`) e os derivados `--brand-tint-spotify` / `--brand-tint-youtube` como `color-mix(in srgb, var(--brand-*) var(--brand-tint-amount), var(--surface))`, **uma única vez** fora dos blocos de tema, em `src/styles/tokens.css` — conforme `contracts/tokens.md` §1
- [X] T004 Emitir `--color-brand-tint-spotify` e `--color-brand-tint-youtube` no `@theme inline` de `src/styles/index.css`, ao lado de `--color-brand-spotify` / `--color-brand-youtube` (o modificador `inline` é o que faz a troca por `[data-theme]` funcionar)
- [X] T005 [P] Acrescentar os dois pares `--brand-spotify` sobre `--brand-tint-spotify` e `--brand-youtube` sobre `--brand-tint-youtube`, uso `ui` (≥ 3:1), em `src/domain/theme/approvedPairs.ts`, e mover `APPROVED_PAIR_COUNT` de 27 para 29
- [X] T006 [P] Ajustar `eslint-rules/index.js`: o padrão `brandAsFill` deixa de casar com o prefixo `bg-brand-tint-`, e um padrão novo `brandTintOutsideCard` recusa `bg-brand-tint-*` em todo arquivo que não seja `src/features/destinations/DestinationSelector.tsx`, com mensagem citando FR-004 e dizendo que autorizar outro ponto custa editar esta regra
- [X] T007 Acrescentar em `tests/unit/contrast.spec.ts` o resolvedor de `color-mix` (mistura em sRGB a partir dos hex lidos de `tokens.css`, sem digitar nenhum valor duas vezes) e as asserções dos dois pares novos nos dois temas, citando FR-003 e SC-002 (depende de T003, T005)
- [X] T008 [P] Acrescentar em `tests/unit/no-orphan-tokens.spec.ts` a asserção de que cada utilitário `bg-brand-tint-*` aparece em **exatamente um** arquivo de `src/`, citando FR-004 — cobre o caso de a regra de lint ser suprimida por comentário
- [X] T009 Rodar `npm run lint && npx vitest run tests/unit/contrast.spec.ts tests/unit/no-orphan-tokens.spec.ts` e confirmar que os dois pares medem ≥ 3:1 nos dois temas; se um reprovar, reduzir `--brand-tint-amount` do tema que reprovou em `src/styles/tokens.css` — **a cor da marca não é alterada nem removida** (borda da spec)

**Checkpoint**: os tokens existem, estão medidos e só podem ser usados no ponto autorizado.

---

## Phase 3: User Story 1 - Reconhecer o serviço pela cor (Priority: P1) 🎯 MVP

**Goal**: o símbolo de Spotify e YouTube aparece na cor da marca em todos os lugares em que
o arquivo de design a usa, nos dois temas, sem que nenhum outro preenchimento com cor de
marca entre no produto.

**Independent Test**: abrir qualquer etapa com os dois serviços cadastrados e conferir que
o símbolo do Spotify sai em verde e o do YouTube em vermelho, nos dois temas, no chip da
barra superior, no distintivo do cartão de destino e no cabeçalho dos cartões de fase do
ciclo. O marcador da fila do painel lateral nasce colorido em US4 (T029), onde o painel é
criado.

### Tests for User Story 1

- [X] T010 [P] [US1] Acrescentar em `tests/components/destinations.spec.tsx` o caso de o distintivo de cada cartão trazer o glifo em `text-brand-{provider}` sobre `bg-brand-tint-{provider}`, citando FR-001 e FR-003
- [X] T011 [P] [US1] Acrescentar em `tests/components/connection-chip.spec.tsx` o caso de o símbolo do provedor manter a cor da marca sob mudança de estado do chip — foco e hover não a sobrepõem —, citando FR-002

### Implementation for User Story 1

- [X] T012 [US1] Introduzir o distintivo do provedor em `src/features/destinations/DestinationSelector.tsx`: quadrado arredondado com substrato `bg-brand-tint-{provider}` e glifo `text-brand-{provider}`, ambos como **mapas de literais completos** indexados por `ProviderId` ao lado do `BRAND_INK` que já existe — nunca `className` montado por template (`tp/no-dynamic-classname`)
- [X] T013 [P] [US1] Aplicar a cor de marca ao símbolo do provedor no cabeçalho do cartão de orçamento em `src/features/quota/QuotaEstimateScreen.tsx`, pelo mesmo mapa de literais, conforme `contracts/destinations.md` §4
- [X] T014 [P] [US1] Aplicar a cor de marca ao símbolo do provedor no cabeçalho do cartão de resultado em `src/features/result/ResultScreen.tsx`, pelo mesmo mapa de literais
- [X] T015 [US1] Conferir em `src/features/connect/ConnectionChip.tsx` que o símbolo permanece em `text-brand-{provider}` nos estados conectado e pendente, e registrar no inventário de forma (T002) o estado `no-credential` em tinta neutra como divergência mantida por FR-008 — o arquivo não desenha esse estado
- [X] T016 [US1] Varrer `src/` atrás de preenchimento com cor de marca fora do distintivo (`bg-brand-spotify`, `bg-brand-youtube`, cor de marca como tinta de texto, de ação ou de estado) e remover o que houver, confirmando FR-004a e FR-005 — o nome do serviço permanece escrito em todo lugar em que o símbolo aparece

**Checkpoint**: US1 completa e verificável isoladamente. `npm run lint` recusa qualquer uso
de `bg-brand-tint-*` fora do cartão de destino.

---

## Phase 4: User Story 2 - Ler a etapa sem moldura em volta (Priority: P1)

**Goal**: o cabeçalho da etapa e o conteúdo que o segue ficam sobre o substrato da área
principal, sem cartão em volta, como o arquivo desenha nas quatorze telas.

**Independent Test**: percorrer as cinco etapas e confirmar que nenhuma tem superfície com
contorno envolvendo todo o conteúdo, e que cada cartão remanescente corresponde a um cartão
do arquivo ou a uma exceção registrada.

### Tests for User Story 2

- [X] T017 [P] [US2] Acrescentar em `tests/components/destinations.spec.tsx` a asserção estrutural de que nenhuma superfície com contorno envolve o cabeçalho da etapa — o `StepHeading` não tem ancestral com o utilitário `app-card` —, citando FR-006 e SC-003

### Implementation for User Story 2

- [X] T018 [US2] Remover o `<div className="app-card">` que envolve o conteúdo de toda etapa em `src/app/Wizard.tsx`, preservando o `app-card` como utilitário em `src/styles/index.css` — `MatchRow` e `SummaryScreen` correspondem a cartões que o arquivo desenha (research §R5)
- [X] T019 [US2] Ajustar em `src/app/Wizard.tsx` o espaçamento que o cartão fornecia — o respiro entre a linha de contexto, o título e o conteúdo passa a ser o do bloco de cabeçalho, com degraus da escala de espaçamento, sem valor arbitrário
- [X] T020 [US2] Conferir etapa a etapa, com o inspetor, que os selos de estado, campos e superfícies que contavam com o degrau de luminosidade do cartão continuam legíveis agora sobre `--bg`, e registrar o resultado na seção correspondente de `specs/008-design-fidelity-pass/checklists/design-fidelity.md` (research §R5 exige conferir, não presumir)
- [X] T021 [US2] Enumerar em `specs/008-design-fidelity-pass/checklists/design-fidelity.md` cada superfície com contorno ou substrato próprio que sobrou, casando-a com a superfície correspondente do arquivo (cartão de destino, cartão de credencial, cartão de fase, linha de correspondência, cartão de resultado, painel lateral) ou marcando-a como mantida por FR-008 com o motivo escrito

- [X] T021a [US2] Redesenhar por analogia, em `src/ui/Dialog.tsx`, `src/ui/VersionHintBadge.tsx` e `src/ui/RateLimitWaiting.tsx`, as superfícies que o arquivo de design não desenha: cada uma adota a superfície, o contorno e o raio do componente **mais próximo** que o design define — o cartão de fase para diálogo e aviso de espera, o selo de estado para o selo de versão —, agora que o substrato atrás delas mudou de `--surface` para `--bg` com a saída do `app-card` (FR-008). Silêncio do design não é ordem de remoção: nenhuma delas sai, e cada desfecho é registrado em T021

**Checkpoint**: US2 completa. A caixa que o pedido aponta em volta de "Para onde vai a
playlist?" não existe mais, e as que sobraram têm origem registrada.

---

## Phase 5: User Story 3 - Ser recebido pelo nome, onde o design recebe (Priority: P1)

**Goal**: a linha acima do título segue a tabela de FR-009 — ausente em Configuração e
Resumo, saudação pessoal em Destinos e Entrada, contexto de serviço nas seis fases do ciclo.

**Independent Test**: percorrer as cinco etapas e as fases do ciclo com uma conta conectada,
conferindo presença, conteúdo e destaque da linha contra a tabela de FR-009 — inclusive as
duas telas em que a linha **não** deve existir.

### Tests for User Story 3

- [X] T022 [P] [US3] Criar `tests/unit/header-context.spec.ts` cobrindo as dez linhas da tabela de `contracts/header-context.md` §1 uma a uma, a ausência em `credential` e `summary` verificada como `kind === 'absent'`, o recorte do primeiro nome (termo único, espaços em excesso), a degradação sem sessão e sem nome, a omissão da posição com `total === 1`, e a cobertura **total** das fases de `RunPhase` por exaustão do tipo — citando FR-009 a FR-012 e SC-004
- [X] T023 [P] [US3] Acrescentar em `tests/components/shell.spec.tsx` a asserção de que o primeiro nome sai em `text-accent-text` e o complemento em `text-ink-muted`, citando FR-010
- [X] T024 [P] [US3] Acrescentar em `tests/a11y/steps.spec.tsx` a asserção de que existe **exatamente um** elemento anunciando a posição na fila por tela nas fases de orçamento e de resultado — as cópias nos cartões são `aria-hidden` —, e a asserção de que a região viva existe também nas fases sem cartão (conexão, reconexão, busca, revisão), onde a linha de contexto é o único lugar em que a posição aparece, citando FR-013

### Implementation for User Story 3

- [X] T025 [US3] Criar `src/domain/header/index.ts` com `HeaderSnapshot`, a união discriminada `HeaderContext` (`absent` | `greeting` | `service`) e a função pura `headerContext(snapshot)`, implementando as regras H1 a H7 de `data-model.md` §1 e a tabela de fases de `contracts/header-context.md` §2 — puro: sem DOM, sem store, sem relógio, importando apenas `@/i18n/pt-BR` como módulo de dados (precedente de `src/domain/rail/`)
- [X] T026 [US3] Acrescentar em `src/i18n/pt-BR.ts` as chaves da linha de contexto — saudação "Oi, {name}", complemento de Destinos, complemento de Entrada, e os sufixos de orçamento e de conclusão do ciclo —, substituindo `greeting.personal` / `greeting.impersonal`
- [X] T027 [US3] Criar `src/app/StepContextLine.tsx` consumindo `headerContext`, com o primeiro nome em `text-accent-text` e o complemento em `text-ink-muted`, corpo tipográfico `--text-meta`, e sem vírgula solta nem espaço duplo quando `firstName` é `null` (FR-011); a forma `service` recebe `role="status"` e cada forma da união renderiza elemento próprio com `key` distinta, para que a região viva seja recriada e o anúncio dispare (`contracts/header-context.md` §5); remover `src/app/Greeting.tsx` e trocar o seu uso em `src/app/Shell.tsx`
- [X] T028 [US3] Mover a repetição visual da posição na fila para dentro do cabeçalho do cartão de fase em `src/features/quota/QuotaEstimateScreen.tsx` e `src/features/result/ResultScreen.tsx`, renderizando `src/features/queue/QueueIndicator.tsx` ali com `aria-hidden`; retirar a instância do topo de `src/features/service/ServiceStep.tsx`; e retirar `role="status"` e `aria-label` do próprio `QueueIndicator`, que deixa de ser o elemento anunciado — a região viva passa para o `StepContextLine` em T027 (research §R2, `contracts/header-context.md` §5)

**Checkpoint**: US3 completa. As três P1 estão entregues e a feature já é demonstrável.

---

## Phase 6: User Story 4 - Ver a ordem de execução no painel lateral (Priority: P2)

**Goal**: o painel lateral da etapa Destinos apresenta a fila de execução, o aviso de
execução em série, a fotografia e a legenda — e a explicação da ordem deixa de aparecer
duas vezes na tela.

**Independent Test**: selecionar os dois destinos e conferir que o painel lista Spotify como
primeiro e YouTube como segundo, com o aviso e a legenda do arquivo, e que a explicação de
ordem não aparece duplicada no corpo da etapa.

### Tests for User Story 4

- [X] T029 [P] [US4] Criar `tests/unit/displayed-queue.spec.ts` com os casos de `displayedQueue`: contém exatamente os selecionados, a ordem vem de `PROVIDER_ORDER`, seleção vazia devolve lista vazia, e `solo === true` com um único destino — regras Q1 a Q4 de `data-model.md` §2, citando FR-015. Arquivo **novo**: estender um teste de comportamento existente confundiria a leitura de SC-009 no diff
- [X] T030 [P] [US4] Acrescentar em `tests/components/destinations.spec.tsx` os casos do painel: existe com seleção vazia trazendo cabeçalho, aviso, fotografia e legenda mais o convite no lugar da fila (FR-015a); a fila reflete a seleção e nunca lista o não selecionado (FR-015); o texto vem antes da fotografia no DOM (FR-018); a explicação da ordem aparece uma única vez na tela (FR-019, SC-005); e o painel e a coluna primária mantêm as **mesmas classes de largura** com seleção vazia, com um destino e com dois — invariante P1 de `contracts/destinations.md` §2, que FR-015a/AC-3 exige e nenhum outro teste cobre (asserção de classe, não de pixel: `getBoundingClientRect` devolve zero em jsdom e o teste passaria vazio)

### Implementation for User Story 4

- [X] T031 [US4] Acrescentar `QueuedDestination` e `displayedQueue(selection)` em `src/domain/run/selection.ts`, projetando a seleção sobre `PROVIDER_ORDER` — projeção, nunca uma segunda fonte de ordem (`data-model.md` §2)
- [X] T032 [US4] Acrescentar em `src/i18n/pt-BR.ts` os textos do painel: título "Ordem de execução", a nota de posição de cada item, o convite da fila vazia, o aviso de execução em série e a legenda da fotografia
- [X] T033 [US4] Criar `src/features/destinations/ExecutionOrderPanel.tsx` com a composição de `contracts/destinations.md` §2, de cima para baixo — cabeçalho com o ícone do papel `queue` em `--accent-text`, a fila (ou o convite), o aviso sobre `--accent-tint` com o ícone `hint`, a fotografia com o véu por tema e a legenda —, com o marcador de cada item trazendo o glifo do provedor **na cor da marca** sobre substrato neutro, nunca preenchido com cor de marca; remover `src/features/destinations/MoodPanel.tsx`
- [X] T034 [US4] Trocar em `src/app/Shell.tsx` o painel da etapa Destinos de `MoodPanel` para `ExecutionOrderPanel`, preservando `--side-panel-width` e o `flex-wrap` que faz o painel descer em largura estreita (FR-020)
- [X] T035 [US4] Remover de `src/features/destinations/DestinationsStep.tsx` o parágrafo que explica a ordem de execução (FR-019) e mover os adesivos para a coluna primária, abaixo dos cartões de destino, onde o arquivo os põe (research §R6); a contagem de destinos selecionados **permanece** na barra de ações
- [X] T036 [US4] Confirmar que fotografia e adesivos permanecem `alt=""`, `aria-hidden` e `loading="lazy"` (invariante P5), e estender `e2e/decor-loading.spec.ts` para cobrir que cabeçalho, fila, aviso e legenda do painel continuam legíveis sem as imagens, citando FR-018 e SC-006

**Checkpoint**: US4 completa. O painel deixou de ser decoração e a ordem aparece uma vez só.

---

## Phase 7: User Story 5 - Reconhecer o estado da conta no cartão de destino (Priority: P2)

**Goal**: cada cartão de destino mostra, sob o rótulo, o estado da conta daquele serviço,
com a mesma altura nos três estados, e o controle de seleção à direita como marca de
verificação.

**Independent Test**: cadastrar os dois Client IDs, conectar apenas um serviço e conferir
que o cartão conectado nomeia a conta, o outro diz quando a autorização vai acontecer, e os
dois têm a mesma altura.

### Tests for User Story 5

- [X] T037 [P] [US5] Acrescentar em `tests/components/destinations.spec.tsx` os três estados da linha secundária — sessão ativa nomeia a conta, credencial sem sessão diz quando a autorização acontece, sem credencial mantém o motivo e o atalho —, a asserção de que o cartão ocupa a mesma altura nos três (FR-021, FR-021a), a asserção de que a marca de verificação é o último filho do cartão e recebe o estado preenchido quando o destino está selecionado (FR-023), e a asserção de que o cartão selecionado carrega contorno de acento **e** substrato `--accent-tint`, contra contorno `--rule` e `--surface` no não selecionado (FR-024)
- [X] T038 [P] [US5] Estender `e2e/keyboard.spec.ts` para cobrir que Tab alcança o controle de cada cartão, o foco é visível na marca de verificação, Espaço alterna a seleção e o rótulo continua clicável, citando FR-025 e FR-033

### Implementation for User Story 5

- [X] T039 [US5] Acrescentar em `src/i18n/pt-BR.ts` os textos dos três estados da linha secundária do cartão, incluindo o que diz **quando** a autorização acontece — ao executar aquele serviço
- [X] T040 [US5] Reescrever a anatomia do cartão em `src/features/destinations/DestinationSelector.tsx` conforme `contracts/destinations.md` §3: distintivo à esquerda, rótulo "Criar no {Serviço}" em `--text-section` sobre `--ink`, linha secundária em `--text-data` sobre `--ink-muted`, e o controle à direita
- [X] T041 [US5] Fazer a linha secundária ocupar a **mesma faixa** nos três estados em `src/features/destinations/DestinationSelector.tsx`: o bloco de motivo + atalho que hoje aparece e some passa a ocupar a faixa da linha secundária, em vez de altura reservada e vazia (research §R10 — reservar espaço sem escrever nada é o buraco que FR-011 recusa)
- [X] T042 [US5] Trocar em `src/features/destinations/DestinationSelector.tsx` a apresentação do controle: o `<input type="checkbox">` continua sendo o controle real com `sr-only`, e a marca de verificação visível é um `<span aria-hidden>` irmão estilizado por `peer-checked:` e `peer-focus-visible:`, mantendo `<label htmlFor>` e `aria-describedby` (FR-023, FR-025)
- [X] T043 [US5] Distinguir o cartão selecionado por contorno `--accent-text` **e** substrato `--accent-tint`, contra contorno `--rule` e substrato `--surface` no não selecionado, em `src/features/destinations/DestinationSelector.tsx` (FR-024)

- [X] T043a [US5] Estender `e2e/theme.spec.ts` às superfícies criadas nesta feature — painel "Ordem de execução" (US4), distintivo do cartão de destino e cartão reorganizado (US5) —, verificando que os dois temas mantêm estrutura, composição e estados idênticos e que a divergência é **cromática apenas** (FR-036). É o único portão que exercita a troca por `[data-theme]` com CSS real, e portanto o único que mede os tokens derivados novos; jsdom não resolve `color-mix`. **Depende de US4 ter sido implementada** — o painel precisa existir

**Checkpoint**: US5 completa. O cartão tem a anatomia do arquivo e não pula quando a sessão
muda.

---

## Phase 8: User Story 6 - Ler os mesmos textos do design (Priority: P3)

**Goal**: os textos visíveis correspondem aos do arquivo, e a correspondência passa a ser
verificada por máquina a cada `npm test` — o método, não a atenção, é o que falhou na 007.

**Independent Test**: rodar `npx vitest run tests/unit/design-text-fidelity.spec.ts` e
confirmar que todo item adotado renderiza exatamente a string do arquivo e que nenhum item
está sem `chave` e sem `motivo`.

### Tests for User Story 6

- [X] T044 [P] [US6] Criar `tests/unit/design-text-fidelity.spec.ts` implementando os sete passos de `contracts/text-inventory.md` §3: resolve `chave` em `t` (chave inexistente é falha com o caminho nomeado), aplica `plural` e depois `format` com a `amostra`, compara com `design` caractere a caractere, exige `motivo` não vazio em `mantido-diferente`, verifica que as quatorze telas estão representadas, **e a direção inversa** — toda chave de `t` coberta por item de inventário ou por entrada de exclusão, com chave descoberta falhando pelo caminho nomeado, e exclusão por prefixo recusada em ramo que o design desenha — citando FR-030, FR-030a, FR-030b e SC-001
- [X] T045 [P] [US6] Estender `tests/unit/rail-composition.spec.ts` com os casos de FR-027 a FR-029: cada etapa neutra e derivada; a derivação valendo igualmente em degrau concluído, corrente **e à frente** da etapa corrente; a etapa Destinos derivando **com ela própria como etapa corrente** e com a fila ainda vazia (AC-4 da US6 — o caso que o defeito da fonte esconderia); a etapa Destinos continuando derivada ao voltar para Configuração (AC-5); e a etapa Destinos **não** afirmando escolha nenhuma antes da escolha (FR-029)

### Implementation for User Story 6

- [X] T046 [US6] Criar `tests/fixtures/design-inventory.json` a partir do levantamento de T001, no esquema de `contracts/text-inventory.md` §2, cobrindo as quatorze telas, com cada texto marcado `adotado` (com `chave`, e `amostra` / `plural` quando o template interpola) ou `mantido-diferente` (com `motivo` escrito) — texto repetido entre telas entra uma vez só, e nome próprio de exemplo entra como `amostra`, nunca como item
- [X] T046a [US6] Criar `tests/fixtures/design-inventory-exclusions.json` no esquema de `contracts/text-inventory.md` §2.1, classificando **toda** chave de `t` que não tenha item no inventário: uma entrada por ramo que o arquivo de design não desenha (erros, estados de revisão, avisos de cota, selo de versão, diálogos), cada uma com o motivo escrito. Os ramos que o design desenha — `rail.`, `steps.`, `destinations.`, `queue.`, `connectionChip.`, `app.` e o da linha de contexto — **não** podem ser excluídos por prefixo e são classificados chave a chave no inventário (T046)
- [X] T047 [US6] Adotar em `src/i18n/pt-BR.ts` a assinatura "Texto → Spotify · YouTube" em `app.subtitle`, mantendo o nome do produto "Importador de Playlist por Texto" e registrando essa manutenção como item `mantido-diferente` no inventário (FR-026)
- [X] T048 [US6] Adotar em `src/i18n/pt-BR.ts` os textos das linhas de apoio da trilha conforme a tabela de FR-027 — "Suas credenciais", "Preferências salvas", "Cole a lista de músicas", "Criação e resultado", "O que aconteceu em cada serviço" — e os demais textos que o levantamento marcou como adotados
- [X] T049 [US6] Remover a guarda `if (state !== 'done') return { kind: 'neutral' }` de `supportFor` em `src/domain/rail/index.ts`, deixando `state` de ser lido pela derivação (FR-028), e acrescentar `servicesFinished` ao `RailSnapshot`, passando a etapa Serviço a derivar da contagem de execuções **encerradas** em vez da contagem de destinos (`data-model.md` §3, research §R7)
- [X] T050 [US6] Em `src/app/StepRail.tsx:140-145`, trocar a fonte de `destinations` de `queue.order` para `destinations.selected` — a fila só é construída ao sair da etapa Entrada, e FR-028/AC-4 exige derivar com a etapa Destinos corrente (`data-model.md` §3, mudança 3) — e alimentar `servicesFinished` com `runsInOrder(queue).filter(isFinished).length`, leitura da store, sem tocar em `src/domain/run/machine.ts`
- [X] T051 [US6] Rebaselinar `tests/fixtures/i18n-pt-BR.snapshot.json` com `ATUALIZAR_I18N=1 npx vitest run tests/unit/i18n-stability.spec.ts` e reescrever o docblock de `tests/unit/i18n-stability.spec.ts`: ele deixa de afirmar que a feature não muda palavra nenhuma — verdade na 007, falso agora — e passa a afirmar que mudança de texto é deliberada e aparece no diff do instantâneo (research §R9)

**Checkpoint**: todas as histórias entregues. Divergência de texto passa a falhar em algum
lugar.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: fechar o portão e registrar o que a máquina não verifica.

- [X] T052 Rodar o portão local completo — `npm run lint`, `npm run typecheck`, `npm test` — e corrigir o que falhar sem afrouxar regra de lint nem alterar teste de comportamento
- [X] T053 Rodar `npm run test:e2e` nos dois projetos e confirmar SC-007 em `e2e/narrow-viewport.spec.ts` (nenhuma rolagem horizontal em 375 px) e SC-009 (nenhum teste de comportamento mudou de resultado); qualquer teste de fluxo, validação, cota, retomada ou armazenamento que tenha precisado ser editado é registrado com a justificativa em `specs/008-design-fidelity-pass/checklists/design-fidelity.md`
- [X] T054 [P] Atualizar `docs/style-guide.md` com o substrato de identidade por provedor, a exceção nomeada de FR-004 e a regra única de derivação da trilha (FR-028), corrigindo o guia onde ele descrever o código antigo — o guia **descreve** o código, e divergência se resolve corrigindo o guia
- [X] T055 Executar a conferência manual de forma de `specs/008-design-fidelity-pass/checklists/design-fidelity.md` tela a tela, **nos dois temas e nas duas larguras**, registrando o desfecho de cada item (SC-011)
- [X] T056 Percorrer os sete cenários de [quickstart.md](./quickstart.md) e confirmar cada critério de desqualificação, incluindo a execução contra o `dist/` construído (`npm run build && npm run preview`, `E2E_BASE_URL=http://127.0.0.1:4173 npx playwright test`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências — começa imediatamente
- **Foundational (Phase 2)**: depende do Setup apenas por conveniência de revisão; **bloqueia US1 e US5**
- **US1 (Phase 3)**: depende de Phase 2
- **US2 (Phase 4)**: depende do Setup (T001, T002 fornecem as superfícies do arquivo); independente de Phase 2
- **US3 (Phase 5)**: independente de Phase 2 e de US1/US2
- **US4 (Phase 6)**: independente de Phase 2; toca `Shell.tsx`, que US3 também toca (T027 × T034)
- **US5 (Phase 7)**: depende de Phase 2 e de US1 (T012 cria o distintivo que T040 reorganiza) — **mesmo arquivo**
- **US6 (Phase 8)**: depende do Setup (T001 → T046); T046 e T046a dependem de todas as chaves de i18n criadas em US3, US4 e US5 estarem no dicionário — a cobertura inversa de SC-001 classifica o dicionário inteiro, e classificar antes de ele estar completo é retrabalho garantido
- **T043a (fim da US5)**: depende de **US4 ter sido implementada** — o painel precisa existir para o portão de tema alcançá-lo
- **Polish (Phase 9)**: depende de todas as histórias desejadas

### User Story Dependencies

- **US1 (P1)**: após Phase 2. Sem dependência de outra história.
- **US2 (P1)**: após Setup. Sem dependência de outra história.
- **US3 (P1)**: sem dependência de outra história.
- **US4 (P2)**: sem dependência de outra história; coordena com US3 em `src/app/Shell.tsx`.
- **US5 (P2)**: **após US1** — as duas editam `src/features/destinations/DestinationSelector.tsx`.
- **US6 (P3)**: o inventário (T046) e a lista de exclusões (T046a) fecham por último, porque só então todas as chaves existem. As tarefas de trilha (T045, T049, T050) são independentes e podem sair antes.

### Within Each User Story

- Os testes vêm antes da implementação e devem **falhar** antes dela
- Módulo puro antes do componente que o consome (T025 antes de T027; T031 antes de T033)
- **T027 antes de T028, sem exceção**: T028 retira o `role="status"` do `QueueIndicator`, e
  T027 é quem o instala no `StepContextLine`. Invertida, a ordem deixa a posição na fila sem
  anúncio nenhum entre as duas tarefas
- Texto no dicionário antes da superfície que o usa (T026, T032, T039)
- História completa antes de passar à prioridade seguinte

### Parallel Opportunities

- **Phase 2**: T005, T006 e T008 em paralelo; T003 → T004 → T007 em sequência
- **US1**: T010 e T011 juntos; T013 e T014 juntos (arquivos diferentes)
- **US3**: T022, T023 e T024 juntos
- **US4**: T029 e T030 juntos
- **US5**: T037 e T038 juntos
- **US6**: T044 e T045 juntos
- **Entre histórias**: US2, US3 e US4 podem correr em paralelo com US1 se houver quem as toque — US5 não, porque compartilha arquivo com US1
- **Cuidado com colisão de arquivo**: `tests/components/destinations.spec.tsx` é tocado por T010, T017, T030 e T037; `src/i18n/pt-BR.ts` por T026, T032, T039, T047 e T048; `src/features/destinations/DestinationSelector.tsx` por T012 e T040–T043. Nenhum desses pares recebe `[P]`.

---

## Parallel Example: User Story 3

```bash
# Os três testes da US3 tocam arquivos diferentes e saem juntos:
Task: "Criar tests/unit/header-context.spec.ts cobrindo a tabela de FR-009"
Task: "Acrescentar em tests/components/shell.spec.tsx as tintas do nome e do complemento"
Task: "Acrescentar em tests/a11y/steps.spec.tsx a posição anunciada uma vez só"
```

## Parallel Example: Phase 2

```bash
Task: "Acrescentar os dois pares em src/domain/theme/approvedPairs.ts e mover a contagem para 29"
Task: "Ajustar eslint-rules/index.js com brandTintOutsideCard"
Task: "Acrescentar a asserção de ponto único em tests/unit/no-orphan-tokens.spec.ts"
```

---

## Implementation Strategy

### MVP First (as três P1)

1. Phase 1: Setup — o arquivo de design entra no repositório como material conferível
2. Phase 2: Foundational — os tokens e a fechadura
3. Phase 3: US1 — a cor de marca
4. **PARE e VALIDE**: cenário 1 do quickstart, nos dois temas
5. Phase 4: US2 e Phase 5: US3 — a moldura e a linha de contexto

As três P1 juntas já entregam o que o pedido nomeia primeiro: a cor, a caixa em volta de
"Para onde vai a playlist?" e a saudação.

**O que o MVP não entrega, e precisa ser dito**: FR-030b — a verificação executável de
fidelidade textual — só existe a partir de T044, na US6. Parar na Phase 5 entrega as três
P1 e **não** entrega a garantia que motivou esta feature; a fidelidade dos textos volta a
depender de conferência a olho até a US6 fechar. É um corte legítimo de entrega, não um
escopo completo.

### Entrega incremental

1. Setup + Foundational → base pronta
2. US1 → conferir cenário 1 → demonstrável
3. US2 → conferir cenário 2
4. US3 → conferir cenário 3
5. US4 → conferir cenário 4
6. US5 → conferir cenário 5
7. US6 → conferir cenário 6 — e a partir daqui a fidelidade textual falha sozinha
8. Polish → cenário 7 e a conferência de forma

### Estratégia com mais de uma pessoa

1. Setup e Foundational juntos
2. Depois: A em US1 → US5 (mesmo arquivo, mesma pessoa); B em US2 → US6; C em US3 → US4
   (coordenando `Shell.tsx`)

---

## Notes

- `[P]` = arquivos diferentes, sem dependência pendente
- Todo teste novo cita o `FR-xxx` / `SC-xxx` que garante, no nome ou em comentário
- Comentário explica **por quê**, com referência ao requisito ou à seção do research
- `import type` obrigatório; nenhum arquivo novo ramifica por `ProviderId` fora de
  `src/services/providers/{provider}/` — cor de marca e substrato entram como mapas de
  literais, dado e não `if`
- Commit por tarefa ou por grupo lógico, em pt-BR
- Pare em qualquer checkpoint para validar a história isoladamente
