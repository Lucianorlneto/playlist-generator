# Contrato — Mapeamento de Migração de Tokens

**Feature**: 005-ui-design-system | **Tarefa**: T009 | **Data**: 2026-08-07

Este documento existe por um motivo específico e vale enunciá-lo antes da tabela:

> **O Tailwind não emite erro para utilitário inexistente.** Ele simplesmente não gera CSS.
> Uma tela que ficou para trás na migração não quebra o build, não falha no `typecheck` e não
> aparece em nenhum log — ela fica sem estilo, e o defeito só é descoberto por alguém que abriu
> aquela tela.

Sem este inventário, "migrei todas as telas" seria afirmação de memória. Com ele, T012 tem contra
o que comparar e a Phase 4 ganha critério objetivo de conclusão (T059).

**Levantamento**: varredura de `src/**/*.tsx` e `src/**/*.css` em 2026-08-07, contra os nomes
declarados no `@theme` de `src/styles/index.css` antes da reescrita de T010.

**Superfície**: 35 utilitários distintos · 234 ocorrências de token de cor · 37 de raio ·
2 de sombra · **38 arquivos**.

---

## 1. Superfície e traço

| Antigo | Ocorrências | Novo | Observação |
| --- | --- | --- | --- |
| `bg-surface` | 14 | `bg-surface` | Nome preservado. O valor passa a variar por tema (`#ffffff` / `#1a2332`) |
| `bg-surface-muted` | 6 | `bg-bg` | Era o fundo da página, não uma superfície. O papel ganhou o nome certo |
| `bg-surface-sunken` | 3 | `bg-surface-raised` | ⚠ **Inversão de nome deliberada** — ver §6.1 |
| `hover:bg-surface-sunken` | 2 | `hover:bg-surface-raised` | idem |
| `border-border` | 16 | `border-rule` | |
| `border-border-strong` | 8 | `border-rule-strong` | |
| `text-border-strong` | 1 | **— sem equivalente** | ⚠ ver §6.2 |

## 2. Tinta

| Antigo | Ocorrências | Novo | Observação |
| --- | --- | --- | --- |
| `text-ink` | 60 | `text-ink` | Nome preservado, valor por tema |
| `hover:text-ink` | 1 | `hover:text-ink` | |
| `text-ink-muted` | 37 | `text-ink-muted` | |
| `text-ink-inverse` | 3 | `text-accent-ink` | ⚠ **Decisão tomada** — ver §6.3 |

## 3. Acento

| Antigo | Ocorrências | Novo | Observação |
| --- | --- | --- | --- |
| `bg-accent` | 4 | `bg-accent` | Verde → âmbar. Continua sendo **só preenchimento** |
| `disabled:hover:bg-accent` | 1 | `disabled:hover:bg-accent` | |
| `hover:bg-accent-strong` | 1 | `hover:bg-accent-deep` | |
| `text-accent-strong` | 1 | `text-accent-text` | |
| `border-accent-strong` | 1 | `border-accent-text` | |
| `bg-accent-soft` | 2 | **— sem equivalente** | ⚠ ver §6.4 |
| `border-accent` | 1 | **— proibido** | ⚠ ver §6.5 |
| `accent-accent` | 2 | `accent-accent` | **Permitido.** Ver §6.6 |

## 4. Estado

Três consolidações acontecem aqui, e todas são **sem perda** — os valores antigos eram
literalmente idênticos, o que quer dizer que a duplicação já era acidental.

| Antigo | Ocorrências | Novo | Observação |
| --- | --- | --- | --- |
| `text-danger` | 4 | `text-state-missing` | Consolidação com `status-not-found` (§6.7) |
| `border-danger` | 8 | `border-state-missing` | |
| `bg-danger-soft` | 5 | `bg-state-missing-tint` | |
| `hover:bg-danger-soft` | 1 | `hover:bg-state-missing-tint` | |
| `text-status-not-found` | 4 | `text-state-missing` | Consolidação (§6.7) |
| `bg-status-not-found-soft` | 2 | `bg-state-missing-tint` | |
| `border-status-not-found` | 2 | `border-state-missing-edge` | |
| `text-status-confident` | 2 | `text-state-confident` | Verde → **teal** (FR-048) |
| `bg-status-confident-soft` | 1 | `bg-state-confident-tint` | |
| `border-status-confident` | 2 | `border-state-confident-edge` | |
| `text-status-uncertain` | 11 | `text-state-uncertain` | Permanece na família âmbar |
| `bg-status-uncertain-soft` | 9 | `bg-state-uncertain-tint` | |
| `border-status-uncertain` | 10 | `border-state-uncertain-edge` | |
| `text-status-neutral` | 3 | `text-ink-muted` | Consolidação (§6.8) |
| `bg-status-neutral-soft` | 3 | `bg-state-neutral-tint` | |

**Nota sobre `-soft` → `-tint`**: a troca de sufixo não é cosmética. Os `-soft` eram tokens
próprios, com hex declarado; os `-tint` são **derivados** por `color-mix` do token de estado com
`--surface`, a 12% no claro e 15% no escuro. Trocar o teal de "confiante" agora exige editar um
valor, não dois — e não existe mais o modo de falha em que alguém edita o forte e esquece o suave.

Mesma lógica para `-edge`: o filete do selo é a cor do estado a 30%, derivada, não declarada.

## 5. Raio e profundidade

O raio passa a ter **escala finita de 3 degraus** (FR-014). Os utilitários genéricos do Tailwind
saem de circulação.

| Antigo | Ocorrências | Novo | Observação |
| --- | --- | --- | --- |
| `rounded-lg` | 30 | `rounded-card` | 0,5rem → 8px |
| `rounded-xl` | 1 | `rounded-card` | Painel do `Dialog`; alinha com os demais cartões |
| `rounded` | 2 | `rounded-control` | Capa de álbum em `MatchRow` |
| `rounded-full` | 4 | `rounded-pill` | |
| `shadow-lg` | 1 | `shadow-card` | `Dialog`; **vira `none` no tema escuro** |
| `shadow-sm` | 1 | **— removido** | ⚠ ver §6.9 |

O raio de cartão cai de 12px (`--radius-card: 0.75rem`) para 8px. É deliberado e está em
contracts/tokens.md §4: canto generoso é o registro visual do painel de SaaS genérico, e a tese do
desenho é documento.

## 5b. Espaçamento e tipografia — as outras duas escalas finitas

T010 declara `--spacing: initial`, `--radius-*: initial`, `--text-*: initial` e
`--font-*: initial`. Isso **desliga a geração sob demanda** do Tailwind: `p-5`, `text-sm` e
`rounded-lg` deixam de existir, em vez de apenas serem desaconselhados.

Confirmado no CSS emitido após T010: `.p-5`, `.text-sm` e `.rounded-lg` não aparecem no build.
Este documento é o que impede que essa ausência vire tela sem estilo.

### Tipografia

| Antigo | Ocorrências | Novo |
| --- | --- | --- |
| `text-sm` | 70 | `text-body` |
| `text-xs` | 7 | `text-meta` — ou `text-data` onde o conteúdo for numeral (§5c) |
| `text-base` | 6 | `text-body` |
| `text-lg` | 1 | `text-section` |
| `text-xl` | 1 | `text-step` |

`text-sm` e `text-base` convergem porque estavam a 1px de distância e a diferença não carregava
hierarquia — a hierarquia nova vem de `--text-section` e `--text-step`, que são degraus de
verdade.

Os degraus novos já embutem peso, entrelinha e tracking (`--text-step--font-weight: 600` etc.),
então `font-semibold` colado num `text-step` passa a ser redundante. Redundância não quebra nada;
vale limpar onde aparecer, sem virar caçada.

### Espaçamento — apenas 11 pontos ficam fora dos 7 degraus

| Arquivo | Antigo | Novo | Nota |
| --- | --- | --- | --- |
| `ui/Button.tsx:22` | `px-2.5 py-1.5` | `px-3 py-1` | Tamanho `sm` |
| `ui/Dialog.tsx:38` | `p-5` | `p-6` | Painel |
| `ui/Toggle.tsx:48` | `w-11` | `w-12` | Trilho |
| `ui/Toggle.tsx:55` | `ml-0.5 h-4.5 w-4.5` | `ml-1 size-4` | Botão |
| `app/StepIndicator.tsx:49` | `py-0.5` | — | T046 reescreve o componente |
| `ui/VersionHintBadge.tsx:31` | `py-0.5` | `py-1` | |
| `credential/RedirectUriHint.tsx:38` | `pl-5` | `pl-6` | Recuo da lista ordenada |
| `review/MatchRow.tsx:90,101` | `size-10` | `size-8` | Capa de álbum (§6.10) |

| `ui/Toggle.tsx:56` | `translate-x-5` | `translate-x-6` | Curso do botão |

`min-w-0`, `inset-0`, `w-full`, `h-full` e `mx-auto` continuam válidos: `--spacing-0` está
declarado e as palavras-chave não passam pela escala numérica.

### Valor arbitrário em colchete — dois casos

Encontrados pelo portão de T012, não pela varredura manual desta seção. Ficam registrados porque
`tp/no-raw-visual-values` (T017) vai recusá-los.

| Arquivo | Antigo | Novo | Nota |
| --- | --- | --- | --- |
| `review/MatchRow.tsx:90` | `text-[0.6rem]` | `text-data` | Rótulo do espaço reservado da capa |
| `ui/Dialog.tsx:37` | `w-[min(32rem,calc(100vw-2rem))]` | ver abaixo | |

O caso do `Dialog` **não é valor visual avulso disfarçado**: é uma restrição de layout responsivo,
da mesma natureza de `--measure`. Vira um token de largura de painel declarado em `index.css`
(`--container-panel: 32rem`) mais `max-w-panel` e recuo lateral pela escala — o que remove o
colchete sem fingir que 32rem é um degrau de espaçamento.

Vale a distinção: a regra existe contra valor escolhido no olho dentro do componente, não contra
matemática de layout. Empurrar a segunda para dentro do sistema de tokens é o que impede que a
regra passe a ser contornada por hábito.

## 5c. Onde `text-data` entra, e por que importa

`text-data` não é só o degrau menor: ele carrega `font-variant-numeric: tabular-nums` pelo
utilitário `data-numeral` (T018). Todo numeral que precisa **alinhar em coluna** usa esse par —
numeral da goteira, duração da faixa, contagem de progresso, orçamento de cota.

A verificação de T004 mostrou que os algarismos de Space Grotesk são proporcionais por padrão, com
4,6 px de diferença entre `08` e `11`. Trocar `text-xs` por `text-meta` num numeral não quebraria o
build nem o teste de token órfão — só deixaria a coluna torta. Por isso a distinção está aqui e não
na cabeça de quem migra.

## 6. Itens que exigiram decisão

Sete casos não têm tradução mecânica. Cada um está resolvido abaixo, com a decisão registrada —
nenhum ficou para ser decidido no meio da migração de uma tela.

### 6.1 `surface-sunken` → `surface-raised`: o nome inverte de propósito

O sistema antigo era claro-apenas, então "afundado" (mais escuro que o branco) descrevia bem.
Num sistema de dois temas, a mesma superfície é **mais escura** que `--surface` no claro e **mais
clara** no escuro — "afundado" descreveria errado metade do tempo.

O nome novo descreve o **papel** (elevação: hover, linha alternada, campo em foco), não a
aparência. Visualmente o resultado no tema claro é equivalente; o que muda é o nome parar de
mentir no tema escuro. Isto é o `DesignToken` de data-model.md §3 aplicado: nome semântico, nunca
descritivo de cor.

### 6.2 `text-border-strong` — sem equivalente, e sem necessidade

Uso único: o separador `›` entre as pílulas de `StepIndicator.tsx:65`. **T046 elimina as pílulas e
os separadores**, substituindo tudo pela régua âmbar. Não há o que mapear porque não há o que
migrar — o elemento deixa de existir.

Usar cor de traço como cor de texto era, além disso, a única ocorrência de um token de borda
aplicado a tinta em todo o código. A migração é boa oportunidade para não reintroduzir isso.

### 6.3 `text-ink-inverse` → `text-accent-ink`

Três usos, todos texto claro sobre o preenchimento de acento: `Button` variante `primary`,
`StepIndicator` etapa ativa, `ResultScreen` ação principal.

**Não pode ser traduzido literalmente.** `--ink-inverse` era quase-branco, e o acento novo é âmbar
`#f4a900`: branco sobre âmbar dá **2,0:1**, e o FR-046 proíbe a combinação em qualquer contexto.
Não existe variante que a permita, por construção.

O token correto é `--accent-ink` — tinta escura desenhada para viver sobre o preenchimento âmbar,
com 8,6:1 no claro e 9,4:1 no escuro (pares 5 e 6). A inversão de luminosidade do rótulo do botão
primário é consequência direta da troca de primária, não um efeito colateral.

### 6.4 `bg-accent-soft` — sem equivalente, dois usos, dois destinos diferentes

- `DraftRecoveryBanner.tsx:95` — a faixa deixa de ter fundo tingido. Passa a `--surface` com uma
  guia de 3px em `--accent` à esquerda (contracts/components.md §10). A informação migra de
  preenchimento para estrutura, que é o que o FR-047 pede.
- `StepIndicator.tsx:51` — etapa concluída. **T046 reescreve o componente inteiro**; concluída
  passa a ser `--ink-muted` sob a régua preenchida, sem fundo próprio.

Nenhum dos dois vira token novo. Fundo âmbar suave era exatamente o que tornava o selo "incerto"
confundível com ação — o problema que o FR-047 existe para resolver.

### 6.5 `border-accent` — proibido pelo FR-050, e a exceção aparente não é exceção

Uso único: a guia esquerda de `DraftRecoveryBanner`. O T017 recusa `border-accent` porque âmbar em
cheia saturação sobre fundo claro dá 2,0:1 como traço delimitador — abaixo do mínimo de 3:1.

Mas a guia de 3px do banner **não é traço delimitador, é preenchimento**: uma barra sólida, que é
justamente o uso que o `--accent` autoriza. A tensão é entre a forma do utilitário e a natureza do
elemento, não entre duas regras.

**Resolução**: a guia é declarada dentro de um utilitário nomeado em `src/styles/index.css`
(`guide-edge`, T018), não como `border-l-accent` no componente. Assim o desenho é preservado, a
regra de lint permanece **sem exceção** — e uma regra sem exceção é a única que continua valendo
depois do terceiro caso especial.

### 6.6 `accent-accent` continua permitido

Dois usos: `SearchProgress.tsx:39` (`<progress>` nativo) e `MatchRow.tsx:69` (caixa de seleção).

`accent-accent` é a propriedade CSS `accent-color`, que pinta o **preenchimento** de controle
nativo — não é texto, não é borda, não é anel de foco. Cai exatamente no uso que o FR-050
autoriza, e a regra de lint de T017 recusa `text-accent`, `border-accent` e `ring-accent`
**nominalmente**, não o prefixo `accent-` inteiro. Vale conferir isso ao escrever a regra: um
padrão largo demais quebraria os dois usos legítimos.

### 6.7 `danger` e `status-not-found` eram a mesma cor

`--color-danger: oklch(52% 0.19 25)` e `--color-status-not-found: oklch(52% 0.19 25)`. Idênticos.
Os pares suaves também: ambos `oklch(96% 0.03 25)`.

A duplicação era acidental — dois nomes para o mesmo vermelho, mantidos em sincronia por
disciplina. A consolidação em `--state-missing` é **sem perda visual** e elimina a possibilidade
de divergirem. 21 ocorrências convergem para um token.

### 6.8 `status-neutral` era `ink-muted`

`--color-status-neutral: oklch(48% 0.014 260)`, idêntico a `--color-ink-muted`. Mesma situação:
consolidação sem perda. O selo neutro passa a usar `text-ink-muted` diretamente, que é o que ele
sempre foi.

`bg-status-neutral-soft` sobrevive como `--state-neutral-tint`, derivado de `--ink-muted`, porque
o selo neutro precisa de fundo tingido para manter a anatomia comum dos selos.

### 6.10 Capa de álbum: `size-10` → `size-8`

40px não é degrau da escala. Os vizinhos são 32px (`--space-8`) e 48px (`--space-12`).

Escolhido **32px**: a capa é apoio para reconhecer a faixa, não o herói da tela — o herói é a
linha (design.md §1). 48px empurraria a altura da linha para cima na tela mais densa do
aplicativo, justamente onde o FR-044 fixa piso de legibilidade e o espaço vertical é o recurso
escasso.

Coincidência que vale não confundir: `--gutter` também mede 2,5rem/40px. A capa **não** é a
goteira e não deve herdar a medida dela.

### 6.9 `shadow-sm` do `Toggle` — removido

O botão do interruptor tinha sombra própria. A profundidade passa a ter **um único nível no tema
claro e nenhum no escuro** (contracts/tokens.md §4); um segundo nível para um elemento de 16px
seria escala fora da escala.

O botão continua se separando do trilho por luminosidade (`--surface` sobre `--accent` ou sobre
`--rule-strong`), que é o mecanismo que o tema escuro usa de qualquer forma. Nada de informação
se perde: o estado do interruptor é anunciado por texto, não por relevo (FR-017).

---

## 7. Utilitários nomeados

Não são tokens, mas atravessam a migração e T018 os reescreve sobre os nomes novos.

| Utilitário | Ocorrências | Situação |
| --- | --- | --- |
| `field-message` | 48 | Reescrito sobre `--ink-muted` e `--text-meta` |
| `focus-ring` | 9 | Reescrito: `outline` em `--accent-text` (T019 troca `box-shadow` por `outline`) |
| `app-card` | 5 | Reescrito: `--surface`, `--rule`, `--radius-card` (8px), `--shadow-card` |
| `status-badge` | 4 | Reescrito sem preenchimento sólido (FR-047) |
| `gutter-row` | — | **Novo** (T018) |
| `data-numeral` | — | **Novo** (T018) |
| `guide-edge` | — | **Novo** (T018), pela decisão de §6.5 |

---

## 8. ⚠ Lacuna de cobertura encontrada por este inventário

**Quatro arquivos consomem token antigo e não estão no escopo de nenhuma tarefa T049–T058.**

| Arquivo | Uso | Por que escapou |
| --- | --- | --- |
| `src/app/App.tsx` | `bg-surface`, `focus-ring`, `rounded-lg` | O link "pular para o conteúdo"; nenhuma tarefa cobre `App.tsx` |
| `src/ui/LiveRegion.tsx` | `text-ink-muted` | contracts/components.md §10 o descreve como "sem estilo visual" — **e ele tem** |
| `src/features/queue/QueueIndicator.tsx` | `text-ink-muted` | Diretório `queue/` não aparece em nenhuma tarefa |
| `src/features/connect/ConnectButton.tsx` | `field-message` ×2 | T050 cobre `connect/` mas nomeia só dois arquivos |

Nenhum deles quebraria o build. Todos ficariam sem estilo em produção — que é precisamente o modo
de falha que este documento existe para tornar impossível.

**Resolução**: o escopo de **T056 foi ampliado** para incluir os quatro. `tests/unit/no-orphan-tokens.spec.ts`
(T012) varre `src/**` inteiro sem lista de exceções, então a lacuna não poderia sobreviver ao
portão de T059 de qualquer forma — mas descobri-la agora custa uma linha de tarefa, e descobri-la
por T059 custaria uma rodada inteira de depuração.

---

## 9. Como este documento é consumido

1. **T012** (`tests/unit/no-orphan-tokens.spec.ts`) usa a coluna "Antigo" como lista de proibidos:
   qualquer ocorrência remanescente em `src/**` é falha.
2. **T049–T058** usam a coluna "Novo" como tradução. Onde a coluna diz "sem equivalente", a §6
   diz o que fazer — nenhuma decisão fica para o meio da migração.
3. **T059** é o portão: o teste verde é a condição objetiva de conclusão da Phase 4.

Divergência entre este documento e o código se resolve **corrigindo o documento**, nunca
duplicando valor (FR-036).
