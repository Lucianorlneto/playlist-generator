---
description: 'Lista de tarefas — 010 · Sistema de movimento do aplicativo'
---

# Tasks: Sistema de movimento do aplicativo

**Input**: documentos de design em `/specs/010-app-motion-system/`

**Prerequisites**: [plan.md](./plan.md) · [spec.md](./spec.md) · [research.md](./research.md) ·
[data-model.md](./data-model.md) · [contracts/](./contracts/) · [quickstart.md](./quickstart.md)

**Tests**: incluídos e **obrigatórios**. Não é preferência de método — é o Princípio IV da
constituição ("invariante sem teste não é invariante"). Esta feature declara invariantes que
nenhum compilador pega: a identidade do catálogo, a origem única da escala de tempo, o teto
de defasagem, a árvore que sai da transição ficando inerte, o portão de ociosidade do
`Settle` e a supressão sob movimento reduzido.

**Organização**: por história de usuário, para que cada uma seja implementável e verificável
sozinha.

## Format: `[ID] [P?] [Story] Descrição`

- **[P]**: pode rodar em paralelo (arquivo diferente, sem dependência pendente)
- **[Story]**: a que história a tarefa pertence (US1, US2, US3, US4)
- Todo caminho de arquivo é relativo à raiz do repositório

## Convenções de caminho

Projeto único, React + Vite: `src/`, `tests/`, `e2e/` na raiz. Alias `@/` → `src/`.

## Uma regra que atravessa a lista inteira

**Toda tarefa que acrescenta primitiva ao catálogo atualiza, no mesmo commit**, quatro
lugares: o arquivo da primitiva, o barril `src/ui/motion/index.ts`, a tabela de
`contracts/motion-catalog.md` §2 e a asserção de identidade em
`tests/unit/motion-catalog.spec.ts`. Isso não é cerimônia — é literalmente o FR-002, e é o
que substitui a contagem "exatamente três" da 009. Cada tarefa dessas diz isso explicitamente.

---

## Phase 1: Setup (infraestrutura compartilhada)

**Propósito**: mover o portão de **contagem** para **identidade** enquanto o catálogo ainda é
o da 009. O arranjo é o mesmo da feature anterior: a fechadura nova nasce guardando o que já
existe, e não legalizando o que acabou de entrar.

- [ ] T001 Confirmar que `motion@13` continua sendo a única biblioteca de animação em `package.json`, rodando `npm ls motion` e conferindo que `package-lock.json` não ganhou par novo (FR-038)
- [ ] T002 Renomear `tests/unit/motion-surface.spec.ts` para `tests/unit/motion-catalog.spec.ts` e trocar a asserção de contagem (`PRIMITIVAS.length === 3`, `Object.keys(primitivas).sort()`) por asserção de **identidade** contra uma tabela nomeada no topo do arquivo, ainda com as três da 009 — o teste deve continuar verde sem nenhuma mudança em `src/` (FR-001, FR-002, SC-001, SC-002, contracts/motion-catalog.md §1)
- [ ] T003 [P] Reescrever as duas mensagens de `noMotionLibraryImport` em `eslint-rules/index.js` para apontarem o catálogo de `contracts/motion-catalog.md` em vez da frase "exatamente três", preservando o comportamento da regra (FR-002, FR-003)
- [ ] T004 [P] Confirmar em `playwright.config.ts` que o projeto `reduced-motion` roda a suíte inteira e não só `creating-loading.spec.ts`, ajustando o filtro se estiver restrito (FR-014, SC-005)

**Checkpoint**: o portão afirma identidade, o catálogo ainda tem três entradas, e nada de
comportamento mudou. Se `npm test` não estiver verde aqui, a base está errada e nenhuma
história deve começar.

---

## Phase 2: Foundational (pré-requisitos bloqueantes)

**Propósito**: a escala de tempo com origem única, a regra de lint que a protege, e as duas
primitivas compartilhadas por mais de uma história.

**⚠️ CRÍTICO**: nenhuma história pode começar antes desta fase. E a **ordem interna importa**:
`tp/no-raw-motion-values` (T012) só pode entrar **depois** de T005–T011, porque o código atual
tem valores crus — `duration: 0.2` em `CrossFade`, `CICLO = 1.2` em `PulsingBar`,
`duration-200` em `StepRail`. Ligar a regra antes deixaria `npm run lint` vermelho por
motivo certo e momento errado.

### A escala

- [ ] T005 Criar `src/ui/motion/scale.ts` com as durações, o par de escalonamento e as três curvas de `contracts/motion-scale.md` §1, tipado e sem exportar nada além dos valores — inclui a função `atrasoEscalonado(i)` com o teto (FR-006, FR-007, FR-013)
- [ ] T006 Espelhar a escala no `@theme` de `src/styles/index.css`, emitindo os utilitários `duration-*` e `ease-*` correspondentes e fixando `--default-transition-duration` em `200ms` — comentando por que o padrão de 150ms do Tailwind sai de cena (FR-006, FR-007, contracts/motion-scale.md §2)
- [ ] T007 Criar `tests/unit/motion-scale.spec.ts` que lê `scale.ts` e `index.css`, compara valor a valor e falha **tanto por divergência quanto por token presente em apenas uma das camadas** (FR-006, SC-003, contracts/motion-scale.md §4)

### Migrar o que já existe, sem mudar comportamento

- [ ] T008 [P] Substituir a constante local de `src/ui/motion/SpinningDisc.tsx` por `spin` + `linear` vindos da escala, mantendo o giro idêntico (FR-005)
- [ ] T009 [P] Substituir `CICLO` e `'easeInOut'` em `src/ui/motion/PulsingBar.tsx` por `pulse` + `through` vindos da escala, mantendo a pulsação idêntica (FR-005)
- [ ] T010 [P] Substituir `FUSAO` em `src/ui/motion/CrossFade.tsx` por `base` + `standard` vindos da escala, mantendo a fusão idêntica (FR-005)
- [ ] T011 Trocar `duration-200` do conector em `src/app/StepRail.tsx` pelo utilitário que o `@theme` passou a emitir (FR-006, SC-003)

### A regra que fecha a escala

- [ ] T012 Acrescentar `tp/no-raw-motion-values` em `eslint-rules/index.js`, no molde de `noRawVisualValues`, isentando **apenas** `src/ui/motion/scale.ts` e cobrindo literal em `duration`/`delay`/`repeatDelay`, literal de curva, e utilitário `duration-*`/`ease-*` fora do conjunto emitido (FR-008, contracts/motion-scale.md §3)
- [ ] T013 Registrar a regra em `eslint.config.js` junto das outras quatro `tp/` e confirmar `npm run lint` verde após T005–T011 (FR-008)

### As duas primitivas compartilhadas

- [ ] T014 Criar `src/ui/motion/Stagger.tsx` com os papéis fechados `enter` e `decor` de `contracts/motion-catalog.md` §2.2, defasagem por `atrasoEscalonado`, consulta a `useReducedMotion()` devolvendo todos os irmãos visíveis sem defasagem, e **sem aceitar duração, curva ou atraso como prop** — atualiza barril, tabela do contrato e `motion-catalog.spec.ts` no mesmo commit, incluindo estender à primitiva nova o bloco `PROIBIDAS` herdado de `motion-surface.spec.ts` (FR-004, FR-009, FR-013, FR-014, SC-001)
- [ ] T015 [P] Criar `tests/unit/stagger.spec.ts` afirmando que a defasagem da última de **120** é igual à da última de **8**, e que ambas valem 240ms (FR-013, SC-009)
- [ ] T016 Criar `src/ui/motion/Settle.tsx` com a prop `idle: boolean` **obrigatória e sem valor padrão**, devolvendo os filhos sem animação quando `false`, e consultando `useReducedMotion()` — atualiza barril, tabela do contrato e `motion-catalog.spec.ts` no mesmo commit (FR-010, FR-010a, FR-011, FR-014)
- [ ] T017 [P] Criar `tests/components/settle.spec.tsx` afirmando que `idle={false}` não aplica animação de posição alguma, e que sob movimento reduzido a nova posição chega em um quadro (FR-010a, SC-015)
- [ ] T018 Estender `tests/unit/motion-catalog.spec.ts` com a asserção dirigida de que `Settle` é a **única** entrada autorizada a animar posição, e que essa lista tem um elemento (FR-010, contracts/motion-catalog.md §3)

**Checkpoint**: a escala é a origem única e está trancada por lint e por teste; o catálogo
tem cinco entradas e o portão sabe quais são. `npm run lint`, `npm run typecheck` e
`npm test` verdes.

---

## Phase 3: User Story 1 — Perceber o avanço no fluxo (Priority: P1) 🎯 MVP

**Goal**: a troca de etapa ganha direção e a trilha deixa de saltar, sem que nenhuma zona da
casca se mova e sem que o foco espere um quadro sequer.

**Independent Test**: percorrer Configuração → Destinos → Entrada e voltar; o conteúdo
transita com direção, as caixas delimitadoras da barra superior, da trilha e da barra de ação
são idênticas em todos os quadros, e `Tab` logo após o avanço alcança só os controles da
etapa nova.

### Testes da US1

> Escrever **antes** da implementação e conferir que falham.

- [ ] T019 [P] [US1] Criar `tests/unit/step-direction.spec.ts` cobrindo todo par de `WIZARD_STEPS`: avanço devolve `1`, retorno `-1`, etapa igual `0`, e `from` nulo `0` (FR-022, FR-024, data-model.md §3)
- [ ] T020 [P] [US1] Criar `tests/components/step-transition.spec.tsx` afirmando: o foco chega ao título no mesmo quadro; a árvore que sai tem `inert` e `aria-hidden`; existe **um único** `aria-current="step"` durante a transição; a primeira montagem não anima; sob movimento reduzido a etapa entra em um quadro (FR-016, FR-017, FR-024, SC-008, SC-010)
- [ ] T021 [P] [US1] Criar `tests/components/service-phases.spec.tsx` afirmando que percorrer `connect → estimate → search → review → creating → done` **não** produz transição de tela alguma (FR-021a, SC-016)

### Implementação da US1

- [ ] T022 [US1] Criar `src/domain/rail/stepDirection.ts` como função pura sobre `WIZARD_STEPS` de `src/domain/types.ts`, sem duplicar a lista, sem DOM e sem relógio (FR-022, Princípio III)
- [ ] T023 [US1] Criar `src/ui/motion/StepTransition.tsx` com `AnimatePresence custom` + `usePresenceData()`, o nó que sai em `position: absolute` num envoltório próprio marcado `inert` e `aria-hidden`, `initial={false}`, e `useReducedMotion()` devolvendo a etapa que entra em um quadro — **sem** `mode="wait"` e **sem** `mode="popLayout"`, pelos motivos de `contracts/surfaces.md` §1.1; atualiza barril, tabela do contrato e `motion-catalog.spec.ts` no mesmo commit, incluindo estender à primitiva nova o bloco `PROIBIDAS` herdado de `motion-surface.spec.ts` (FR-009, FR-016, FR-017, FR-021, FR-022, FR-024, research.md §R6)
- [ ] T024 [US1] Envolver **apenas** `<Screen />` em `StepTransition` dentro de `src/app/Wizard.tsx`, guardando a etapa anterior num `ref` local — sem estado novo no store e sem tocar `draftPersistence` (FR-021, FR-021a, data-model.md §3)
- [ ] T025 [US1] Manter `DraftRecoveryBanner` **fora** do bloco que transita em `src/app/Wizard.tsx` e dar a ele entrada própria com `Stagger` no papel `enter` em `src/app/DraftRecoveryBanner.tsx`, deixando o descartar imediato (FR-021b, contracts/surfaces.md §1.5)
- [ ] T026 [US1] Em `src/app/StepRail.tsx`, trocar o conteúdo do disco (numeral ↔ glifo de conclusão) por `CrossFade` e aplicar o degrau `quick` ao preenchimento e ao contorno, preservando a distinção por **forma** da tabela `DISC_CLASSES` (FR-025, contracts/surfaces.md §2)
- [ ] T027 [US1] Criar `e2e/motion.spec.ts` com o bloco da US1: caixas delimitadoras da barra superior, da trilha e da barra de ação idênticas em todos os quadros da transição; a altura da coluna principal indo da altura da etapa que sai à da que entra de forma **monotônica**, sem passar pela soma das duas nem por zero; e `Tab` durante a transição alcançando só a etapa nova (FR-021, FR-023, SC-007, SC-008)

**Checkpoint**: US1 funciona sozinha e é demonstrável. **É o MVP** — a fechadura nova, a
escala e a superfície que todo uso do produto atravessa.

---

## Phase 4: User Story 2 — Ver a revisão se formar (Priority: P2)

**Goal**: a lista de correspondências entra escalonada quando a busca termina, sai animada
quando uma linha é descartada, e continua imóvel enquanto há requisição em voo.

**Independent Test**: rodar uma busca com rede mockada; ao terminar, as linhas entram
escalonadas dentro do teto; durante a busca nada anima; descartar uma linha anima a saída e
as de baixo assumem a nova posição.

### Testes da US2

- [ ] T028 [P] [US2] Criar `tests/components/review-motion.spec.tsx` afirmando: durante a fase `search` nenhuma animação nova está em curso; ao chegar `search_done` as linhas entram escalonadas; numa execução **retomada**, as linhas já em cena antes da busca permanecem imóveis (FR-026, FR-026a, SC-015)

### Implementação da US2

- [ ] T029 [US2] Envolver a `<ul>` de `src/features/review/ReviewScreen.tsx` em `Stagger` no papel `enter`, com a chave de identidade continuando a ser `item.line.id` (FR-026, contracts/surfaces.md §3.1)
- [ ] T030 [US2] Envolver a mesma lista em `Settle` com `idle={search.running === false}`, passando o portão explicitamente mesmo sendo sempre verdadeiro na revisão — é o que o mantém auditável (FR-010a, FR-027)
- [ ] T031 [US2] Animar a saída da linha descartada em `src/features/review/MatchRow.tsx`, em `opacity`, sem tocar a ordem por `line.index` que a 001 fixou (FR-027, contracts/surfaces.md §3.2)
- [ ] T032 [US2] Acrescentar ao `e2e/motion.spec.ts` o bloco da US2: cento e vinte linhas entram com a última dentro do teto, e a contagem anunciada pelas regiões vivas de `SearchProgress` é idêntica à de hoje (FR-017, SC-009)

**Checkpoint**: US1 e US2 funcionam, cada uma verificável sozinha.

---

## Phase 5: User Story 3 — Reconhecer mudança de estado sem reler a tela (Priority: P3)

**Goal**: chip de conexão, cartão de destino e painel de fila deixam de trocar num quadro.

**Independent Test**: conectar um serviço e ver o chip transitar; alternar a seleção de
destinos e ver a fila assumir a nova ordem com movimento em vez de salto.

**Nota de escopo**: esta história é quase toda CSS. Nenhuma primitiva nova entra no catálogo
por causa dela.

### Testes da US3

- [ ] T033 [P] [US3] Criar `tests/components/destination-card.spec.tsx` afirmando que marcar e desmarcar um cartão **não** aplica transformação alguma — nem escala, nem deslocamento — e que o estado permanece legível por forma (FR-031, contracts/surfaces.md §4.1)

### Implementação da US3

- [ ] T034 [P] [US3] Aplicar transição de cor no degrau `quick` em `src/features/connect/ConnectionChip.tsx`, mantendo o estado legível por texto e por forma, com `motion-reduce:transition-none` como os outros componentes já fazem (FR-029, FR-015)
- [ ] T035 [P] [US3] Aplicar transição de cor no degrau `quick` a preenchimento, contorno e caixa de marcação em `src/features/destinations/DestinationSelector.tsx` — **sem** transformação (FR-031)
- [ ] T036 [US3] Envolver as entradas de `src/features/destinations/ExecutionOrderPanel.tsx` em `Settle`, com o portão derivado de "nenhuma execução em curso" (FR-030, FR-010a, contracts/surfaces.md §4)

**Checkpoint**: as três histórias entregues até aqui continuam verificáveis em separado.

---

## Phase 6: User Story 4 — A cena de Destinos (Priority: P4)

**Goal**: os onze adesivos assentam escalonados na primeira aparição de Destinos e ficam
imóveis dali em diante.

**Independent Test**: entrar em Destinos e ver os adesivos assentarem; sair e voltar e vê-los
já postos; ativar movimento reduzido e vê-los estáticos desde o primeiro quadro.

### Testes da US4

- [ ] T037 [P] [US4] Criar `tests/components/stickers.spec.tsx` afirmando: a primeira montagem encena; a segunda mostra os adesivos já postos; sob movimento reduzido nenhuma etapa intermediária existe; a camada continua `aria-hidden` (FR-032, FR-032a, FR-014, SC-017)

### Implementação da US4

- [ ] T038 [US4] Envolver os onze `<img>` de `src/ui/Stickers.tsx` em `Stagger` no papel `decor`, preservando integralmente a tabela `STICKERS` — posição, largura e a inclinação `rotate`, que é **geometria estática** e não pode ser alterada pela escala animada (FR-032, contracts/surfaces.md §5.1)
- [ ] T039 [US4] Acrescentar em `src/ui/Stickers.tsx` o sinalizador de encenação como valor de módulo em memória, nunca no store e nunca persistido, de modo que só a primeira aparição da sessão anime (FR-032a, data-model.md §4.1)
- [ ] T040 [US4] Acrescentar ao `e2e/motion.spec.ts` a asserção de que a faixa de adesivos não desloca nenhum conteúdo acima dela em nenhum quadro (FR-033)

**Checkpoint**: as quatro histórias entregues, cada uma verificável sozinha.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Propósito**: fechar os portões que atravessam histórias e acertar a documentação — que
neste projeto **descreve** o código, e cuja divergência se resolve corrigindo o guia.

- [ ] T041 [P] Reescrever `docs/style-guide.md` §Movimento: a contagem "exatamente três" sai, entram o catálogo de seis, a escala de tempo com origem única, a fronteira da animação de posição e o registro de que movimento contínuo continua significando trabalho em curso (FR-039)
- [ ] T042 [P] Registrar em `specs/009-creating-loading-state/contracts/motion.md` que os §1 e §3 foram substituídos por `010/contracts/motion-catalog.md`, sem que os três movimentos da 009 mudem de comportamento (FR-040)
- [ ] T043 [P] Corrigir o comentário de `src/features/review/SearchProgress.tsx` que afirma que a CSP bloquearia uma largura inline: a razão que sustenta o `<progress>` nativo é a acessibilidade (FR-028, research.md §R1)
- [ ] T044 Completar `e2e/motion.spec.ts` com os cenários transversais: tela em repouso sem animação em curso (FR-034, SC-014); nenhuma rolagem horizontal no projeto `narrow-375` (SC-012); avançar e voltar no meio da transição resolvendo no estado final sem nó preso (FR-018, FR-018a, SC-013); a reautorização abrindo durante uma transição e ficando operável de imediato (FR-036)
- [ ] T045 Estender `tests/a11y/steps.spec.tsx` às superfícies animadas, nos dois temas, exigindo nenhuma violação séria ou crítica (FR-020, SC-011)
- [ ] T046 Estender a asserção de `@media (forced-colors: active)` de `tests/components/shell.spec.tsx` às superfícies animadas, afirmando que **nenhum bloco novo** foi acrescentado para preservar adesivo ou barra de esqueleto — o modo remove decoração e a feature não a traz de volta (FR-019)
- [ ] T047 Rodar o projeto `reduced-motion` inteiro e conferir que a contagem de textos exibidos e de controles alcançáveis é idêntica à do projeto `desktop`, tela a tela (FR-015, SC-004, SC-005)
- [ ] T048 Confirmar que `tests/unit/throughput.spec.ts`, `tests/unit/contrast.spec.ts`, `tests/unit/no-orphan-tokens.spec.ts` e `tests/unit/no-secrets.spec.ts` passam **sem alteração** — esta feature não toca vazão, cor, token nem rede (FR-012, FR-037, FR-038, SC-006)
- [ ] T049 Executar o roteiro de `quickstart.md` de ponta a ponta, incluindo o passo 14: `npm run build`, `npm run preview`, e conferir no console que nenhuma violação de CSP é registrada enquanto as animações rodam (research.md §R1)
- [ ] T050 Portão local completo — `npm run lint`, `npm run typecheck`, `npm test` — e `npm run test:e2e` nos três projetos, obrigatório porque esta feature altera o fluxo do assistente

---

## Dependencies & Execution Order

### Dependências entre fases

- **Phase 1 (Setup)**: sem dependências. Move o portão de contagem para identidade.
- **Phase 2 (Foundational)**: depende da Phase 1. **Bloqueia todas as histórias.**
  - Ordem interna rígida: T005 → T006 → T007, depois T008–T011, e **só então** T012–T013.
  - T014–T018 podem seguir em paralelo com T012–T013 desde que T005 esteja pronto.
- **Phase 3–6 (histórias)**: dependem da Phase 2 completa. Podem seguir em paralelo entre si.
- **Phase 7 (Polish)**: depende das histórias que se pretende entregar.

### Dependências entre histórias

- **US1 (P1)**: depende só da Foundational. Nenhuma dependência de outra história.
- **US2 (P2)**: depende da Foundational — usa `Stagger` (T014) e `Settle` (T016). Independente da US1.
- **US3 (P3)**: depende da Foundational — usa `Settle` (T016). Independente das demais.
- **US4 (P4)**: depende da Foundational — usa `Stagger` (T014). Independente das demais.

Nenhuma história depende de outra. A ordem de prioridade é de valor, não de bloqueio.

### Dentro de cada história

Testes primeiro, e conferidos falhando. Depois domínio puro, depois primitiva, depois
superfície, depois ponta a ponta.

### Conflitos de arquivo a respeitar

- `src/ui/motion/index.ts`, `contracts/motion-catalog.md` e `tests/unit/motion-catalog.spec.ts` são tocados por T014, T016 e T023 — **nunca em paralelo**.
- `e2e/motion.spec.ts` é criado em T027 e estendido em T032, T040 e T044 — sequencial.
- `src/app/Wizard.tsx` é tocado por T024 e T025 — sequencial.
- `src/ui/Stickers.tsx` é tocado por T038 e T039 — sequencial.

---

## Parallel Opportunities

```bash
# Phase 1 — depois de T002
T003  Mensagens de tp/no-motion-library-import em eslint-rules/index.js
T004  Projeto reduced-motion em playwright.config.ts

# Phase 2 — depois de T007, as três migrações não se cruzam
T008  SpinningDisc lê da escala
T009  PulsingBar lê da escala
T010  CrossFade lê da escala

# Phase 3 — os três testes da US1, antes de qualquer implementação
T019  tests/unit/step-direction.spec.ts
T020  tests/components/step-transition.spec.tsx
T021  tests/components/service-phases.spec.tsx

# Phase 5 — chip e cartão são arquivos distintos
T034  ConnectionChip
T035  DestinationSelector

# Phase 7 — documentação e comentário, três arquivos distintos
T041  docs/style-guide.md
T042  009/contracts/motion.md
T043  SearchProgress.tsx
```

Com mais de uma pessoa, depois da Phase 2: uma pega US1 (a mais pesada), outra pega US2, e
US3 + US4 cabem juntas numa terceira.

---

## Implementation Strategy

### MVP primeiro (US1)

1. Phase 1 — o portão passa a afirmar identidade.
2. Phase 2 — escala, lint e as duas primitivas compartilhadas. **Bloqueante.**
3. Phase 3 — US1.
4. **PARAR e VALIDAR**: percorrer o fluxo, conferir casca imóvel e foco imediato.

O MVP entrega o que a feature realmente é: a fechadura nova, a escala, e a superfície que
todo uso do produto atravessa. As outras três histórias são acréscimo sobre uma base pronta.

### Entrega incremental

1. Setup + Foundational → base pronta.
2. US1 → validar → demonstrar (MVP).
3. US2 → validar → demonstrar.
4. US3 e US4 → validar → demonstrar.
5. Phase 7 → documentação, portões transversais, portão local e ponta a ponta.

Cada história acrescenta valor sem quebrar as anteriores, porque nenhuma depende de outra.

---

## Notes

- `[P]` significa arquivo diferente e nenhuma dependência pendente.
- Toda tarefa que acrescenta primitiva atualiza os **quatro** lugares do catálogo no mesmo commit — é o FR-002, não cerimônia.
- Conferir que cada teste falha antes de implementar. Um teste que passa antes da implementação não está testando o que se pensa.
- Commit por tarefa ou por grupo lógico; nunca misturar mudança de documentação de governança com código.
- Parar em qualquer checkpoint é seguro: cada um deixa `npm run lint`, `npm run typecheck` e `npm test` verdes.
- O que esta feature **não** faz: tocar regra de negócio, acrescentar dependência, acrescentar host, criar chave de armazenamento, animar diálogo, animar fase do ciclo de serviço, ou introduzir movimento ocioso contínuo.
