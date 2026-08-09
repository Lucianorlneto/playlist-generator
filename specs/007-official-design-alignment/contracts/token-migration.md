# Contrato — Migração 005 → 007

**Feature**: 007-official-design-alignment

Este documento existe por um modo de falha específico do Tailwind: **utilitário
inexistente não é erro**. `bg-surface-sunken` depois de o token sair não quebra o
build, não falha no `typecheck` e não aparece em log nenhum — a classe
simplesmente não gera CSS, e a tela fica sem estilo. Uma tela esquecida na
migração é invisível até alguém abri-la.

`tests/unit/no-orphan-tokens.spec.ts` é o portão, e a **§5 deste documento é a
fonte da sua denylist**. O teste falha de propósito enquanto a migração não
terminar; é o que torna "migrei todas as telas" verificável em vez de lembrada.

---

## 1. A boa notícia: quase nenhum nome muda

A 005 escolheu nomes por **papel**, não por aparência. Como esta feature troca
valores e estrutura, mas não a semântica das cores, **catorze dos dezoito tokens
de cor mantêm o nome exato**.

| Token | Nome | Valor |
| --- | --- | --- |
| `--bg` · `--surface` · `--surface-raised` · `--rule` · `--rule-strong` | inalterado | **muda** |
| `--ink` · `--ink-muted` | inalterado | **muda** |
| `--accent` · `--accent-deep` · `--accent-ink` · `--accent-text` | inalterado | **muda** |
| `--state-confident` · `--state-uncertain` · `--state-missing` | inalterado | **muda** |

**Consequência prática**: nenhum `text-ink`, `bg-surface` ou `border-rule` escrito
hoje precisa ser tocado. A migração de cor é quase inteiramente um trabalho em
`tokens.css`, não nos componentes — o que é precisamente o retorno prometido pela
disciplina de token da 005, cobrado agora.

---

## 2. Tokens de cor novos — 4

| Token | Uso | Cuidado |
| --- | --- | --- |
| `--surface-zone` | Barra superior e trilha | **Inverte a direção entre temas**: mais claro que `--bg` no escuro, mais escuro no claro |
| `--state-live` | Ponto de sessão viva no chip | Só `ui` (3:1). Nunca texto |
| `--brand-spotify` | Ícone do provedor | Nunca ação, nunca estado, nunca texto (FR-023) |
| `--brand-youtube` | Ícone do provedor | Idem. Reprova como texto sobre `--surface-raised` (4,29:1) — a restrição tem base medida |

---

## 3. Tokens de cor **não** criados, e por quê

| Nome recusado | Motivo |
| --- | --- |
| `--ink-faint` | A terceira tinta do design (`#5F6878`) reprova em todos os substratos, e todo valor que passa fica indistinguível de `--ink-muted` (razão 1,03 no escuro, 1,07 no claro). A etapa pendente se distingue por **forma** (`research.md` §3) |
| `--accent-tint` · `--state-*-tint` | Continuam **derivados** por `color-mix`, como na 005. Declarar como token criaria a segunda cópia que diverge em silêncio |
| Conjunto `--background` / `--primary` / `--font-primary` | Preset do editor de design, **não referenciado por nenhum nó** do arquivo. Recusado por FR-004 |

---

## 4. Escalas — o que muda de nome e de valor

### Tipografia

| 005 | 007 | Situação |
| --- | --- | --- |
| `--text-data` 0,75rem | `--text-data` 0,75rem | Inalterado |
| `--text-meta` 0,8125rem | `--text-meta` 0,8125rem | Inalterado |
| `--text-body` 0,9375rem | `--text-body` **0,875rem** | Valor muda |
| `--text-item` 0,9375rem | — | **Removido**: fundido em `--text-body` |
| `--text-section` 1,0625rem | `--text-section` **1rem** | Valor muda |
| `--text-step` 1,625rem | `--text-step` **1,5rem** | Valor muda |
| — | `--text-page` 2rem | **Novo**: título de tela |

`--text-item` é o único nome de tipografia removido. Toda ocorrência de
`text-item` vira `text-body`.

### Raio

| 005 | 007 | Situação |
| --- | --- | --- |
| `--radius-control` 4px | `--radius-control` **8px** | Valor muda |
| `--radius-card` 8px | `--radius-card` **12px** | Valor muda |
| `--radius-pill` | inalterado | — |
| — | `--radius-hair` 2px | **Novo** |
| — | `--radius-panel` 16px | **Novo** |

### Espaçamento

Os sete degraus da 005 são preservados **com os mesmos nomes e valores**. Entra
`--spacing-0.5` (2px), porque o design o usa 73 vezes como respiro entre título e
linha de apoio.

### Layout

| 005 | 007 | Situação |
| --- | --- | --- |
| `--container-measure` 46rem | `--container-measure` **42.5rem** | Valor muda |
| `--container-panel` 32rem | inalterado | — |
| `--gutter` 2.5rem | — | **Removido** (FR-029) |
| `--breakpoint-gutter` 40rem | `--breakpoint-shell` **a medir** | Renomeado e remedido |
| — | `--rail-width` · `--side-panel-width` · `--topbar-height` | **Novos** |

---

## 5. Denylist — o que `no-orphan-tokens` deve recusar

O teste falha se qualquer um destes aparecer em `src/**/*.{tsx,css}` depois da
migração:

**Utilitários e variantes da goteira**

- `gutter-row` · `data-numeral` **na função de goteira** · `gutter:` (variante) · `--gutter` · `--breakpoint-gutter`

**Escala removida**

- `text-item` · `--text-item`

**Componente removido**

- Qualquer importação de `@/app/StepIndicator` · qualquer importação de `@/features/connect/SessionHeader`

**Valores literais da paleta anterior** (SC-011)

- `#f4a900` · `#d99700` · `#c98600` · `#9a5b00` · `#1a2332` · `#223045` · `#0d1219` · `#faf7f0`* · `#14706b` · `#4ec4b8` · `#7a5c00`* · `#f0c04a`* · `#b3261e` · `#ff8a7a` · `#e8eaed` · `#9aa8b8` · `#141c26`* · `#5a6473`* · `#e3dccd`* · `#8f887a` · `#2c3a4d` · `#5e7a9d`*

  \* Estes permanecem **em `tokens.css`**, porque o tema claro conserva o
  substrato da 005 (FR-032). A denylist os proíbe **fora** de `tokens.css` — é a
  regra que já vale para todo hex, e `tp/no-raw-visual-values` a cobre.

**Importação de ícone fora do mapa**

- Qualquer importação de `react-icons` fora de `src/ui/icons.ts` (FR-059, SC-016)
- Qualquer importação do índice raiz de `react-icons` (FR-056)

---

## 6. Itens que exigiram decisão

### 6.1 `data-numeral` sai da goteira mas não do projeto

O utilitário faz duas coisas: dá o corpo tipográfico do numeral da goteira **e**
liga `tabular-nums`. A goteira sai; a numeração tabular permanece nas telas de
resultado, onde a diferença medida entre `08` e `11` sem `tabular-nums` era de
4,6px de coluna torta.

**Decisão**: o utilitário permanece, com o papel reduzido a "numeral tabular".
Removê-lo junto com a goteira quebraria alinhamento de coluna — e é uma regressão
que a denylist **não pegaria**, porque o utilitário continuaria existindo.

### 6.2 `SessionHeader` é absorvido, não redesenhado

O chip de conexão da barra superior cobre tudo que o `SessionHeader` mostrava, e
mais. Manter os dois significaria a mesma informação em dois lugares com estados
que podem divergir.

**Decisão**: `ConnectionChip` substitui `SessionHeader`; o arquivo é removido e
seus testes migram. `tests/components/session-header.spec.tsx` vira
`tests/components/connection-chip.spec.tsx`, com os casos preservados.

### 6.3 `StepIndicator` sai inteiro, mas a semântica migra

A régua de progresso `aria-hidden`, a contagem "N de T" para leitor de tela e o
`aria-current="step"` são comportamento acessível conquistado, não decoração.

**Decisão**: `StepRail` herda os três. A régua vira o conector vertical entre
degraus (também `aria-hidden`); a contagem vira o `ordinal` do domínio; o
`aria-current` permanece literal. A sublinha de fase do serviço permanece como
informação de apoio da tela, não da trilha (FR-014).

### 6.4 O tema claro conserva o substrato, e isso é assimetria deliberada

FR-032 mantém `--bg`, `--surface`, `--surface-raised`, `--rule` e `--ink` do tema
Papel da 005. Só a âncora âmbar e o que dela deriva mudam, mais os quatro tokens
novos.

**Consequência registrada**: os dois temas divergem em caráter — o escuro ganha o
substrato do design oficial, o claro conserva o da 005. Foi decidido
conscientemente na clarificação de 2026-08-08. A divergência autorizada é
**cromática apenas**: estrutura, composição e estados são idênticos (FR-046,
SC-015).

### 6.5 `--radius-control` dobra, e isso reverte uma decisão da 005

A 005 fechou o raio de cartão de 12px para 8px com uma tese explícita: "cantos
generosos são o registro visual do painel de SaaS genérico, e a tese do design é
documento, não painel."

**Decisão**: o design oficial reabre para 12px, e FR-001 diz que ele vence. A tese
da 005 fica registrada como **substituída, com o motivo** (FR-044), no guia de
estilo — não apagada.

---

## 7. Como este documento é consumido

| Consumidor | O que usa |
| --- | --- |
| `tests/unit/no-orphan-tokens.spec.ts` | A denylist da §5, literalmente |
| `/speckit-tasks` | As §1 a §4 para dimensionar o trabalho por arquivo |
| `docs/style-guide.md` | A §6 para registrar o que foi substituído e por quê (FR-044) |
| Revisão de código | A §1, para não procurar mudança onde não há |
