---
description: 'Lista de tarefas da feature 007 — Readequação da interface ao design oficial'
---

# Tasks: Readequação da interface ao design oficial

**Input**: documentos de desenho em `/specs/007-official-design-alignment/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`,
`contracts/tokens.md`, `contracts/shell.md`, `contracts/icons.md`,
`contracts/decor.md`, `contracts/token-migration.md`, `quickstart.md`

**Tests**: incluídos. Não por opção de método, mas porque o Princípio IV da
constituição os torna obrigatórios — todo FR com consequência observável precisa
de verificação executável — e porque `contracts/token-migration.md` documenta o
modo de falha que só um teste pega: **utilitário Tailwind inexistente não é
erro**, a classe simplesmente deixa de emitir CSS e a tela fica sem estilo sem
que nada falhe.

**Organization**: tarefas agrupadas por história de usuário, na ordem de
prioridade da spec. Cada fase é um incremento entregável e testável sozinho.

## Format: `[ID] [P?] [Story] Descrição`

- **[P]**: pode rodar em paralelo (arquivos distintos, sem dependência pendente)
- **[Story]**: a qual história a tarefa pertence (US1…US5)
- Todo caminho de arquivo é explícito
- **89 tarefas.** Duas usam sufixo de letra (`T043a`, `T078a`) por terem sido acrescentadas depois da análise de consistência: renumerar as 87 originais invalidaria todas as referências cruzadas deste documento. A spec já usa o mesmo padrão (`SC-001a`, cenário `2a`)

## Path Conventions

Projeto único, aplicação web de página única. `src/`, `tests/`, `e2e/`, `docs/` e
`eslint-rules/` na raiz do repositório, conforme a seção **Project Structure** do
`plan.md`.

---

## Phase 1: Setup (Infraestrutura compartilhada)

**Purpose**: resolver a dependência nova e as incógnitas que travariam qualquer
outra frente — os nomes de exportação dos ícones e a linha de base do pacote.

- [ ] T001 Medir o tamanho do pacote **antes** de `react-icons` com `npm run build` e registrar os números na linha "Antes" da tabela de `specs/007-official-design-alignment/contracts/icons.md` §5 (SC-018 — a medição precisa acontecer antes da instalação, ou perde o comparativo)
- [ ] T002 Acrescentar `react-icons` às `dependencies` de `package.json` com versão fixada e rodar `npm install`; **não** acrescentar nada às `devDependencies` (FR-055, Complexity Tracking do plano)
- [ ] T003 Resolver os **dezoito** nomes de exportação contra a versão instalada — os dezesseis papéis de biblioteca de `contracts/icons.md` §1 (quatorze de Lucide, dois de Phosphor) mais os dois por analogia da §2, `uncertain` e `missing`, que a §2 descreve por prosa e ainda não têm nome fixado — e registrar o nome exato de cada um nas duas tabelas; falhar explicitamente e registrar a divergência se algum não existir. O papel `brand` **não** entra na resolução: ele vem de `src/assets/imgs/Logo Mark.png`, não da biblioteca (FR-055, FR-056, FR-060, FR-064, `research.md` §6)
- [ ] T004 [P] Conferir os nomes de arquivo reais em `src/assets/imgs/` — a pasta `src/assets/icons/` foi removida — e corrigir a tabela de `specs/007-official-design-alignment/contracts/decor.md` §1 para os caminhos exatos, inclusive espaços e parênteses no nome da fotografia (FR-034, FR-048)

---

## Phase 2: Foundational (Pré-requisitos bloqueantes)

**Purpose**: repovoar a maquinaria da 005 e criar as três estruturas novas — mapa
de ícones, domínio da trilha e escalas renormalizadas. Nenhuma tela pode ser
migrada antes disto, porque toda tela consome estes nomes.

**⚠️ CRITICAL**: nenhuma história começa antes desta fase terminar.

**Ordem imposta pelo `quickstart.md` §"Ordem sugerida"**: a paleta passa no
contraste **antes** de qualquer componente ser tocado. Se ela não passa, nada
adiante importa.

### Camada de tokens

- [ ] T005 Repovoar `src/styles/tokens.css` com os 18 tokens de cor de `contracts/tokens.md` §1, nos três blocos existentes — `:root` (Papel), `[data-theme='dark']` (Noite) e `@media (prefers-color-scheme: dark) :root:not([data-theme])` — incluindo os quatro novos `--surface-zone`, `--state-live`, `--brand-spotify` e `--brand-youtube`, e **sem** criar `--ink-faint` (FR-021 a FR-024, FR-032, FR-033, `research.md` §3)
- [ ] T006 Substituir a lista de pares de `src/domain/theme/approvedPairs.ts` pelas 27 combinações de `contracts/tokens.md` §2, com `foreground`, `background`, `usage` e `where` preenchidos por par (FR-002, SC-002)
- [ ] T007 Estender `tests/unit/contrast.spec.ts` para percorrer os 27 pares nos dois temas lendo os valores de `src/styles/tokens.css`, falhando por par **reprovado ou ausente**, e para falhar quando um token de cor existir em apenas um tema (SC-002, SC-005)
- [ ] T008 Ajustar os valores em `src/styles/tokens.css` até `tests/unit/contrast.spec.ts` passar inteiro — em especial escurecendo um degrau adicional as variantes claras de `--brand-spotify`, `--state-live`, `--state-confident`, `--state-missing` e `--accent-text`, que pousam entre 3,01 e 4,55 na tabela — e registrar cada ajuste com sua razão na tabela de `contracts/tokens.md` §1 (FR-003, `research.md` §4)

### Escalas finitas

- [ ] T009 Renormalizar a escala tipográfica no `@theme` de `src/styles/index.css` para os 6 degraus de `contracts/tokens.md` §3: `--text-body` para 0.875rem, `--text-section` para 1rem, `--text-step` para 1.5rem, novo `--text-page` 2rem, e **remover** `--text-item`. **Sem tocar** no `@font-face`, no subset nem na substituta de métrica compatível, que FR-027 manda preservar sem alteração (FR-025, FR-026, FR-027, `contracts/token-migration.md` §4)
- [ ] T010 Substituir toda ocorrência do utilitário `text-item` por `text-body` em `src/**/*.tsx` e `src/styles/index.css`, sem exceção — o nome sai da escala e o utilitário deixa de emitir CSS em silêncio (`contracts/token-migration.md` §4)
- [ ] T011 [P] Renormalizar a escala de raio no `@theme` de `src/styles/index.css` para os 5 degraus: `--radius-control` 8px, `--radius-card` 12px, novos `--radius-hair` 2px e `--radius-panel` 16px, `--radius-pill` inalterado (FR-025, `contracts/token-migration.md` §6.5)
- [ ] T012 [P] Acrescentar o degrau `--spacing-0.5` (0.125rem) ao `@theme` de `src/styles/index.css`, preservando os sete degraus existentes com nome e valor (FR-025, `contracts/tokens.md` §4)
- [ ] T013 Ajustar as medidas de layout em `src/styles/index.css`: `--container-measure` para 42.5rem, novos `--rail-width` 18.5rem, `--side-panel-width` 20.625rem e `--topbar-height` 4.25rem como propriedades customizadas simples, novo `--breakpoint-shell` com valor provisório de 64rem, e **remover** `--gutter` e `--breakpoint-gutter` (FR-020, FR-029, `contracts/tokens.md` §5)
- [ ] T014 Remover o `@utility gutter-row` de `src/styles/index.css` e toda ocorrência da classe e da variante `gutter:` em `src/**/*.tsx`, incluindo as referências no comentário de `src/app/Wizard.tsx` (FR-029, `research.md` §11)
- [ ] T015 Reduzir o `@utility data-numeral` de `src/styles/index.css` ao papel de numeral tabular — mantendo `tabular-nums` e o corpo tipográfico — e atualizar seu comentário para registrar que ele **não** é mais parte da goteira; nenhuma remoção, sob pena de quebrar o alinhamento de coluna das telas de resultado (`contracts/token-migration.md` §6.1)

### Mapa de ícones

- [ ] T016 Criar `src/ui/icons.ts` com o mapa único de papel → componente para os dezesseis papéis de biblioteca de `contracts/icons.md` §1 mais os dois por analogia (`uncertain`, `missing`) da §2, importando exclusivamente pelos subcaminhos de conjunto de `react-icons` e exportando o tipo literal dos papéis. O papel `brand` entra no mesmo mapa mas resolve para `src/assets/imgs/Logo Mark.png` — arte, não componente (FR-055, FR-056, FR-059, FR-060, FR-063, FR-064)
- [ ] T017 Criar `src/ui/Icon.tsx` como envoltório único de consumo: recebe o papel, herda `currentColor`, dimensiona pela escala tipográfica do contexto, e alterna entre `aria-hidden` e nome acessível conforme acompanhe rótulo ou seja o único conteúdo do controle. Tratar o caso único da marca, que é arte e **não** herda `currentColor` (FR-051, FR-058, FR-060, SC-017)
- [ ] T018 [P] Criar `tests/unit/icon-roles.spec.ts` verificando que todo papel de `src/ui/icons.ts` resolve para um componente definido — ou, no caso único da marca, para um recurso de arte local —, que não há papel órfão nem componente sem papel, e falhando **com o papel nomeado** quando um nome de exportação mudar de versão (FR-059, SC-016)

### Domínio da trilha

- [ ] T019 Criar `src/domain/rail/index.ts` puro, exportando `RailStep[]` a partir do instantâneo `{ current, destinations, lineCount, credentialsReady }`, implementando as seis regras de `data-model.md` §3: Resumo condicional, numeração contígua atribuída **depois** da filtragem, linha derivada só quando há valor, degrau pendente nunca deriva, linha da etapa atual podendo diferir da concluída, e fases do ciclo de serviço nunca virando degrau — sem DOM, sem store, sem I/O (Princípio III, FR-012 a FR-014, FR-066, FR-067)
- [ ] T020 [P] Criar `tests/unit/rail-composition.spec.ts` cobrindo os seis cenários da tabela de `quickstart.md` §4, com atenção ao caso que separa a implementação do mockup: na Configuração, sem destino escolhido, a linha de apoio de Destinos é **neutra** e não nomeia provedor nenhum (FR-012, FR-013, FR-014, FR-066, FR-067)

### Dicionário e portões de lint

- [ ] T021 Acrescentar a `src/i18n/pt-BR.ts` os rótulos novos da casca — título "Etapas", linhas de apoio neutras e derivadas de cada etapa, rótulos dos três estados do chip de conexão, e os textos de estado e de bloqueio da barra de ações (Princípio de idioma, `tp/no-ui-text-literals`)
- [ ] T022 Atualizar `tests/fixtures/i18n-pt-BR.snapshot.json` com as chaves novas, para que `tests/unit/i18n-stability.spec.ts` volte a passar (consequência de T021; o portão é `tests/unit/i18n-stability.spec.ts`)
- [ ] T023 Atualizar `eslint-rules/index.js`: ajustar `tp/no-raw-visual-values` ao novo conjunto de tokens e acrescentar regra que recusa qualquer importação de `react-icons` fora de `src/ui/icons.ts` e qualquer importação do índice raiz da biblioteca (FR-045, FR-056, FR-059, SC-016)

**Checkpoint**: paleta verificada nos dois temas, escalas finitas renormalizadas,
mapa de ícones resolvido e domínio da trilha testado sem DOM. As histórias podem
começar.

---

## Phase 3: User Story 1 - A aplicação se apresenta como um produto (Priority: P1) 🎯 MVP

**Goal**: barra superior permanente com marca, chips de conexão por provedor e
controle de tema, idêntica em todas as etapas.

**Independent Test**: abrir a aplicação em cada uma das cinco etapas, com zero,
um e dois provedores conectados, e verificar que a barra mostra marca, chips
coerentes com o estado real e o controle de tema — sem que nenhuma outra parte da
tela tenha sido redesenhada.

- [ ] T024 [P] [US1] Criar `src/features/connect/ConnectionChip.tsx` com os três estados de `contracts/shell.md` §3, distinguíveis por rótulo e forma além da cor, usando `--brand-*` só como acento identificador do ícone e **nunca** exibindo identificador de conta no estado `no-credential` (FR-007, FR-008, FR-009, FR-023, FR-042)
- [ ] T025 [US1] Criar `src/app/Topbar.tsx` com marca, chips de conexão, divisor `--rule-strong` decorativo e controle de tema, sobre substrato `--surface-zone`, garantindo que nome de conta longo trunque visualmente sem empurrar o controle de tema para fora (FR-006, FR-040, `contracts/shell.md` §2)
- [ ] T026 [US1] Criar `src/app/Shell.tsx` com a zona de barra superior e a área principal, na ordem de DOM igual à ordem visual de leitura, deixando o encaixe da trilha e da barra de ações declarado mas ainda vazio (FR-006, FR-020, FR-040)
- [ ] T027 [US1] Redesenhar `src/features/theme/ThemeControl.tsx` para consumir os papéis `theme-light`, `theme-dark` e `theme-system` de `src/ui/icons.ts` no lugar dos SVGs escritos à mão, preservando literalmente o padrão de `radiogroup` e a **única** parada de tabulação (FR-030, FR-031, FR-040)
- [ ] T028 [US1] Reescrever `src/app/Wizard.tsx` para deixar de montar o cabeçalho — sai o `<header>` com título, `ThemeControl`, `SessionHeader` e `ResetFlow`; entra a renderização da tela corrente dentro do `Shell`. **`StepIndicator` permanece renderizado sob o `Shell`** até T039 substituí-lo por `StepRail`: o teste independente da US1 promete que nenhuma outra parte da tela foi redesenhada, e deixar o fluxo sem indicação de etapa entre as fases 3 e 4 quebraria isso (FR-006, FR-029)
- [ ] T029 [US1] Ajustar `src/app/App.tsx` para envolver o `Shell`, preservando o link de pular para o conteúdo e o alvo `#conteudo` (FR-040)
- [ ] T030 [US1] Remover `src/features/connect/SessionHeader.tsx` e toda importação dele, absorvido pelo `ConnectionChip` (`contracts/token-migration.md` §6.2)
- [ ] T031 [US1] Criar `tests/components/connection-chip.spec.tsx` migrando os casos preservados de `tests/components/session-header.spec.tsx` e acrescentando os três estados, a ausência de identificador em `no-credential` e a coexistência de dois chips com estados diferentes (FR-008, FR-009)
- [ ] T032 [US1] Remover `tests/components/session-header.spec.tsx` depois que T031 estiver verde, para que nenhum caso se perca na migração (fecha a migração de T031; `contracts/token-migration.md` §6.2)
- [ ] T033 [US1] Criar `tests/components/shell.spec.tsx` com as asserções estruturais da barra superior: presença e posição idêntica nas cinco etapas, nos dois temas e nas duas larguras, e nenhuma propriedade com valor literal (FR-006, FR-071, FR-074, SC-001)
- [ ] T034 [US1] Atualizar `tests/components/theme-control.spec.tsx` para a nova marcação, mantendo a asserção de parada de tabulação única e de troca sem recarregar (FR-031, FR-040)

**Checkpoint**: a barra superior responde "estou conectado?" sem navegação, em
todas as etapas, sobre o esqueleto ainda antigo do conteúdo.

---

## Phase 4: User Story 2 - As etapas viram uma trilha lateral persistente (Priority: P1)

**Goal**: trilha vertical "Etapas" à esquerda, em todas as etapas, com numeral,
nome, linha de apoio e "Recomeçar do início" no rodapé — e seu colapso em
resumo compacto na largura estreita.

**Independent Test**: percorrer o fluxo do começo ao fim verificando, a cada
etapa, que a trilha marca a posição correta, descreve as etapas já decididas com
o que foi decidido, e que "Recomeçar do início" continua acessível e continua
pedindo confirmação antes de descartar.

**Depende de**: T026 (o `Shell` precisa existir para ganhar a zona da trilha).

- [ ] T035 [US2] Criar `src/app/StepRail.tsx` desenhando o que `src/domain/rail/` devolve, com a anatomia do indicador de `contracts/shell.md` §4 — disco preenchido / tingido / vazado, conector vertical `aria-hidden` — e **sem decidir nada** sobre composição ou numeração; transições suprimidas sob `prefers-reduced-motion` (Princípio III, FR-010, FR-011, FR-035, FR-042)
- [ ] T036 [P] [US2] Criar `src/app/StepSummary.tsx` informando posição no fluxo, nome da etapa atual e progresso, **sem** estado de abertura, controle acionável novo ou parada de tabulação adicional (FR-037, FR-052)
- [ ] T037 [US2] Mover `src/app/ResetFlow.tsx` para o rodapé da trilha em largura ampla e para a barra superior em largura estreita, preservando integralmente a confirmação de descarte da feature 006 (FR-015, FR-054, FR-065)
- [ ] T038 [US2] Estender `src/app/Shell.tsx` com a zona da trilha e a troca por `StepSummary` abaixo de `--breakpoint-shell`, reposicionando o painel lateral para baixo da coluna primária na largura estreita sem alterar a ordem de leitura (FR-037, FR-053, `contracts/shell.md` §7)
- [ ] T039 [US2] Remover `src/app/StepIndicator.tsx` depois que `StepRail` herdar os três comportamentos acessíveis conquistados: a régua `aria-hidden` vira o conector vertical, a contagem "N de T" vira o `ordinal` do domínio, e o `aria-current="step"` permanece literal (FR-029, FR-041, `contracts/token-migration.md` §6.3)
- [ ] T040 [P] [US2] Criar `tests/components/step-rail.spec.tsx` verificando que cada degrau carrega o `ordinal` e o `state` que o domínio devolveu, que a distinção entre concluída, atual e pendente sobrevive sem cor, e que a etapa Resumo some com destino único mantendo a numeração contígua (FR-011, FR-013, FR-042)
- [ ] T041 [US2] Estender `tests/components/shell.spec.tsx` para asserir que existe **exatamente um** elemento com `aria-current="step"` por etapa, que abaixo do ponto de corte a trilha some e o `StepSummary` aparece, e que o `StepSummary` não acrescenta nenhum elemento com `role` interativo (FR-037, FR-041, FR-052, FR-074)
- [ ] T042 [US2] Medir a largura mínima em que a trilha de 18.5rem e a coluna de leitura de 42.5rem coexistem sem aperto, fixar `--breakpoint-shell` em `src/styles/index.css` com o valor medido e registrá-lo na tabela de `contracts/tokens.md` §5, que hoje o marca como "a medir" (`research.md` §10)
- [ ] T043 [US2] Estender `e2e/narrow-viewport.spec.ts` para cobrir o colapso da trilha, a permanência da ação de recomeçar na barra superior, a ausência de rolagem horizontal de 320px a 1920px, e a legibilidade das três zonas a 200% de zoom de texto sem corte de conteúdo (FR-038, FR-054, SC-007, Edge Case "Zoom de texto a 200%")
- [ ] T043a [US2] Estender `e2e/keyboard.spec.ts` para a casca nova: ordem de tabulação barra superior → trilha → conteúdo → barra de ações, foco visível desenhado por `outline` em todo controle movido ou criado por esta feature, e o `ThemeControl` continuando a ser uma parada única nos dois temas (FR-039, FR-040, SC-008)
- [ ] T044 [US2] Rodar `tests/components/reset-flow.spec.tsx` e ajustar **apenas seletores**, jamais expectativas de comportamento — se a expectativa precisar mudar, a feature saiu do escopo (FR-065, `quickstart.md` §8)

**Checkpoint**: a casca de três zonas está completa. As telas internas podem
migrar uma a uma.

---

## Phase 5: User Story 3 - Destinos e Entrada ganham barra de ações com o motivo do bloqueio (Priority: P2)

**Goal**: faixa no rodapé do conteúdo em Destinos e Entrada — e apenas nelas —
com o estado da etapa por extenso à esquerda e as ações à direita, dizendo o
motivo quando o avanço não é possível.

**Independent Test**: nas duas etapas, verificar que os botões estão na faixa
inferior, que o texto de estado corresponde ao estado real e que o motivo do
bloqueio aparece por escrito — e, no ciclo de serviço, que as ações continuam
onde estavam.

**Depende de**: T038 (a área principal precisa existir para receber a faixa).

- [ ] T045 [US3] Criar `src/app/ActionBar.tsx` com estado em texto à esquerda e ações à direita, avançar como única ação primária em `--accent` sólido com texto `--accent-ink`, retornar como ação discreta, e omissão do retorno na primeira etapa; transições suprimidas sob `prefers-reduced-motion` (FR-016, FR-017, FR-019, FR-035, `contracts/shell.md` §6)
- [ ] T046 [US3] Acrescentar a `src/i18n/pt-BR.ts` os textos de estado e de motivo do bloqueio das duas etapas — quantidade de destinos selecionados, contagem de linhas coladas e a razão de o avanço não estar disponível — e atualizar `tests/fixtures/i18n-pt-BR.snapshot.json` (FR-018)
- [ ] T047 [P] [US3] Ligar a `ActionBar` a `src/features/destinations/DestinationsStep.tsx`, movendo para a faixa as ações que hoje vivem dentro da tela (FR-016)
- [ ] T048 [P] [US3] Ligar a `ActionBar` a `src/features/input/InputScreen.tsx`, movendo para a faixa as ações que hoje vivem dentro da tela (FR-016)
- [ ] T049 [US3] Fazer `src/app/Shell.tsx` renderizar o encaixe da barra de ações **apenas** para Destinos e Entrada, com a lista fechada em um único ponto do código (FR-016, FR-061)
- [ ] T050 [P] [US3] Criar `tests/components/action-bar.spec.tsx` cobrindo os cinco cenários de aceitação da história: estado vazio sem avanço, estado com dois destinos, motivo por escrito com lista vazia, indisponibilidade perceptível sem cor, e ausência de retorno inoperante na primeira etapa (FR-016 a FR-019)
- [ ] T051 [US3] Estender `tests/components/shell.spec.tsx` para asserir que a barra de ações **não existe** em Configuração, no ciclo de serviço e no Resumo, e que "Pular o {serviço}" permanece dentro do cartão da fase (FR-061, FR-062, `contracts/shell.md` §8)

**Checkpoint**: a validação virou texto legível exatamente nas duas etapas em que
o usuário pode ficar preso sem entender por quê.

---

## Phase 6: User Story 4 - Cada tela adota o vocabulário visual oficial (Priority: P2)

**Goal**: as onze telas com o substrato quase-preto em degraus, o âmbar como
única cor de ação, a nova anatomia de cartões e selos, as cores de marca por
provedor e a decoração — sem resquício da paleta anterior.

**Independent Test**: percorrer as onze telas do design lado a lado com a
aplicação, verificando que cada componente do design tem correspondente com a
mesma anatomia e que nenhum valor visual fora das escalas aparece no código.

**Depende de**: Fase 2 inteira. As tarefas de primitiva (T052–T058) precedem as
de tela, porque toda tela as consome.

### Primitivas do sistema

- [ ] T052 [US4] Redesenhar `src/ui/Button.tsx` com os novos raios e a regra de que preenchimento sólido significa acionável, garantindo que texto claro sobre `--accent` não exista em variante nenhuma (FR-017, FR-022, FR-024)
- [ ] T053 [P] [US4] Redesenhar `src/ui/TextField.tsx` com `--radius-control` 8px, contorno `--rule-strong` e campo focado sobre `--surface-raised` (FR-021, FR-025)
- [ ] T054 [P] [US4] Redesenhar `src/ui/TextArea.tsx` com a mesma anatomia de campo de T053 (FR-025)
- [ ] T055 [P] [US4] Redesenhar `src/ui/Toggle.tsx` consumindo o papel `done` de `src/ui/icons.ts` na caixa de seleção (FR-024, FR-059)
- [ ] T056 [US4] Redesenhar `src/ui/Dialog.tsx` por analogia ao painel mais próximo que o design define — o arquivo não desenha modal algum — e registrar a analogia adotada para o guia de estilo (FR-063, FR-064)
- [ ] T057 [P] [US4] Redesenhar `src/ui/StepHeading.tsx` com `--text-page` e `--text-step`, **sem** repetir a posição no fluxo que a trilha já anuncia (FR-041, `contracts/tokens.md` §3)
- [ ] T058 [P] [US4] Redesenhar `src/ui/CopyButton.tsx`, `src/ui/VersionHintBadge.tsx`, `src/ui/RateLimitWaiting.tsx` e `src/ui/LiveRegion.tsx` pelo vocabulário oficial, por analogia — nenhuma delas é desenhada e nenhuma é removida por isso (FR-063, FR-064)

### Telas

- [ ] T059 [US4] Redesenhar a etapa de Configuração em `src/features/credential/CredentialStep.tsx`, `CredentialForm.tsx`, `MaskedValue.tsx`, `RedirectUriHint.tsx` e `RemoveCredential.tsx`, com os passos numerados do design e as ações **dentro** do cartão que as explica (FR-061)
- [ ] T060 [US4] Redesenhar a etapa de Destinos em `src/features/destinations/DestinationsStep.tsx` e `DestinationSelector.tsx`, com a nova anatomia dos cartões de destino, a cor de marca como acento identificador e o painel lateral de apoio sem roubar a largura de leitura (FR-020, FR-023)
- [ ] T061 [P] [US4] Redesenhar a etapa de Entrada em `src/features/input/InputScreen.tsx` e `ListReduction.tsx` (FR-025)
- [ ] T062 [US4] Redesenhar o ciclo de serviço em `src/features/service/ServiceStep.tsx` e `SkipButton.tsx`, mantendo "Pular o {serviço}" adjacente ao cartão da fase e o comportamento da 006 intacto (FR-061, FR-062)
- [ ] T063 [P] [US4] Redesenhar `src/features/connect/ConnectButton.tsx`, `AuthError.tsx` e `ReauthDialog.tsx`, tratando o pedido de reautorização no meio da execução como superfície preservada por analogia (FR-063, FR-064)
- [ ] T064 [P] [US4] Redesenhar `src/features/quota/QuotaEstimateScreen.tsx`, com a ação de pular adjacente ao cartão de orçamento (FR-062)
- [ ] T065 [US4] Redesenhar a etapa de revisão em `src/features/review/ReviewScreen.tsx`, `MatchRow.tsx`, `StatusBadge.tsx`, `Alternatives.tsx`, `LineEditor.tsx`, `PlaylistConfigForm.tsx` e `SearchProgress.tsx`, mantendo os três estados de correspondência distinguíveis por fundo tingido, contorno, ícone e rótulo — jamais por preenchimento sólido, que continua significando clicável; capas de álbum e miniaturas de terceiros recebem contorno `--rule-strong` para se separarem do substrato quase-preto (par #26, FR-024, FR-042)
- [ ] T066 [P] [US4] Redesenhar `src/features/result/ResultScreen.tsx`, `FailedLines.tsx`, `FolderNotice.tsx` e `RetryRemaining.tsx`, preservando `data-numeral` no alinhamento tabular das colunas (FR-025, `contracts/token-migration.md` §6.1)
- [ ] T067 [P] [US4] Redesenhar `src/features/summary/SummaryScreen.tsx` (FR-025)
- [ ] T068 [P] [US4] Redesenhar `src/features/queue/QueueIndicator.tsx` consumindo o papel `queue` do mapa de ícones (FR-059)
- [ ] T069 [P] [US4] Redesenhar `src/app/DraftRecoveryBanner.tsx` pelo vocabulário oficial (FR-063)
- [ ] T070 [US4] Implementar a saudação personalizada no cabeçalho de conteúdo, degradando para forma impessoal quando nenhuma conta está conectada — sem espaço vazio e sem nome inventado (FR-036)

### Decoração

- [ ] T071 [US4] Criar `src/ui/AmbientBackdrop.tsx` servindo `src/assets/imgs/Ambient Backdrop.png` da própria origem, fora do caminho crítico, com decodificação assíncrona, espaço pré-dimensionado e tratamento distinto por tema — opacidade menor e mistura própria sobre o off-white (FR-034, FR-048, FR-049, FR-050, FR-068, FR-070)
- [ ] T072 [US4] Criar `src/ui/Stickers.tsx` com os onze adesivos de `src/assets/imgs/`, marcados como decorativos, carregados de forma diferida e suprimidos ou estáticos sob `prefers-reduced-motion` (FR-034, FR-035, FR-068)
- [ ] T073 [US4] Incorporar a fotografia de clima ao painel lateral de Destinos em `src/features/destinations/DestinationsStep.tsx`, com sobreposição em degradê própria para cada tema (FR-034, FR-049)
- [ ] T074 [US4] Verificar **cada um** dos onze adesivos **e a marca** (`Logo Mark.png`) sobre o substrato claro e dar variante, contorno ou filtro aos que sumirem — arte composta contra o quase-preto desaparece sobre papel, e nenhum teste automatizado percebe (FR-049, FR-060, `contracts/decor.md` §2)

### Verificação da história

- [ ] T075 [US4] Criar `e2e/decor-loading.spec.ts` verificando, sob rede lenta simulada, que o conteúdo de cada etapa está legível e operável **antes** de qualquer decoração carregar, que nada se desloca quando o recurso chega, e que com imagens desabilitadas todas as etapas permanecem utilizáveis sem buraco (SC-014, SC-019, SC-020)
- [ ] T076 [US4] Estender `e2e/no-remote-origin.spec.ts` para cobrir também recursos decorativos e fonte de ícone, falhando quando qualquer requisição sair para terceiro (FR-048, FR-057, SC-012)
- [ ] T077 [US4] Estender `tests/a11y/steps.spec.tsx` para auditar todas as etapas nos **dois temas** e nas **duas larguras**, e para asserir que nenhum elemento decorativo é anunciado por leitor de tela (SC-003, SC-013)
- [ ] T078 [US4] Estender `tests/components/shell.spec.tsx` com a asserção de token efetivamente aplicado — via propriedade customizada resolvida, não via nome de classe — para as onze telas nos dois temas e nas duas larguras, e com a asserção de que a árvore de zonas e componentes é **idêntica** entre os temas, divergindo apenas em valor de cor (FR-046, FR-071, FR-074, SC-001, SC-004, SC-015)
- [ ] T078a [US4] Dar contorno próprio às três zonas sob `@media (forced-colors: active)` em `src/styles/index.css` e asserir em `tests/components/shell.spec.tsx` que a separação entre elas sobrevive quando o preenchimento translúcido é descartado (FR-028, Edge Case "alto contraste ou cores forçadas")

**Checkpoint**: o resultado parece o design, e as asserções estruturais falham
quando uma zona, um componente ou um token deixa de estar presente.

---

## Phase 7: User Story 5 - O guia de estilo passa a descrever o design oficial (Priority: P3)

**Goal**: `docs/style-guide.md` descrevendo o sistema oficial, com as decisões da
005 marcadas como substituídas em vez de apagadas.

**Independent Test**: pedir a alguém que não implementou a feature para descrever,
só com o guia em mãos, como deve ser um chip de conexão desconectado — e conferir
com a aplicação e com o arquivo de design.

- [ ] T079 [US5] Reescrever `docs/style-guide.md` descrevendo as famílias de cor com seus papéis, as escalas de tipo, espaço, raio e profundidade, e a anatomia e os estados de cada componente — inclusive repouso, foco, hover, ativo, desabilitado, erro e carregando (FR-043, SC-009)
- [ ] T080 [P] [US5] Registrar em `docs/style-guide.md` as decisões da 005 substituídas, **com o motivo**, a partir de `contracts/token-migration.md` §6: a goteira numerada, a coluna única de 46rem, o indicador horizontal, e a tese do raio fechado de 8px que o design oficial reverte para 12px (FR-044)
- [ ] T081 [P] [US5] Registrar em `docs/style-guide.md` a analogia adotada para cada superfície que o design não desenha — diálogo de confirmação, selo de versão, aviso de espera por limite de taxa, selos de correspondência incerta e não encontrada (FR-064, `contracts/icons.md` §2)

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: fechar a migração com o portão que a declara encerrada e conferir o
que nenhum teste pega.

- [ ] T082 Reescrever a denylist de `tests/unit/no-orphan-tokens.spec.ts` a partir de `contracts/token-migration.md` §5, literalmente: resquício da goteira, `text-item`, importação de `@/app/StepIndicator` ou `@/features/connect/SessionHeader`, hex da paleta anterior fora de `tokens.css`, e importação de ícone fora do mapa. **Este teste é o critério objetivo de "a migração terminou"**. FR-060 **não** precisa de entrada na denylist: os nove PNGs que eram ícone de interface foram removidos do repositório em 2026-08-09, e a marca é exceção declarada (FR-029, FR-056, FR-059, FR-060, SC-011, SC-016)
- [ ] T083 [P] Criar `specs/007-official-design-alignment/checklists/design-fidelity.md` com a lista de conferência tela a tela — composição de zonas, hierarquia de componentes, proporção e ritmo do espaçamento, peso tipográfico e alinhamento, e legibilidade da decoração **no tema claro também** — versionada junto com a feature (FR-073)
- [ ] T084 Percorrer as onze telas nos dois temas contra o arquivo de design com `npm run dev`, preencher `specs/007-official-design-alignment/checklists/design-fidelity.md` e não deixar discrepância aberta (SC-001a)
- [ ] T085 Medir o pacote **depois** com `npm run build` e comparar com a linha de base de T001, registrando o resultado na linha "Depois" da tabela de `contracts/icons.md` §5; o acréscimo deve corresponder aos ícones efetivamente usados, não ao conjunto (SC-018)
- [ ] T086 Rodar o portão local completo — `npm run lint`, `npm run typecheck`, `npm test` — e corrigir o que falhar (Fluxo de Desenvolvimento da constituição)
- [ ] T087 Rodar `npm run test:e2e` inteiro e confirmar que os sete arquivos da tabela de `quickstart.md` §8 passam **sem alteração de expectativa**; qualquer expectativa que precise mudar é sinal de que a feature saiu do escopo (FR-005, SC-006, SC-010)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Fase 1)**: sem dependências. T001 precede T002 obrigatoriamente — medir o pacote depois de instalar perde o comparativo.
- **Foundational (Fase 2)**: depende da Fase 1. **Bloqueia todas as histórias.**
- **US1 (Fase 3)**: depende da Fase 2.
- **US2 (Fase 4)**: depende da Fase 2 e de T026 (o `Shell` precisa existir). T039 fecha o que T028 deixou pendente — o `StepIndicator` sobrevive sob o `Shell` entre as duas fases, de propósito.
- **US3 (Fase 5)**: depende da Fase 2 e de T038 (a área principal precisa existir).
- **US4 (Fase 6)**: depende da Fase 2. Independente de US1–US3 no essencial, exceto T060 e T062, que tocam telas que a US3 também toca.
- **US5 (Fase 7)**: depende de US1–US4 estarem decididas; o guia descreve o que existe.
- **Polish (Fase 8)**: depende de todas as histórias desejadas.

### Ordem interna da Fase 2 (imposta, não sugerida)

`T005 → T006 → T007 → T008` antes de qualquer outra coisa. É a ordem de
`quickstart.md` §"Ordem sugerida de validação": se a paleta não passa no
contraste, nada adiante importa. T009 precede T010; T013 precede T014.

### User Story Dependencies

- **US1 (P1)**: sem dependência de outra história.
- **US2 (P1)**: precisa do `Shell` criado em US1. As duas juntas completam a casca.
- **US3 (P2)**: precisa da casca de US1+US2.
- **US4 (P2)**: independente das anteriores para as primitivas e a maioria das telas; T060 e T062 conflitam por arquivo com T047 e com o ciclo de serviço.
- **US5 (P3)**: descritiva; não altera nada que o usuário final veja.

### Dentro de cada história

- Domínio puro antes do componente que o desenha (T019/T020 antes de T035)
- Mapa de ícones antes de qualquer superfície que consuma ícone (T016/T017 antes de T027)
- Primitivas antes das telas que as consomem (T052–T058 antes de T059–T069)
- Teste de comportamento preservado rodado **depois** da mudança, para provar que a expectativa não mudou (T044, T087)

### Parallel Opportunities

- T004 é paralelo a T001–T003
- T011 e T012 são paralelos entre si (degraus distintos do mesmo `@theme`, sem sobreposição de linha)
- T018 e T020 são paralelos (arquivos de teste distintos)
- T024 e T036 abrem suas fases e não dependem de nada dentro delas
- T043 e T043a são paralelos (arquivos de teste distintos)
- T047 e T048 são paralelos (telas distintas)
- T053, T054, T055, T057 e T058 são paralelos (arquivos distintos em `src/ui/`)
- T061, T063, T064, T066, T067, T068 e T069 são paralelos (features distintas)
- T080 e T081 são paralelos (seções distintas do guia, depois de T079)

---

## Parallel Example: Fase 6, primitivas

```bash
# Depois de T052 (Button, que as demais referenciam em variante):
Task: "Redesenhar src/ui/TextField.tsx com --radius-control 8px"
Task: "Redesenhar src/ui/TextArea.tsx com a mesma anatomia de campo"
Task: "Redesenhar src/ui/Toggle.tsx consumindo o papel done"
Task: "Redesenhar src/ui/StepHeading.tsx com --text-page e --text-step"
Task: "Redesenhar CopyButton, VersionHintBadge, RateLimitWaiting e LiveRegion"
```

## Parallel Example: Fase 6, telas

```bash
Task: "Redesenhar src/features/input/InputScreen.tsx e ListReduction.tsx"
Task: "Redesenhar src/features/connect/ConnectButton.tsx, AuthError.tsx, ReauthDialog.tsx"
Task: "Redesenhar src/features/quota/QuotaEstimateScreen.tsx"
Task: "Redesenhar src/features/result/ResultScreen.tsx e adjacentes"
Task: "Redesenhar src/features/summary/SummaryScreen.tsx"
Task: "Redesenhar src/features/queue/QueueIndicator.tsx"
Task: "Redesenhar src/app/DraftRecoveryBanner.tsx"
```

---

## Implementation Strategy

### MVP primeiro (US1)

1. Fase 1: Setup
2. Fase 2: Foundational — **crítica, bloqueia tudo**
3. Fase 3: US1
4. **PARE e VALIDE**: `npx vitest run tests/components/shell.spec.tsx tests/components/connection-chip.spec.tsx`
5. A barra superior já dá identidade ao produto sobre o conteúdo antigo

### Entrega incremental

1. Setup + Foundational → paleta verificada, escalas renormalizadas, ícones resolvidos, domínio da trilha testado
2. US1 → barra superior → validar → demonstrar (MVP)
3. US2 → casca completa → validar → demonstrar
4. US3 → barra de ações nas duas etapas de escolha → validar
5. US4 → vocabulário tela a tela, entregável em lotes
6. US5 → guia de estilo
7. Polish → `no-orphan-tokens` declara a migração encerrada

### Estratégia em paralelo

Com mais de uma pessoa, depois da Fase 2:

- Pessoa A: US1 → US2 (a casca é sequencial entre si)
- Pessoa B: US4, primitivas e telas que não colidem com US3
- Pessoa C: US3, depois de a casca existir

---

## Notes

- `[P]` = arquivos distintos, sem dependência pendente
- `[Story]` mapeia a tarefa à história, para rastreabilidade
- Todo teste cita o `FR-xxx` / `SC-xxx` que garante, como a constituição exige
- Commit por tarefa ou por grupo lógico; `npm run lint`, `npm run typecheck` e `npm test` antes de cada commit
- **Nenhum teste de comportamento existente pode mudar de expectativa.** Esta feature move, recolore e renomeia superfícies; não muda o que a aplicação faz. Se `e2e/create-playlist.spec.ts`, `e2e/theme.spec.ts`, `tests/components/skip-service.spec.tsx` ou `tests/components/reset-flow.spec.tsx` exigirem nova expectativa, pare — o escopo foi rompido
- A tabela de `contracts/tokens.md` §2 é insumo; **`tests/unit/contrast.spec.ts` é a autoridade**. Se os dois discordarem, o contrato se corrige
