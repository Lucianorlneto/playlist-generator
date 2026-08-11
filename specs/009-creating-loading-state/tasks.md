---
description: 'Lista de tarefas — 009 · Estado de carregamento da criação de playlist'
---

# Tasks: Estado de carregamento da criação de playlist

**Input**: documentos de design em `/specs/009-creating-loading-state/`

**Prerequisites**: [plan.md](./plan.md) · [spec.md](./spec.md) · [research.md](./research.md) ·
[data-model.md](./data-model.md) · [contracts/](./contracts/) · [quickstart.md](./quickstart.md)

**Tests**: incluídos e **obrigatórios**. Não é preferência de método — é o Princípio IV da
constituição ("invariante sem teste não é invariante") somado ao fato de que esta feature
declara oito invariantes que nenhum compilador pega: a fechadura da biblioteca de
movimento, a faixa de perceptibilidade do esqueleto, a contagem de regiões vivas, o
deslocamento zero do título e a supressão sob movimento reduzido.

**Organização**: por história de usuário, para que cada uma seja implementável e
verificável sozinha.

## Format: `[ID] [P?] [Story] Descrição`

- **[P]**: pode rodar em paralelo (arquivo diferente, sem dependência pendente)
- **[Story]**: a que história a tarefa pertence (US1, US2, US3, US4)
- Todo caminho de arquivo é relativo à raiz do repositório

## Convenções de caminho

Projeto único, React + Vite: `src/`, `tests/`, `e2e/` na raiz. Alias `@/` → `src/`.

---

## Phase 1: Setup (infraestrutura compartilhada)

**Propósito**: as duas fechaduras que precisam existir **antes** do primeiro arquivo que
importa a biblioteca de movimento, mais o projeto de teste que a US4 vai usar.

- [X] T001 Confirmar que `motion@13` está em `dependencies` de `package.json` e que nenhuma outra biblioteca de animação entrou junto, rodando `npm ls motion` e conferindo `package-lock.json` (Complexity Tracking do plano; FR-027)
- [X] T002 [P] Acrescentar a regra local `tp/no-motion-library-import` em `eslint-rules/index.js`, no molde exato de `no-icon-library-import`, com allowlist do diretório `src/ui/motion/` e mensagem que aponta o contrato — falha em qualquer `from 'motion'` ou `from 'motion/react'` fora dele (FR-010b, contracts/motion.md §1)
- [X] T003 [P] Registrar a regra nova em `eslint.config.js` (ou onde `tp/` já é ativado) e confirmar que `npm run lint` continua verde no código atual, que ainda não importa a biblioteca (FR-010b)
- [X] T004 [P] Acrescentar o projeto `reduced-motion` em `playwright.config.ts`, com o viewport do `desktop` e `use: { reducedMotion: 'reduce' }`, citando SC-003 em comentário (SC-003, contracts/motion.md §5)

**Checkpoint**: a fechadura existe e falha **antes** de haver o que trancar. É o ponto do
arranjo — a regra nasce impedindo, não legalizando o que já entrou.

---

## Phase 2: Foundational (pré-requisitos bloqueantes)

**Propósito**: a camada de tokens, os textos, as três primitivas de movimento, a função
pura do relógio e a reorganização do `ResultScreen`. **Nenhuma história pode começar antes
desta fase**, e a razão é concreta: a US1 e a US2 renderizam dentro do cartão que só a
reorganização torna um nó de DOM estável.

**⚠️ CRÍTICO**: T014 (a reorganização) é o item de maior risco da feature. Ele entra
**preservando o comportamento atual** — a suíte existente passa sem alteração de asserção
(SC-008) já ao final desta fase, antes de qualquer conteúdo novo aparecer.

### Camada de tokens (contracts/tokens.md)

- [X] T005 Declarar `--skeleton` nos dois blocos de tema de `src/styles/tokens.css` — `#e7e0d2` no Papel, `#252d3a` na Noite — e **repetir** o valor escuro no bloco `@media (prefers-color-scheme: dark)`, com comentário registrando que não é alias de `--rule` (FR-019, FR-019a, contracts/tokens.md §3)
- [X] T006 Declarar `--accent-tint-surface` em `src/styles/tokens.css` **fora** dos blocos de tema, como `color-mix(in srgb, var(--accent) var(--state-tint-amount), var(--surface))`, ao lado de `--accent-tint`, com o motivo do substrato `--surface` em vez de `--surface-zone` (FR-019, contracts/tokens.md §2)
- [X] T007 Mapear `--color-skeleton` e `--color-accent-tint-surface` no `@theme inline` de `src/styles/index.css`, emitindo `var(--…)` e não o hex resolvido (contracts/tokens.md §5)
- [X] T008 Atualizar `src/domain/theme/approvedPairs.ts`: `--skeleton` entra em `TokenName` e em `COLOR_TOKENS` (19 → 20 nomes), `--accent-tint-surface` entra em `DERIVED_TOKENS` com a receita `--accent` / `--state-tint-amount` / `--surface`, e o par `--accent-text` sobre `--accent-tint-surface` (`usage: 'ui'`) entra em `APPROVED_PAIRS` com `APPROVED_PAIR_COUNT` editado à mão de 31 para 32 (FR-019, SC-002, contracts/tokens.md §2)
- [X] T009 Acrescentar em `tests/unit/contrast.spec.ts` a **faixa de perceptibilidade** de FR-008a — `1,15 ≤ contrastRatio(--skeleton, --surface) ≤ 1,60` nos dois temas — e o comentário de que `--skeleton` é token sem par aprovado, pelo precedente literal de `--rule` (FR-008a, SC-002, contracts/tokens.md §3.1 e §3.2)
- [X] T009a Tornar FR-020 executável em `tests/unit/contrast.spec.ts`: o conjunto de tokens de tinta declarados em `src/styles/tokens.css` é a lista fechada conhecida — uma terceira tinta não entra em silêncio —, e `#5b6474`, a tinta do nó `mJCdf`, não aparece em nenhum dos dois temas. Substitui o item de conferência manual de `contracts/tokens.md` §6, que era o único portão de um requisito MUST (FR-020, Princípio IV)

### Textos e inventário (contracts/text-inventory.md)

- [X] T010 [P] Acrescentar as três chaves no ramo `result.` de `src/i18n/pt-BR.ts`: `creatingSubtitle` ("Isso pode levar alguns segundos."), `creatingDescription` (preserva "Estamos enviando sua lista para o {service}" e "não feche esta janela", **sem** repetir a expectativa de duração) e `awaitingConfirmation` ("Aguardando confirmação do {service}…") (FR-005, FR-006, FR-011, contracts/text-inventory.md §3)
- [X] T011 Reverter em `tests/fixtures/design-inventory.json` o item `yjjDB/FeEHR` de `mantido-diferente` para `adotado`, apontando para `result.creatingSubtitle`, e **remover** o motivo antigo, cuja premissa esta feature revogou (FR-021, contracts/text-inventory.md §1)
- [X] T012 Acrescentar em `tests/fixtures/design-inventory.json` os itens de `yjjDB/G37LNR` (`mantido-diferente`, com o motivo do FR-006 escrito por extenso) e `yjjDB/mJCdf` (`adotado` → `result.awaitingConfirmation`), ambos com a amostra `{"service": "Spotify"}` (FR-021, contracts/text-inventory.md §2)
- [X] T013 Reescrever o motivo da exclusão por prefixo `result.` em `tests/fixtures/design-inventory-exclusions.json` para registrar que as telas `C13Hj` **e** `SjphR` estão inventariadas nó a nó, e confirmar por `tests/unit/design-text-fidelity.spec.ts` que nenhuma das três chaves novas fica coberta só pelo prefixo (FR-021, contracts/text-inventory.md §4)
- [X] T014 Rebaselinar `tests/fixtures/i18n-pt-BR.snapshot.json` com `ATUALIZAR_I18N=1 npx vitest run tests/unit/i18n-stability.spec.ts` e conferir no diff que **só** as três chaves entram e nenhum valor existente muda (contracts/text-inventory.md §5)

### As três primitivas de movimento (contracts/motion.md)

- [X] T015 [P] Criar `src/ui/motion/SpinningDisc.tsx`: giro contínuo do **glifo** (não do disco), `rotate` → `transform`, volta completa em ~1s, temporização linear, repetição infinita; consulta `useReducedMotion()` e devolve o estado final estático quando `true` (FR-014, FR-016, FR-017a, contracts/motion.md §2.1)
- [X] T016 [P] Criar `src/ui/motion/PulsingBar.tsx`: pulsação por `opacity` entre dois valores, **nunca chegando a zero**, todas as instâncias em fase única sem defasagem; consulta `useReducedMotion()` e devolve o estado final estático quando `true` (FR-015, FR-016, FR-017a, contracts/motion.md §2.2)
- [X] T017 [P] Criar `src/ui/motion/CrossFade.tsx`: fusão cruzada por `opacity` em 200ms, com o bloco que **sai** posicionado de forma absoluta e o que **entra** definindo a altura; assinatura de **dois slots anuláveis** (`from`, `to`), wrapper com `position: relative` e retorno `null` quando os dois forem nulos; consulta `useReducedMotion()` e troca em um quadro quando `true` (FR-010a, FR-010b, FR-016, contracts/motion.md §2.3, contracts/loading-card.md §5.1.2, research §R7)
- [X] T018 Criar `src/ui/motion/index.ts` exportando **exatamente** `SpinningDisc`, `PulsingBar` e `CrossFade` — e **nenhum** reexport de `motion` ou `motion.div`, que devolveria a chave à fechadura (FR-010b, contracts/motion.md §1)
- [X] T019 Criar `tests/unit/motion-surface.spec.ts`: varre `src/`, exige que nenhum arquivo fora de `src/ui/motion/` cite `from 'motion`, que o diretório exporte exatamente três primitivas, e que nenhuma delas anime propriedade fora de `transform` e `opacity` (FR-010b, FR-017a, SC-011, contracts/motion.md §8)

### Domínio puro

- [X] T020 [P] Criar `src/domain/retry/countdown.ts` com `segundosRestantes(resumesAt, agora) = max(0, ceil((resumesAt - agora) / 1000))`, com `agora` como **parâmetro** e nenhum `Date.now()` interno, e exportá-la em `src/domain/retry/index.ts` (Princípio III, data-model.md §3)
- [X] T021 [P] Criar `tests/unit/countdown.spec.ts` cobrindo o piso em zero, o arredondamento para cima e o instante exato do vencimento, citando FR-018a no nome dos testes (Princípio IV, data-model.md §3)

### A reorganização do `ResultScreen` — o item de maior risco

- [X] T022 Reorganizar `src/features/result/ResultScreen.tsx` para que `<section className="app-card">`, `CardHeader` e o título sejam renderizados **uma única vez** e só o corpo troque conforme `result` seja nulo ou não, mantendo o `early return` do ajuste de lista e **preservando o comportamento atual do corpo** — nenhum texto novo entra aqui (FR-010, SC-004, contracts/loading-card.md §5.1, research §R7)
- [X] T023 Rodar `npm run lint && npm run typecheck && npm test` e confirmar que a suíte inteira passa **sem alteração de asserção** após T022 — é a prova de que a reorganização é estrutural e não comportamental (SC-008, FR-026)

**Checkpoint**: tokens, textos, movimento e o cartão estável estão prontos. As histórias
podem começar, e a suíte existente está verde sem nenhuma asserção tocada.

---

## Phase 3: User Story 1 - Saber que a criação está em curso (Priority: P1) 🎯 MVP

**Goal**: a fase mais longa e mais arriscada do fluxo deixa de ser muda. O cartão passa a
mostrar o disco girando, o título, o subtítulo com a expectativa de duração, a descrição
que pede para não fechar a janela e o rodapé que diz o que está sendo aguardado — e o
aviso de espera por limitação de taxa passa a aparecer também na criação inicial.

**Independent Test**: confirmar a revisão do Spotify com a rede estrangulada e verificar
que os cinco blocos estão na tela, na ordem do arquivo, e que o rodapé troca de
"aguardando" para progresso uma única vez. Entrega valor sozinha, sem os esqueletos.

### Implementação

- [X] T024 [US1] Implementar a regra de exibição de `data-model.md` §1 em `src/features/result/ResultScreen.tsx` — `run.phase === 'creating' && run.outcome === null && run.error === null && creationError === null`, as quatro condições conjuntas e sem tempo mínimo artificial (FR-024, SC-005, data-model.md §1)
- [X] T025 [US1] Criar `src/features/result/CreatingBody.tsx` exportando `CreatingIntro`, que devolve um **Fragment** (nunca um `<div>`, ou a linha do indicador deixa de ser o 2º filho do cartão e o zero de §3 se perde), começando pela linha do indicador: disco `size-12 rounded-pill bg-accent-tint-surface` marcado `aria-hidden`, glifo `<Icon role="loading" className="text-step text-accent-text" />` dentro de `SpinningDisc`, e a coluna `flex flex-col gap-0.5` com título `text-step` e subtítulo `text-meta text-ink-muted` (FR-002 a FR-005, contracts/loading-card.md §2.1 e §3)
- [X] T026 [US1] Acrescentar em `CreatingIntro` o parágrafo de descrição em `text-body text-ink-muted`, sem `role` e sem região viva — o texto é fixo do primeiro ao último quadro (FR-006, contracts/loading-card.md §2.2)
- [X] T027 [US1] Acrescentar em `src/features/result/CreatingBody.tsx` o segundo export, `CreatingFootnote`: **um único** nó `role="status"` em `text-meta text-ink-muted`, cujo texto é a função pura de `data-model.md` §2 sobre `committedItemCount(creation)` — "aguardando" enquanto for zero, `result.creationProgress` a partir do primeiro lote confirmado (FR-011, FR-012, FR-013, contracts/loading-card.md §4.1)
- [X] T028 [US1] Montar em `src/features/result/ResultScreen.tsx`, sob a regra de T024, `CreatingIntro` como 2º filho do cartão e `CreatingFootnote` **depois** da posição da célula compartilhada, deixando entre os dois o lugar que o `CrossFade` ocupa na US2; remover o parágrafo de progresso que hoje vive solto no cartão (FR-001, SC-001, contracts/loading-card.md §5.1)
- [X] T029 [US1] Acrescentar a propriedade `variant: 'spinner' | 'countdown'` em `src/ui/RateLimitWaiting.tsx`, com padrão `'spinner'` que **preserva byte a byte** o comportamento de hoje; na variante `'countdown'` o ícone some por inteiro, os segundos de `segundosRestantes` aparecem `aria-hidden`, e `onCancel` nunca é aceito (FR-018a, FR-018b, contracts/loading-card.md §6.2)
- [X] T030 [US1] Implementar em `src/ui/RateLimitWaiting.tsx` o `setInterval` de um segundo que atualiza a contagem, criado e limpo no mesmo `useEffect` em que `onWaitStateChange` já é assinado — o relógio é I/O e vive no componente, a conversão é a função pura de T020 (Princípio III, contracts/loading-card.md §6.3)
- [X] T031 [US1] Montar `<RateLimitWaiting variant="countdown" />` ao final de `CreatingIntro`, sem `onCancel`, aparecendo só enquanto a espera dura e sumindo sem deixar buraco — é o último nó acima da célula compartilhada (FR-018, FR-013a, contracts/loading-card.md §1 e §6.1)

### Testes

- [X] T032 [US1] Criar `tests/components/creating-card.spec.tsx` com os cinco blocos presentes e na ordem do arquivo durante a fase `creating` (FR-001, SC-001)
- [X] T033 [US1] Acrescentar em `tests/components/creating-card.spec.tsx` a asserção de que o rodapé é **uma** região viva, diz "aguardando" com zero itens confirmados e troca para progresso **uma única vez** no primeiro lote (FR-011, FR-012, FR-013)
- [X] T034 [US1] Acrescentar em `tests/components/creating-card.spec.tsx` a asserção de que o disco e o glifo não recebem foco nem nome acessível (FR-003)
- [X] T035 [US1] Acrescentar em `tests/components/creating-card.spec.tsx` o aviso de espera na criação inicial: aparece, não tem ícone, mostra a contagem `aria-hidden`, **não** oferece cancelar, as duas regiões vivas nunca dizem a mesma coisa, e existe **exatamente um** elemento em rotação na tela — o glifo do disco, enquanto o esqueleto segue pulsando (FR-018 a FR-018b, FR-013a, SC-010)
- [X] T036 [US1] Acrescentar em `tests/components/creating-card.spec.tsx` os três desaparecimentos de FR-024 — `creationError`, `run.error` e `awaiting_reauth` —, em que nenhum indicador de carregamento sobrevive (FR-024, SC-005)
- [X] T036a [US1] Acrescentar em `tests/components/creating-card.spec.tsx` o Edge Case "a criação termina antes de a tela ser vista": uma criação que resolve em um tick não deixa o cartão de carregamento montado além da mudança de fase — **sem piso artificial**, que é exatamente a correção de boa-fé que alguém acrescenta no primeiro relato de "piscou" e que nada hoje reprovaria (spec §Edge Cases, data-model.md §1)
- [X] T037 [US1] Acrescentar em `tests/integration/reauth-creation.spec.ts` a asserção nova de que a retomada reapresenta o carregamento com o rodapé já em **progresso**, nunca em "aguardando" (FR-025)

**Checkpoint**: a espera comunica. A US1 é entregável sozinha — o cartão informa mesmo sem
grade de esqueleto nenhuma.

---

## Phase 4: User Story 2 - Antever a forma do resultado (Priority: P2)

**Goal**: quatro blocos de esqueleto ocupam exatamente o lugar das quatro informações do
resultado, e a troca por elas é uma fusão cruzada de 200ms que não move o cabeçalho nem o
título.

**Independent Test**: medir a posição vertical do cabeçalho e do título durante a criação e
imediatamente depois de o resultado chegar; a diferença exigida é **zero**, não uma
tolerância.

### Implementação

- [X] T038 [US2] Criar `src/features/result/ResultSkeleton.tsx` com `grid gap-2 sm:grid-cols-2` — as **mesmas** classes do `<dl>` do resultado — e quatro blocos `flex flex-col gap-2`, cada um com barra de rótulo `h-3 w-1/2 rounded-hair bg-skeleton` e barra de valor `h-4 w-2/3 rounded-hair bg-skeleton`, ambas dentro de `PulsingBar` (FR-007, FR-008, contracts/loading-card.md §2.3, research §R4)
- [X] T039 [US2] Marcar a grade inteira `aria-hidden` em `src/features/result/ResultSkeleton.tsx` e garantir que nenhum nó interno é focável — ela não carrega informação, e um leitor de tela que a alcançasse anunciaria oito caixas vazias (FR-009)
- [X] T040 [US2] Extrair o `<dl>` de resultado para a função local `ResultStats` em `src/features/result/ResultScreen.tsx`, no molde do `CardHeader` que já mora ali, e montar `CrossFade` como **filho direto do cartão** entre `CreatingIntro` e `CreatingFootnote`, com `ResultSkeleton` no slot de saída e `ResultStats` no de entrada — a célula fica montada nos dois estados, e por isso **não** pode ser filha do corpo de carregamento (FR-001, FR-007, FR-010a, contracts/loading-card.md §5.1 e §5.1.1)
- [X] T041 [US2] Conferir em `src/features/result/ResultScreen.tsx` que a célula do `CrossFade` tem `position: relative`, que ela devolve `null` no estado de `creationError` — sem respiro fantasma do `gap-4` — e que nenhuma propriedade além de `opacity` anima na troca, sem `AnimatePresence mode="wait"` e sem empilhamento na mesma célula de grade (FR-010a, FR-010b, FR-017a, contracts/loading-card.md §5.1.2, contracts/motion.md §2.3, research §R7)

### Testes

- [X] T042 [US2] Acrescentar em `tests/components/creating-card.spec.tsx` a asserção de quatro blocos de esqueleto e de que nenhum é alcançado pela árvore de acessibilidade (FR-007, FR-009)
- [X] T043 [US2] Criar `e2e/creating-loading.spec.ts` medindo `boundingBox().y` do cabeçalho do cartão e do título durante a criação e imediatamente após o resultado, exigindo diferença **0** no projeto `desktop` (FR-010, SC-004, contracts/loading-card.md §3)
- [X] T044 [US2] Acrescentar em `e2e/creating-loading.spec.ts` a verificação de uma coluna e ausência de rolagem horizontal no projeto `narrow-375` (FR-007, SC-006, FR-029)
- [X] T044a [US2] Estender `e2e/creating-loading.spec.ts` com `setViewportSize` a **320px e 1920px** — os dois extremos que o FR-029 nomeia e que nenhum projeto do Playwright exercita. 320 é onde o `sm:` colapsa; 1920 é onde a coluna do cartão para de crescer. Por `setViewportSize` dentro do teste, e não por dois projetos novos, porque a asserção é sobre esta tela e não sobre o fluxo inteiro (FR-029)
- [X] T045 [US2] Acrescentar em `tests/unit/no-orphan-tokens.spec.ts` a asserção de **ponto único de uso** de `bg-accent-tint-surface`, no molde de 008/FR-004, e de que `text-skeleton` e `border-skeleton` não existem em lugar nenhum (FR-019, contracts/tokens.md §5)

**Checkpoint**: o cartão não salta mais quando o resultado chega, e o salto ausente é
medido, não percebido.

---

## Phase 5: User Story 3 - A mesma espera nos dois serviços (Priority: P2)

**Goal**: a variação nasce sem ser caso especial do Spotify. Estrutura, ordem e movimento
idênticos nos dois; variam só o símbolo, a cor da marca e o nome dentro das frases.

**Independent Test**: rodar o ciclo com o YouTube como destino único e conferir a mesma
lista de elementos da US1, com o símbolo e a cor do YouTube e o nome do serviço nos textos.

- [X] T046 [US3] Conferir por leitura do diff que nenhum arquivo introduzido ou editado por esta feature ramifica por `ProviderId` — `CreatingBody.tsx`, `ResultSkeleton.tsx` e `src/ui/motion/` recebem o nome já resolvido por `nameOf(provider)` e nada mais (FR-023, research §R10)
- [X] T047 [US3] Parametrizar `tests/components/creating-card.spec.tsx` pelos dois provedores, exigindo a mesma estrutura e a mesma ordem de blocos, com o símbolo e a tinta de marca corretos no cabeçalho (FR-022, SC-001)
- [X] T048 [US3] Acrescentar em `tests/components/creating-card.spec.tsx` a asserção de que a posição na fila do cabeçalho reflete o **segundo** serviço quando ele entra em criação com dois destinos enfileirados (US3, cenário 3)
- [X] T049 [US3] Estender `tests/a11y/steps.spec.tsx` para auditar a fase `creating` nos dois serviços e nos dois temas, exigindo zero violação séria ou crítica (FR-028, SC-007)

**Checkpoint**: as duas telas são a mesma tela, e o portão de provedor continua fechado.

---

## Phase 6: User Story 4 - Movimento que respeita a preferência do usuário (Priority: P3)

**Goal**: quem pediu para reduzir movimento recebe a mesma informação sem giro, sem
pulsação e sem transição — e sem perder nenhum texto em troca.

**Independent Test**: ativar a preferência, entrar na fase de criação e conferir que nada
anima e que a contagem de textos exibidos é a mesma que sem a preferência.

- [X] T050 [US4] Acrescentar em `tests/components/creating-card.spec.tsx` o bloco com `vi.stubGlobal('matchMedia', …)` devolvendo `prefers-reduced-motion: reduce`, no padrão que `tests/components/shell.spec.tsx` já usa, exigindo que o disco não gire, que as barras não pulsem e que nada entre ou saia com transição (FR-016, SC-003, contracts/motion.md §5)
- [X] T051 [US4] Acrescentar no mesmo arquivo a asserção de **paridade de texto**: título, subtítulo, descrição e rodapé estão todos presentes, e a contagem de textos exibidos é idêntica com e sem a preferência (FR-016, FR-017, SC-003)
- [X] T052 [US4] Acrescentar em `e2e/creating-loading.spec.ts` a execução no projeto `reduced-motion`, cobrindo a fase de criação de ponta a ponta sem animação e com todo o conteúdo presente (SC-003)
- [X] T053 [US4] Registrar em `tests/unit/motion-surface.spec.ts` a asserção de que cada uma das três primitivas consulta `useReducedMotion` — a regra de CSS global não alcança a biblioteca, e `MotionConfig reducedMotion="user"` preservaria a `opacity` que o FR-016 manda suprimir (FR-016, research §R6)

**Checkpoint**: as quatro histórias funcionam de forma independente.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T054 [P] Atualizar `docs/style-guide.md` §Movimento: o sistema deixa de ser "quase sem movimento" e passa a registrar os três movimentos, as duas propriedades autorizadas, o orçamento de 200ms preservado para a fusão cruzada e o interruptor em JavaScript com o motivo pelo qual o de CSS não bastava (contracts/motion.md §7)
- [X] T055 [P] Registrar em `docs/style-guide.md` os dois tokens novos e a faixa de perceptibilidade, com os números produzidos por `tests/unit/contrast.spec.ts` e não transcritos à mão (contracts/tokens.md, CLAUDE.md §Sistema visual)
- [X] T056 Conferir que nenhum `@keyframes` ou utilitário de animação foi deixado para trás em `src/styles/index.css` como resquício das primitivas, e que a regra global de `prefers-reduced-motion` permanece intacta para o resto do produto (FR-016)
- [X] T057 Rodar o portão local completo — `npm run lint && npm run typecheck && npm test` — e confirmar que nenhuma asserção pré-existente foi alterada em todo o diff (SC-008, FR-026)
- [X] T058 Rodar `npm run test:e2e` nos três projetos e `npx playwright test e2e/no-remote-origin.spec.ts`, confirmando que nenhum destino de rede novo aparece durante a fase de criação (SC-009, FR-027)
- [ ] T059 Executar a conferência manual de forma do [quickstart.md](./quickstart.md) §3 nos dois temas e nos dois serviços — inclusive cores forçadas (§3.9) e zoom de texto a 200% (§3.8), que nenhuma máquina desta suíte vê

---

## Dependencies & Execution Order

### Dependências de fase

- **Setup (Fase 1)**: sem dependência. T002/T003 precisam preceder T015–T018, ou a fechadura nasce legalizando o que já entrou.
- **Foundational (Fase 2)**: depende da Fase 1. **Bloqueia todas as histórias.**
- **US1 (Fase 3)**: depende da Fase 2 inteira — em especial de T022 (o cartão estável) e de T015/T018 (`SpinningDisc`).
- **US2 (Fase 4)**: depende da Fase 2 e de T028 da US1, porque o `CrossFade` é montado **entre** `CreatingIntro` e `CreatingFootnote` e precisa dos dois já posicionados.
- **US3 (Fase 5)**: depende da US1; a US2 só é necessária para T047 cobrir a grade nos dois serviços.
- **US4 (Fase 6)**: depende da US1 e da US2 estarem na tela para haver o que suprimir. O código que a satisfaz já entrou em T015–T017; esta fase é **verificação**.
- **Polish (Fase 7)**: depende de todas as histórias desejadas.

### Dentro da Fase 2

```text
T005 → T006 → T007 → T008 → T009 → T009a  (tokens, em cadeia: o valor antes do mapa, o mapa antes do portão)
T010 → T011 → T012 → T013 → T014        (textos: as chaves antes do inventário, o inventário antes do instantâneo)
T015 ∥ T016 ∥ T017 → T018 → T019        (as três primitivas em paralelo, depois o barril e o portão)
T020 → T021                              (função pura, depois o teste)
T022 → T023                              (a reorganização, depois a prova de que nada mudou)
```

As quatro colunas acima são independentes entre si e podem correr em paralelo.

### Dentro de cada história

- Implementação antes do teste que a cobre, **exceto** T023, T046 e T057, que são
  conferências sobre o que já existe.
- `CreatingIntro` (T025) antes de tudo que ele contém (T026, T031); `CreatingFootnote` (T027) antes de T028 montá-lo.
- A grade (T038) **não** é montada dentro do corpo de carregamento: ela entra pelo slot do `CrossFade` em T040, que é filho direto do cartão. Montá-la dentro do `CreatingIntro` desfaria a fusão cruzada, porque a célula desmontaria junto com o carregamento (contracts/loading-card.md §5.1.1).
- A regra de exibição (T024) antes de qualquer montagem, ou o cartão aparece onde não deve.

### Oportunidades de paralelismo

- **Fase 1**: T002, T003 e T004 — três arquivos distintos.
- **Fase 2**: as quatro colunas do bloco acima; dentro da terceira, T015, T016 e T017.
- **Fase 3**: T032 a T036 depois de T031, mas todas no mesmo arquivo — **sem `[P]`**, escrevem em `tests/components/creating-card.spec.tsx`.
- **Fase 7**: T054 e T055 (mesmo arquivo, seções diferentes — coordenar) e T056.

---

## Parallel Example: Fase 2, coluna do movimento

```bash
Task: "Criar src/ui/motion/SpinningDisc.tsx — giro por transform, com useReducedMotion"
Task: "Criar src/ui/motion/PulsingBar.tsx — pulsação por opacity, fase única, nunca zero"
Task: "Criar src/ui/motion/CrossFade.tsx — 200ms por opacity, o que sai fora do fluxo"
# então, em série:
Task: "Criar src/ui/motion/index.ts — exatamente três exports, nenhum reexport de motion"
Task: "Criar tests/unit/motion-surface.spec.ts — a fechadura"
```

---

## Implementation Strategy

### MVP primeiro (só a US1)

1. Fase 1 — as fechaduras.
2. Fase 2 — **crítica**, bloqueia tudo. Parar em T023: a suíte inteira verde, sem asserção alterada.
3. Fase 3 — a US1.
4. **PARAR E VALIDAR**: quickstart §3.1, §3.5 e §3.6 com a rede estrangulada.
5. Entregável: a fase de criação deixa de ser muda, mesmo sem esqueleto nenhum.

### Entrega incremental

1. Setup + Foundational → o cartão é um nó estável e a fechadura está fechada.
2. + US1 → a espera comunica (**MVP**).
3. + US2 → o cartão para de saltar, e o zero é medido.
4. + US3 → a paridade entre os serviços vira asserção.
5. + US4 → a supressão de movimento vira asserção.
6. + Polish → o guia de estilo volta a descrever o código.

### Estratégia com mais de uma pessoa

A Fase 2 é feita em conjunto — as quatro colunas são independentes e cabem em quatro
frentes. Depois dela, US1 e US2 são sequenciais entre si (a grade mora dentro do
`CreatingBody`), enquanto US3 e US4 podem correr em paralelo assim que a US2 fechar.

---

## Notes

- `[P]` = arquivo diferente, sem dependência pendente.
- Todo teste novo cita o `FR-xxx` / `SC-xxx` que garante, no nome ou em comentário — é
  prática do repositório, não formalidade.
- Comentário explica **por quê**, com referência ao requisito ou à seção do research.
- Portão local antes de qualquer commit: `npm run lint`, `npm run typecheck`, `npm test`.
  Esta feature toca o assistente e a criação de playlist, então `npm run test:e2e` também é
  obrigatório antes de publicar.
- Commit após cada tarefa ou grupo lógico. Parar em qualquer checkpoint para validar a
  história isoladamente.
- O que **não** pode ser tocado, em nenhuma tarefa: `src/domain/run/machine.ts`,
  `src/features/result/creationRunner.ts`, o esquema de armazenamento e
  `ProviderCapabilities` (data-model.md §4).
