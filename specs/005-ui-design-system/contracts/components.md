# Contrato — Componentes do Sistema

**Feature**: 005-ui-design-system

Anatomia, variantes e estados de cada componente reutilizável. Este contrato define **o que**
cada componente é; `docs/style-guide.md` (FR-026) o expande com exemplos visuais nos dois temas.

Regra transversal, que vale para todos (FR-047): **preenchimento sólido significa acionável.**
Selo e indicador de estado nunca usam preenchimento sólido.

Estados obrigatórios para todo elemento interativo (FR-015): repouso, foco por teclado, hover,
ativo, desabilitado e — quando aplicável — erro e carregando.

---

## 1. `Button` — `src/ui/Button.tsx`

Ação. Variantes resolvidas por mapa explícito de literais, nunca por concatenação — a convenção
já existente no arquivo se mantém.

| Variante | Repouso | Hover | Uso |
| --- | --- | --- | --- |
| `primary` | Preenchimento `--accent`, texto `--accent-ink` | `--accent-deep` | A ação que faz a etapa avançar. **Uma por tela.** |
| `secondary` | `--surface`, texto `--ink`, borda `--rule-strong` | `--surface-raised` | Ações de apoio |
| `danger` | `--surface`, texto `--state-missing`, borda `--state-missing` | Fundo tingido de `--state-missing` | Remover credencial, descartar rascunho |
| `ghost` | Transparente, texto `--ink-muted` | `--surface-raised`, texto `--ink` | Ação terciária, dentro de linha |

**Mudança em relação ao atual**: a variante `primary` deixa de ser verde com texto claro e passa
a âmbar com texto escuro. Texto claro sobre âmbar é proibido (FR-046) — não há variante que o
permita.

**Foco**: `outline: 2px solid var(--accent-text)`, `outline-offset: 2px`. Nunca `box-shadow`.
**Desabilitado**: opacidade reduzida + `cursor: not-allowed`, sem alteração de matiz.
**Tamanhos**: `md` (padrão) e `sm`.

---

## 2. `TextField` e `TextArea` — `src/ui/`

Entrada de texto.

| Estado | Tratamento |
| --- | --- |
| Repouso | Fundo `--surface`, borda `--rule-strong`, texto `--ink` |
| Foco | `outline` em `--accent-text`; fundo passa a `--surface-raised` |
| Erro | Borda `--state-missing` + mensagem abaixo em `--state-missing`, com ícone |
| Desabilitado | Opacidade reduzida, borda `--rule` |

Rótulo sempre associado, visível, nunca substituído por *placeholder*. Mensagem de erro nunca
depende só de cor (FR-017).

`TextArea` é onde a lista é colada — a área de maior importância do fluxo. Usa `--text-body` com
`line-height: 1.55`, e é o único lugar onde a altura cresce com o conteúdo.

---

## 3. `Toggle` — `src/ui/Toggle.tsx`

Alternância booleana. Trilho em `--rule-strong` quando desligado, `--accent` quando ligado, com
o botão em `--surface`. Estado ligado/desligado é anunciado por texto, não só pela posição.

---

## 4. `Dialog` — `src/ui/Dialog.tsx`

Sobreposição modal. Fundo de véu: preto a 55% no tema escuro, `--ink` a 35% no claro. Painel em
`--surface` com `--radius-card`. Foco preso dentro enquanto aberto; devolvido ao gatilho ao
fechar. Fecha por `Esc`.

**No tema escuro o painel não recebe sombra** — ele se separa do véu por luminosidade, conforme
a regra de profundidade assimétrica (tokens.md §4).

---

## 5. `StatusBadge` — `src/features/review/StatusBadge.tsx`

**O componente onde a decisão do FR-047 mais importa.** Três estados de correspondência, mais
neutro.

Anatomia fixa: fundo tingido (12% claro / 15% escuro) + ícone + rótulo textual + texto na cor do
estado. Borda de 1px na cor do estado a 30%. `--radius-pill`.

| Estado | Cor | Ícone | Rótulo |
| --- | --- | --- | --- |
| Confiante | `--state-confident` | Losango cheio | "confiante" |
| Incerta | `--state-uncertain` | Losango vazado | "incerta" |
| Não encontrada | `--state-missing` | Traço | "não encontrada" |
| Neutro | `--ink-muted` | — | contexto |

Três canais redundantes — cor, forma do ícone e palavra — porque o modo de cores forçadas
remove o primeiro e daltonismo compromete a distinção teal/âmbar para parte dos usuários.

**Nunca** preenchimento sólido: é o que o separa de um botão.

---

## 6. `StepIndicator` — `src/app/StepIndicator.tsx`

Reescrito. Sai a fileira de pílulas com separadores `›`; entra uma régua de 2px em `--accent`
que preenche conforme o fluxo avança, com os nomes das etapas em `--text-meta` abaixo. A etapa
atual em `--ink`, as concluídas em `--ink-muted`, as futuras em `--ink-muted` a 60%.

Semântica preservada: continua `nav` + `ol`, com `aria-current="step"` e a contagem "N de T"
para leitor de tela. A régua é `aria-hidden` — ela duplica visualmente o que a lista já diz.

Transição de 200ms no preenchimento, suprimida sob `prefers-reduced-motion` (FR-020).

---

## 7. `ThemeControl` — `src/features/theme/ThemeControl.tsx` — **novo**

Três opções em `radiogroup`: Claro · Escuro · Sistema.

| Estado | Tratamento |
| --- | --- |
| Selecionado | Fundo `--surface-raised`, texto `--ink`, borda `--rule-strong` |
| Não selecionado | Transparente, texto `--ink-muted` |
| Foco | `outline` em `--accent-text` no segmento focado |

Abaixo de `--gutter-collapse` mostra só ícones, mantendo o nome acessível. Operável por teclado
com setas, conforme o padrão de `radiogroup`. Textos em `src/i18n/pt-BR.ts` (FR-022).

Vive no cabeçalho, visível em todas as etapas (FR-006). A troca não altera etapa nem descarta
trabalho em andamento (FR-007).

---

## 8. `SearchProgress` — `src/features/review/SearchProgress.tsx`

Continua usando `<progress>` nativo — a decisão está comentada no arquivo e existe por
acessibilidade. Por isso `color-scheme` precisa ser declarado por tema (research §9), ou a barra
vem clara no tema escuro.

Preenchimento em `--accent`, trilho em `--surface-raised`. Contagem à direita em `--text-data`,
tabular, para que o número não dance enquanto sobe.

---

## 9. `MatchRow` — `src/features/review/MatchRow.tsx`

**Onde a assinatura vive.** Estrutura em duas colunas: goteira (`--gutter`) + conteúdo.

```text
│ 08 │ tim maia  -  azul da cor do mar          │  ← entrada original, --ink-muted, --text-meta
│    │ ▸ Tim Maia · Azul da Cor do Mar   3:58   │  ← correspondência, --ink, --text-item
│    │ ◆ incerta              [ver alternativas]│  ← StatusBadge + ação
```

O numeral da goteira usa `--accent-text` e `--text-data`. **É o número da linha que o usuário
colou** e ele não muda: sobrevive a busca, edição, deduplicação, falha parcial, reconexão e
retomada em lote.

Linha alternada em `--surface-raised`. Abaixo do breakpoint a goteira colapsa e o numeral vira
prefixo em linha, preservando o alinhamento tabular.

**Capa de álbum** (`i.scdn.co`, `i.ytimg.com`): 1px de `--rule-strong` e `--radius-control`.
São imagens de terceiro com cores arbitrárias e precisam de contorno para se separar do fundo
nos dois temas (FR-021).

---

## 10. Componentes menores

| Componente | Tratamento |
| --- | --- |
| `StepHeading` | `--text-step`. Recebe foco na transição de etapa — comportamento preservado |
| `CopyButton` | `ghost`; confirmação por texto, não só por ícone |
| `MaskedValue` | `--text-data` tabular; alternância de visibilidade anunciada |
| `VersionHintBadge` | Anatomia de selo neutro; nunca preenchimento sólido |
| `RateLimitWaiting` | `--ink-muted` + contagem em `--text-data`; sem animação sob movimento reduzido |
| `LiveRegion` | Sem estilo visual. Não é afetado por esta feature |
| `DraftRecoveryBanner` | Faixa em `--surface`, borda-guia de 3px em `--accent` à esquerda, texto `--ink` |
| `FolderNotice`, `AuthError` | Faixa informativa; erro usa `--state-missing` com ícone e rótulo |

---

## 11. Utilitários nomeados

Recorrência que aparece em três ou mais lugares vira utilitário, nunca string copiada — regra já
praticada em `src/styles/index.css`.

| Utilitário | Papel |
| --- | --- |
| `app-card` | Superfície + borda + raio + espaçamento padrão de cartão |
| `focus-ring` | `outline` de 2px em `--accent-text` com offset de 2px |
| `status-badge` | Anatomia base do selo: tinta, borda, pílula, sem preenchimento sólido |
| `field-message` | Mensagem sob campo |
| `gutter-row` | **Novo.** Grade de duas colunas (goteira + conteúdo) com colapso responsivo |
| `data-numeral` | **Novo.** `--text-data` com `tabular-nums` e tracking |
