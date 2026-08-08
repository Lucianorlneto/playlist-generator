---
description: 'Task list for 005-ui-design-system'
---

# Tasks: Identidade Visual e Sistema de Design

**Input**: Design documents from `/specs/005-ui-design-system/`

**Prerequisites**: plan.md, spec.md, design.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Obrigatórios. O Princípio IV da constituição exige verificação executável para todo
invariante, e a spec pede portões automatizados nominalmente (FR-030, FR-031, FR-032, FR-039,
FR-040). Tarefas de teste não são opcionais nesta feature.

**Revisão**: renumerado após `/speckit-analyze`. Ver [Histórico de revisão](#histórico-de-revisão)
no fim do documento.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivo diferente, sem dependência pendente)
- **[Story]**: a qual história de usuário a tarefa pertence (US1, US2, US3)
- Todo caminho de arquivo é relativo à raiz do repositório

---

## Phase 1: Setup — Verificações Bloqueantes e Fonte

**Purpose**: confirmar as três premissas técnicas da Fase 0 antes de escrever código que depende
delas, e embarcar a tipografia. Uma falha aqui muda o desenho, não o cronograma.

- [X] T001 Criar o teste de fumaça de `@theme inline` em `src/styles/probe.css` com um único token, rodar `npm run build` e confirmar em `dist/assets/*.css` que o utilitário emite `var(--…)` e não o hex resolvido; apagar o arquivo de sondagem em seguida e registrar o resultado em `specs/005-ui-design-system/research.md` §1 (quickstart V1) — **bloqueia T010 e toda a Phase 4**
- [X] T002 [P] Baixar Space Grotesk variável, conferir que a licença é SIL OFL 1.1 e versionar o texto integral em `src/assets/fonts/OFL.txt` (quickstart V2, FR-034) — **bloqueia T003**
- [X] T003 Gerar o subconjunto variável (Latin Basic + Latin-1 Supplement + Latin Extended-A, pesos 400–700) em `src/assets/fonts/space-grotesk-subset.woff2`, preservando explicitamente a feature `tnum`, e registrar o comando exato usado em `specs/005-ui-design-system/research.md` §3 (research §3)
- [X] T004 Verificar em navegador que `font-variant-numeric: tabular-nums` produz avanço uniforme no arquivo subsetado, comparando `08` e `11` lado a lado; se falhar, aplicar o plano B de research §4 (largura fixa no contêiner) e registrar a mudança em `specs/005-ui-design-system/research.md` (quickstart V3) — **bloqueia T043**
- [X] T005 [P] Criar os diretórios novos: `public/`, `docs/`, `src/assets/fonts/`, `src/domain/theme/`, `src/services/theme/`, `src/features/theme/`
- [X] T006 Declarar `@font-face` de Space Grotesk em `src/styles/index.css` com `font-display: swap`, mais um `@font-face` de fallback com `size-adjust` ajustado à métrica da família, para que a substituição não desloque conteúdo (FR-037, SC-015)

**Checkpoint**: as três premissas de research estão confirmadas ou corrigidas; a fonte está no repositório.

---

## Phase 2: Foundational — Camada de Tokens e Portões

**⚠️ CRITICAL**: nenhuma história pode começar antes desta fase. Os tokens são a origem única de
todo valor visual e os portões são o que impede a feature de regredir silenciosamente.

**⚠️ Modo de falha desta fase**: os nomes de token mudam (`surface-sunken`, `border-strong`,
`ink-inverse`, `accent-soft`, `danger`, `status-*` deixam de existir). **O Tailwind não emite erro
para utilitário inexistente** — ele simplesmente não gera CSS. Uma tela que ficou para trás não
quebra o build: ela fica sem estilo. T009 e T012 existem por isso.

- [X] T007 Criar `src/styles/tokens.css` com os valores brutos dos 14 tokens de cor em `:root` (tema Papel) e em `[data-theme='dark']` (tema Noite), mais `@media (prefers-color-scheme: dark)` aplicando os valores escuros quando não há atributo — exatamente a tabela de `contracts/tokens.md` §1 (FR-001, FR-002, FR-003, FR-041, FR-049)
- [X] T008 Acrescentar `color-scheme: light` e `color-scheme: dark` aos respectivos blocos de `src/styles/tokens.css`, para que `<progress>`, barras de rolagem e controles nativos acompanhem o tema (research §9)
- [X] T009 Levantar em `src/**/*.tsx` e `src/**/*.css` todo utilitário derivado dos tokens antigos e escrever o mapeamento antigo→novo em `specs/005-ui-design-system/contracts/token-migration.md`, marcando explicitamente os que não têm equivalente e exigem decisão — **bloqueia T010; sem este inventário a migração da Phase 4 é adivinhação**
- [X] T010 Reescrever `src/styles/index.css` mapeando em `@theme inline` os nomes semânticos para os brutos de `tokens.css`, e declarar as escalas finitas de espaçamento (7 degraus), raio (3) e tipografia (6) de `contracts/tokens.md` §3 e §4 (FR-004, FR-014, FR-028)
- [X] T011 Definir a profundidade assimétrica em `src/styles/index.css`: um nível de sombra no tema claro, nenhuma sombra no escuro com separação por degrau de luminosidade e filete de 1px (`contracts/tokens.md` §4)
- [X] T012 Criar `tests/unit/no-orphan-tokens.spec.ts` varrendo `src/**/*.tsx` e `src/**/*.css` e falhando ao encontrar utilitário derivado de token que não existe mais em `src/styles/index.css`, usando o mapeamento de T009 — **este teste falha de propósito até a Phase 4 terminar; é ele que torna a migração das telas verificável em vez de confiada à memória** (Princípio IV)
- [X] T013 [P] Criar `src/domain/theme/contrast.ts` com a razão de contraste WCAG 2.x entre dois valores de cor, como função pura, sem DOM e sem I/O (Princípio III, FR-030)
- [X] T014 [P] Criar `src/domain/theme/approvedPairs.ts` com a lista fechada de pares aprovados de `contracts/tokens.md` §2, cada entrada declarando frente, fundo, uso (`text` | `large-text` | `ui`) e onde aparece (FR-027, FR-030)
- [X] T015 Criar `tests/unit/contrast.spec.ts` percorrendo a lista de pares nos dois temas, falhando por par reprovado **e** por par ausente, citando FR-030 e SC-001 no nome dos casos (Princípio IV, rastreabilidade)
- [X] T016 Resolver o par 13 reprovado (`--rule-strong` sobre `--bg`, 2,0:1 contra mínimo de 3:1): adotar a separação por superfície com a borda como reforço não essencial, ou escurecer/clarear `--rule-strong` até passar; atualizar `src/styles/tokens.css`, `contracts/tokens.md` §2 e o motivo da escolha em `specs/005-ui-design-system/research.md` — **T015 falha até esta tarefa concluir, e isso é intencional**
- [X] T017 [P] Criar a regra `tp/no-raw-visual-values` em `eslint-rules/index.js`, recusando em `src/features/`, `src/app/` e `src/ui/`: (a) utilitário Tailwind de cor, espaçamento ou raio com valor arbitrário em colchete; (b) escala numérica crua de cor; (c) `text-accent`, `border-accent` e `ring-accent` — o âmbar em cheia saturação só existe como preenchimento, e para texto, borda e foco o token correto é `--accent-text` (FR-040, FR-046, FR-050, SC-009); registrar a regra em `eslint.config.js`
- [X] T018 Declarar em `src/styles/index.css` os utilitários nomeados de `contracts/components.md` §11: reescrever `app-card`, `focus-ring`, `status-badge` e `field-message` sobre os tokens novos, e criar `gutter-row` e `data-numeral`
- [X] T019 Trocar `focus-ring` para `outline` em vez de `box-shadow`, garantindo que o foco sobreviva ao modo de cores forçadas (research §12, FR-016)

**Checkpoint**: os tokens existem, o contraste é verificado por máquina, o lint impede valor avulso e o teste de token órfão sabe exatamente quantas telas faltam.

---

## Phase 3: User Story 1 — Escolher entre tema claro e escuro (P1) 🎯 MVP

**Goal**: o usuário abre a aplicação no tema que o sistema indica, troca por um controle visível
em qualquer etapa sem perder trabalho, e a escolha sobrevive ao fechamento do navegador.

**Independent Test**: abrir com o sistema em escuro e em claro, acionar o controle em cada etapa,
recarregar e confirmar persistência — tudo antes de qualquer componente ser redesenhado.

### Domínio e armazenamento

- [X] T020 [P] [US1] Criar `src/domain/theme/index.ts` com os tipos `ThemePreference` e `EffectiveTheme` e a função pura `resolveTheme(preference, systemPrefersDark)`, implementando a tabela de quatro linhas de `data-model.md` §2 (FR-005, FR-008, FR-009)
- [X] T021 [P] [US1] Criar `tests/unit/theme-resolution.spec.ts` cobrindo as quatro combinações mais a validação de valor desconhecido, citando FR-005, FR-008 e FR-009
- [X] T022 [US1] Acrescentar `theme: 'tp.v2.theme'` a `STORAGE_KEYS` em `src/services/storage/schema.ts` como valor literal — **não** como função de `ProviderId`, que é o que garante o isolamento de FR-013 (`contracts/storage.md` §1)
- [X] T023 [US1] Criar `src/services/storage/themeRepo.ts` lendo e gravando o registro `{ schemaVersion: 2, preference }` por `readVersioned`/`writeVersioned`, devolvendo `'system'` em toda situação de falha (FR-011, FR-012, `contracts/storage.md` §2 e §3)
- [X] T024 [US1] Filtrar a chave `tp.v2.theme` no consumidor de `onStorageWarning`, para que falha ao gravar preferência de cor nunca produza mensagem visível ao usuário (FR-011, `contracts/storage.md` §3)

### Serviço, estado e arranque

- [X] T025 [P] [US1] Criar `src/services/theme/systemPreference.ts` encapsulando `matchMedia('(prefers-color-scheme: dark)')`, expondo leitura e assinatura de mudança com função de cancelamento (Princípio III)
- [X] T026 [US1] Criar `src/store/themeSlice.ts` com a preferência e o tema efetivo, como fatia independente que **não** passa pelo caminho de reidratação do rascunho — é o que garante FR-007 (`data-model.md` §2)
- [X] T027 [US1] Ligar em `src/app/bootstrap.ts` a leitura inicial da preferência, a assinatura da mudança do sistema e a escrita do atributo `data-theme` no elemento raiz, ignorando o evento do sistema quando a preferência é manual (FR-009)
- [X] T028 [US1] Criar `public/theme-boot.js` como script clássico que lê `tp.v2.theme` e escreve `data-theme` no elemento raiz, e referenciá-lo em `index.html` no `<head>` **antes** do `<script type="module">`, sem nenhum código inline (FR-010, research §2)
- [X] T029 [US1] Criar `tests/unit/theme-boot-sync.spec.ts` lendo o texto de `public/theme-boot.js` e falhando se ele não contiver a chave exportada por `STORAGE_KEYS.theme`, não referenciar o campo `preference` ou não tratar os três valores válidos (`contracts/storage.md` §5)

### Interface

- [X] T030 [P] [US1] Acrescentar a `src/i18n/pt-BR.ts` os textos do controle de tema — rótulo do grupo e as três opções — respeitando `tp/no-ui-text-literals` (FR-022)
- [X] T031 [US1] Criar `src/features/theme/ThemeControl.tsx` como `radiogroup` de três opções (Claro · Escuro · Sistema), navegável por setas, colapsando para só ícones abaixo de `--gutter-collapse` com nome acessível preservado (FR-006, research §8, `contracts/components.md` §7)
- [X] T032 [US1] Inserir o `ThemeControl` no cabeçalho de `src/app/Wizard.tsx`, visível em todas as etapas, sem deslocar o `SessionHeader` nem alterar a ordem de tabulação existente do restante da tela (FR-006, SC-016)

### Verificação

- [X] T033 [P] [US1] Criar `tests/components/theme-control.spec.tsx` cobrindo seleção por teclado, estado anunciado a leitor de tela e nome acessível no modo colapsado (SC-010)
- [X] T034 [P] [US1] Criar `tests/integration/theme-persistence.spec.ts` cobrindo persistência entre sessões, retorno ao sistema, armazenamento indisponível, JSON corrompido, forma inválida e versão divergente — sem mensagem visível em nenhum caso (FR-032, FR-011, SC-005)
- [X] T035 [US1] Criar `e2e/theme.spec.ts` verificando: persistência após recarga; troca de tema durante busca em andamento sem interromper nem reiniciar a execução; e ausência de piscada com preferência gravada divergente do sistema — **método declarado**: asserção de que `data-theme` já está no elemento raiz antes de o primeiro módulo executar, mais captura de tela no primeiro `paint` comparando a cor de fundo (FR-007, FR-010, SC-003, SC-004)

**Checkpoint**: US1 entregue e testável sozinha. A aplicação já tem dois temas funcionais, ainda com os componentes antigos.

---

## Phase 4: User Story 2 — Interface com personalidade própria (P2)

**Goal**: identidade visual reconhecível e coerente nas cinco etapas, com a goteira numerada como
elemento-assinatura, sem acrescentar nenhum passo ao fluxo.

**Independent Test**: percorrer o fluxo completo nos dois temas e confirmar, tela a tela, que
nenhum elemento escapa do vocabulário definido. **T012 verde é a condição objetiva de conclusão
desta fase.**

**Depends on**: Phase 2 (tokens). Não depende de US1 — os componentes podem ser migrados com o
tema fixo, embora a validação nos dois temas exija US1 concluída.

### Primitivos

- [X] T036 [P] [US2] Reescrever `src/ui/Button.tsx` sobre os tokens: `primary` passa a preenchimento `--accent` com texto `--accent-ink`, mantendo o mapa explícito de literais; nenhuma variante permite texto claro sobre âmbar (FR-045, FR-046, `contracts/components.md` §1)
- [X] T037 [P] [US2] Reescrever `src/ui/TextField.tsx` e `src/ui/TextArea.tsx` com os estados de repouso, foco, erro e desabilitado de `contracts/components.md` §2 (FR-015)
- [X] T038 [P] [US2] Reescrever `src/ui/Toggle.tsx` sobre os tokens, com estado anunciado por texto e não só por posição (FR-017)
- [X] T039 [P] [US2] Reescrever `src/ui/Dialog.tsx` com véu por tema e painel sem sombra no tema escuro (`contracts/components.md` §4)
- [X] T040 [P] [US2] Reescrever `src/ui/StepHeading.tsx`, `src/ui/CopyButton.tsx`, `src/ui/RateLimitWaiting.tsx` e `src/ui/VersionHintBadge.tsx` sobre os tokens (`contracts/components.md` §10)
- [X] T041 [P] [US2] Aplicar `src/features/credential/MaskedValue.tsx` sobre `data-numeral` com algarismos tabulares (`contracts/components.md` §10)

### Estado e assinatura

- [X] T042 [US2] Reescrever `src/features/review/StatusBadge.tsx` com a anatomia de tinta + ícone + rótulo, sem preenchimento sólido, migrando "confiante" do verde para o teal e mantendo "incerta" na família âmbar e "não encontrada" em vermelho (FR-047, FR-048, `contracts/components.md` §5)
- [X] T043 [US2] Reescrever `src/features/review/MatchRow.tsx` com a estrutura de goteira: numeral da linha original em `--accent-text` e `data-numeral`, entrada colada acima, correspondência abaixo, selo de estado ao final; colapso responsivo do numeral para prefixo em linha preservando o alinhamento. Fixar o piso de legibilidade da grade densa — tamanho mínimo e entrelinha explícitos, nunca inferiores aos atuais (design.md §5, `contracts/components.md` §9, **FR-044**) — **depende de T004**
- [X] T044 [US2] Criar em `tests/components/review.spec.tsx` o caso que fixa o piso de legibilidade da grade: falha se o tamanho de fonte ou a entrelinha do nome de faixa e do artista ficarem abaixo dos valores declarados em T043, citando FR-044 — **é o que impede a personalidade tipográfica de sair cara na tela mais densa do app**
- [X] T045 [US2] Garantir que o numeral exibido é o índice da linha de entrada e sobrevive a busca, edição, deduplicação, falha parcial e retomada, verificando contra `src/domain/run/lines.ts`; propagar a mesma numeração para `src/features/result/FailedLines.tsx` e `src/features/summary/SummaryScreen.tsx` (design.md §5)
- [X] T046 [US2] Reescrever `src/app/StepIndicator.tsx` substituindo as pílulas pela régua âmbar que preenche, com nomes das etapas abaixo, preservando `nav`/`ol`, `aria-current="step"` e a contagem "N de T"; a régua é `aria-hidden` (`contracts/components.md` §6)
- [X] T047 [P] [US2] Aplicar os tokens a `src/features/review/SearchProgress.tsx`, mantendo o `<progress>` nativo e pondo a contagem em `data-numeral` (`contracts/components.md` §8)

### Telas

- [X] T048 [US2] Aplicar em `src/app/Wizard.tsx` a coluna de `--measure` (46rem) e a goteira de `--gutter` reservada em todas as etapas, mantendo a mesma borda esquerda de conteúdo em todo o fluxo (design.md §4)
- [X] T049 [P] [US2] Migrar as telas de credencial para os tokens novos, usando o mapeamento de T009: `src/features/credential/CredentialStep.tsx`, `CredentialForm.tsx`, `RemoveCredential.tsx` e `RedirectUriHint.tsx` (FR-004, FR-018)
- [X] T050 [P] [US2] Migrar as telas de conexão: `src/features/connect/SessionHeader.tsx` e `ReauthDialog.tsx` (FR-004, FR-018)
- [X] T051 [P] [US2] Migrar as telas de destino: `src/features/destinations/DestinationSelector.tsx` e `DestinationsStep.tsx` (FR-004, FR-018)
- [X] T052 [P] [US2] Migrar as telas de entrada: `src/features/input/InputScreen.tsx` e `ListReduction.tsx` (FR-004, FR-018)
- [X] T053 [P] [US2] Migrar as telas de revisão: `src/features/review/ReviewScreen.tsx`, `Alternatives.tsx`, `LineEditor.tsx` e `PlaylistConfigForm.tsx` (FR-004, FR-018)
- [X] T054 [P] [US2] Migrar cota e serviço: `src/features/quota/QuotaEstimateScreen.tsx` e `src/features/service/ServiceStep.tsx` (FR-004, FR-018)
- [X] T055 [P] [US2] Migrar resultado e resumo: `src/features/result/ResultScreen.tsx`, `FailedLines.tsx`, `RetryRemaining.tsx` e `src/features/summary/SummaryScreen.tsx` (FR-004, FR-018)
- [X] T056 [P] [US2] Aplicar os tokens a `src/app/DraftRecoveryBanner.tsx`, `src/features/result/FolderNotice.tsx` e `src/features/connect/AuthError.tsx` (`contracts/components.md` §10), **mais os quatro arquivos que o inventário de T009 encontrou sem tarefa atribuída** — `src/app/App.tsx`, `src/ui/LiveRegion.tsx`, `src/features/queue/QueueIndicator.tsx` e `src/features/connect/ConnectButton.tsx` (`contracts/token-migration.md` §8)
- [X] T057 [P] [US2] Dar contorno de 1px em `--rule-strong` e `--radius-control` às capas de álbum vindas de `i.scdn.co` e `i.ytimg.com`, garantindo separação do fundo nos dois temas (FR-021)
- [X] T058 [P] [US2] Declarar o bloco `prefers-reduced-motion: reduce` em `src/styles/index.css` suprimindo a transição da régua e qualquer animação decorativa, sem perda de informação (FR-020)
- [X] T059 [US2] Confirmar que `tests/unit/no-orphan-tokens.spec.ts` (T012) passa — nenhuma referência a token removido restou em `src/**`. **Enquanto este teste falhar, a Phase 4 não está concluída, independentemente de as telas parecerem certas no navegador**
- [X] T060 [US2] Revisar as cinco telas confirmando que a hierarquia torna evidente a ação principal de cada etapa sem leitura completa, e que nenhum passo, clique ou decisão foi acrescentado (FR-018, FR-019, SC-006, SC-007)

### Verificação

- [X] T061 [US2] Parametrizar `tests/a11y/steps.spec.tsx` por tema, executando a suíte inteira nos dois com o atributo raiz alternado (FR-031, SC-002)
- [X] T062 [P] [US2] Estender `e2e/narrow-viewport.spec.ts` para rodar nos dois temas em 320 px, confirmando ausência de rolagem horizontal e alvos acionáveis (FR-023, SC-011)
- [X] T063 [US2] Estender `e2e/keyboard.spec.ts` para verificar foco visível em todos os elementos interativos nos dois temas, incluindo o `ThemeControl`; e ajustar os seletores dos testes de componente que a reorganização estrutural quebrou, **sem alterar nenhuma asserção de comportamento** — um diff que mude o que um teste afirma é sinal de escopo estourado (FR-016, SC-010, SC-012)

**Checkpoint**: US2 entregue. A identidade está aplicada, o teste de token órfão está verde e a acessibilidade verificada nos dois temas.

---

## Phase 5: User Story 3 — Guia de estilo (P3)

**Goal**: um documento que sirva de árbitro para decisões visuais futuras.

**Independent Test**: pedir a alguém que não implementou para descrever, só com o guia, um botão
primário desabilitado no tema escuro, e conferir com o que existe na aplicação.

**Depends on**: Phase 2 e Phase 4 — o guia descreve o que foi construído, e escrevê-lo antes
produziria prosa que envelhece antes de nascer.

- [X] T064 [US3] Escrever `docs/style-guide.md` com paleta e papéis semânticos, escala tipográfica, escala de espaçamento, raios, profundidade, estados de interação e regras de acessibilidade, nos dois temas; incluir o comando de subset da fonte registrado em research §3 por T003 (FR-025)
- [X] T065 [US3] Documentar em `docs/style-guide.md` cada componente reutilizável — para que serve, quando usar, quando não usar, e todos os estados nos dois temas — cobrindo os 11 de `contracts/components.md` (FR-026, SC-008)
- [X] T066 [US3] Documentar em `docs/style-guide.md` a tabela de pares aprovados com as razões de contraste **produzidas pelo teste**, não recalculadas à mão (FR-027)
- [X] T067 [US3] Declarar em `docs/style-guide.md` que a definição normativa de cada valor é o ponto único no código e que o documento o descreve, de modo que divergência se resolva corrigindo o documento e nunca duplicando o valor (FR-036)

**Checkpoint**: US3 entregue. O sistema tem árbitro escrito.

---

## Phase 6: Polish e Preocupações Transversais

- [X] T068 [P] Criar `tests/unit/i18n-stability.spec.ts` com instantâneo de `src/i18n/pt-BR.ts` que **permite adição de chave e recusa modificação de valor existente**, garantindo que nenhum texto da aplicação mudou nesta feature (FR-035, SC-012)
- [X] T069 [P] Estender `tests/unit/no-secrets.spec.ts` para recusar `url(http…)`, `@import` externo e `src:` de `@font-face` apontando para fora do repositório (FR-039, research §6)
- [X] T070 [P] Acrescentar em `e2e/support/` um ouvinte de requisições que falhe se alguma escapar da lista de hosts autorizados, com os provedores mockados (FR-039, SC-014)
- [X] T071 [P] Verificar que a soma dos `.woff2` em `dist/` fica abaixo de 80 KB, e registrar a medida em `docs/style-guide.md` (SC-013, quickstart cenário 8)
- [X] T072 Executar o portão local completo — `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e` — confirmando que nenhuma expectativa de comportamento foi alterada (SC-012, portão da constituição)
- [X] T073 Percorrer o `quickstart.md` inteiro, cenários 1 a 11, e registrar o resultado em `specs/005-ui-design-system/quickstart-results.md` no formato já usado pelas features anteriores
- [X] T074 Confirmar etapa a etapa que a ordem de tabulação e a ordem lógica de leitura permanecem equivalentes às anteriores, exceto pela entrada do `ThemeControl` (SC-016, FR-033, FR-038)
- [X] T075 [P] Criar a skill `.claude/skills/playlist-brand/SKILL.md` com a paleta, a tipografia e as regras de uso já confirmadas pelo portão de contraste, no formato do `brand-guidelines`, **sem sobrescrever a skill da Anthropic** — pendência combinada fora do escopo da spec, a ser confirmada com o usuário antes de executar

---

## Dependências

```text
Phase 1 (Setup)
   T001 ──────────────┐
   T002 → T003 → T004 │
                      ▼
Phase 2 (Foundational) ← BLOQUEIA TUDO
   T007 → T008 → T009 → T010 → T011 → T012 → T018 → T019
                          │       (inventário)  (portão de órfãos)
   T013 ┐                 │
   T014 ┴→ T015 → T016    │
   T017                   │
                          │
        ┌─────────────────┴─────────────┐
        ▼                               ▼
Phase 3 (US1 · P1)              Phase 4 (US2 · P2)
   T020 → T021                     T036…T041 [P]
   T022 → T023 → T024              T042 → T043 (dep. T004) → T044 → T045
   T025 → T026 → T027              T046, T047
   T028 → T029                     T048 → T049…T058 [P] → T059 (portão) → T060
   T030 → T031 → T032              T061, T062, T063
   T033, T034, T035
        │                               │
        └───────────────┬───────────────┘
                        ▼
                Phase 5 (US3 · P3)
                   T064 → T065 → T066 → T067
                        ▼
                Phase 6 (Polish)
                   T068…T075
```

**Dependências entre histórias**: US1 e US2 são independentes e podem ser construídas em
paralelo depois da Phase 2. US3 depende de ambas por natureza — descreve o que existe.

**A única dependência cruzada real**: validar US2 nos dois temas exige US1 pronta. Construir US2
não exige.

**Dois portões dentro da Phase 2 que amarram a Phase 4**: T009 (inventário) diz o que precisa ser
migrado; T012 (teste de órfãos) diz quando terminou. Sem eles, "migrei todas as telas" é
afirmação de memória, e o modo de falha é silencioso.

---

## Oportunidades de paralelismo

**Phase 1**: T002 e T005 em paralelo.

**Phase 2**: T013, T014 e T017 em paralelo — três arquivos distintos, sem dependência entre si.

**Phase 3**: T020+T021 (domínio), T025 (serviço) e T030 (i18n) em paralelo. Depois, T033 e T034
em paralelo.

**Phase 4**: o maior bloco de paralelismo da feature. Primeiro T036–T041 (seis primitivos
independentes); depois T049–T058, que são **dez tarefas de migração de tela totalmente
paralelas**, cada uma num conjunto de arquivos distinto, todas guiadas pelo mesmo mapeamento de
T009. Por fim T062 e T063.

**Phase 6**: T068, T069, T070, T071 e T075 em paralelo.

---

## Estratégia de implementação

**MVP**: Phase 1 + Phase 2 + Phase 3 (US1) — 35 tarefas. Entrega dois temas funcionais, com
controle acessível e persistência verificada, sobre os componentes atuais. Já resolve a queixa de
conforto visual e valida a camada de tokens em uso real antes de qualquer componente ser tocado.

**Incremento 2**: Phase 4 (US2) — 28 tarefas. É onde a queixa de "genérica e sem personalidade" é
de fato respondida, e é a fase mais pesada da feature. O paralelismo de T049–T058 é o que a torna
tratável.

**Incremento 3**: Phase 5 (US3) e Phase 6. O guia deve ser escrito com os números que o teste
produziu, não com os que estimei no plano.

**Duas ordens que eu recomendo não inverter**:

1. **T016 antes de qualquer trabalho de componente.** O par de contraste reprovado muda a regra de
   borda do sistema inteiro, e descobrir isso depois de vinte componentes migrados custa vinte
   reedições.
2. **T009 e T012 antes da Phase 4.** O inventário e o portão de órfãos existem porque o Tailwind
   não avisa quando um utilitário deixa de existir — a tela some de estilo sem quebrar o build.

**Corte defensável se o tempo apertar**: adiar T045 (propagação da numeração para falhas e resumo).
A assinatura continua aparecendo na revisão, que é onde ela mais importa — mas vale saber que o
argumento inteiro dela é sobreviver à falha, então esse corte enfraquece a ideia mais do que
parece. **Não é defensável** cortar T059: sem ele a Phase 4 não tem critério objetivo de conclusão.

---

## Histórico de execução

**2026-08-07 — 75 de 75 tarefas concluídas.** Resultado completo em
[quickstart-results.md](./quickstart-results.md).

Portão local: `lint` ✅ · `typecheck` ✅ · `test` ✅ 902 testes / 69 arquivos ·
`test:e2e` ✅ 98 testes / 2 viewports. Nenhuma dependência nova.

**T075 executada após confirmação explícita do usuário**, como a própria tarefa exigia. A skill
`.claude/skills/playlist-brand/SKILL.md` foi criada em diretório próprio; `brand-guidelines`, a
skill da Anthropic, permanece intocada.

Duas ordens que a tarefa pedia para não inverter foram respeitadas, e as duas se pagaram:

- **T009 antes da Phase 4** — o inventário encontrou, antes de qualquer código, quatro arquivos com
  token antigo que nenhuma tarefa cobria. Nenhum quebraria o build; todos ficariam sem estilo.
- **T016 antes de qualquer componente** — o par reprovado se revelou pior que o estimado (1,7:1 no
  claro contra 2,0 previsto) e a resolução separou `--rule` de `--rule-strong` em funções distintas,
  o que mudou a regra de borda de todos os componentes migrados depois.

Divergências entre o planejado e o executado estão na tabela final de `quickstart-results.md`.

---

## Histórico de revisão

**2026-08-07 — revisão pós-`/speckit-analyze`**. De 64 para 75 tarefas, com renumeração completa
(nenhuma tarefa havia sido executada, então o custo foi zero).

| Achado | Severidade | Como foi resolvido |
| --- | --- | --- |
| **C1** — 18 telas com estilo próprio sem tarefa; Tailwind não erra em utilitário inexistente, então a quebra seria silenciosa | CRITICAL | **T009** (inventário de mapeamento), **T012** (teste de token órfão), **T049–T055** (sete tarefas de migração cobrindo 19 arquivos), **T059** (portão de conclusão da fase) |
| **C2** — FR-044, piso de legibilidade da grade densa, sem cobertura | MEDIUM | Escopo de **T043** ampliado; **T044** criada para fixar o piso em teste |
| **C3** — FR-050 sem verificação; nada impedia âmbar cheio como texto | MEDIUM | **T017** ampliada para recusar `text-accent`, `border-accent` e `ring-accent` |
| **C4** — FR-035, textos existentes inalterados, sem verificação | MEDIUM | **T068** criada com instantâneo de `src/i18n/pt-BR.ts` que permite adição e recusa modificação |
| **C6** — SC-006 sem citação | LOW | Citado em **T060** |
| **I1** — T003 gravava em `docs/style-guide.md` antes de o arquivo existir | MEDIUM | T003 passa a registrar em `research.md` §3; **T064** carrega para o guia |
| **U1** — "ausência de piscada" sem método declarado | MEDIUM | Método explicitado em **T035** |
| **U2** — ajuste de seletores sem enumeração | LOW | Absorvido em **T063** |
| **D1** — sobreposição FR-019/SC-006 e FR-033/FR-038/SC-016 | LOW | T060 e T074 com escopos separados |

**I2 — resolvido em 2026-08-07, por refinamento de redação.** O FR-003 exigia "mesma família
cromática" entre os temas, enquanto o desenho tem substrato quente no claro e azul no escuro. A
redação passou a nomear o que de fato ancora a identidade: a mesma cor primária e a mesma família
de tinta, com o substrato livre para divergir em temperatura. O desenho não mudou — a spec passou
a descrever com precisão o que já estava projetado, e a coerência entre temas ganhou duas âncoras
verificáveis no lugar de uma comparação subjetiva de matiz.

Consequência para a implementação: **T007 permanece válido sem alteração**, e a verificação de
coerência entre temas passa a ser objetiva — `--accent` idêntico nos dois e `--ink` na mesma
família — em vez de julgamento sobre a proximidade dos fundos.
