# Contrato — Tokens de Design

**Feature**: 005-ui-design-system

Este documento é **normativo**. Os valores aqui são a origem única de todo valor visual da
aplicação; `src/styles/tokens.css` os implementa e o guia de estilo (`docs/style-guide.md`) os
descreve. Divergência entre os três se resolve por este contrato e pelo código, nunca duplicando
valor (FR-028, FR-036).

---

## 1. Cor

Nomes semânticos. Cada token tem exatamente um valor por tema.

| Token | Papel | Papel (claro) | Noite (escuro) |
| --- | --- | --- | --- |
| `--bg` | Fundo da página | `#faf7f0` | `#0d1219` |
| `--surface` | Superfície elevada, cartão | `#ffffff` | `#1a2332` |
| `--surface-raised` | Hover, linha alternada, campo focado | `#f4efe4` | `#223045` |
| `--rule` | Divisor e borda em repouso | `#e3dccd` | `#2c3a4d` |
| `--rule-strong` | Borda de controle, contorno de imagem externa | `#8f887a` | `#5e7a9d` |
| `--ink` | Texto principal | `#141c26` | `#e8eaed` |
| `--ink-muted` | Texto secundário | `#5a6473` | `#9aa8b8` |
| `--accent` | **Primária.** Preenchimento de ação | `#f4a900` | `#f4a900` |
| `--accent-deep` | Hover e ativo do preenchimento | `#d99700` | `#c98600` |
| `--accent-ink` | Texto sobre preenchimento âmbar | `#141c26` | `#0d1219` |
| `--accent-text` | Âmbar para texto, link, borda, foco | `#9a5b00` | `#f4a900` |
| `--state-confident` | Correspondência confiante | `#14706b` | `#4ec4b8` |
| `--state-uncertain` | Correspondência incerta | `#7a5c00` | `#f0c04a` |
| `--state-missing` | Não encontrada, erro | `#b3261e` | `#ff8a7a` |

**Fundos tingidos de estado**: derivados por `color-mix` do token de estado com `--surface`, a
12% no tema claro e 15% no escuro. Não são tokens próprios — derivar impede que uma mudança de
estado exija editar dois valores.

**Notas de intenção**

- `--accent` é idêntico nos dois temas. É a âncora da identidade: a cor da ação não muda quando
  o substrato muda.
- `--accent-text` diverge porque precisa: âmbar cheio sobre fundo claro dá 2,0:1. No tema escuro
  não há divergência a fazer, então o token aponta para o mesmo valor.
- `--state-uncertain` no tema claro é deliberadamente deslocado de `--accent-text` (ocre-oliva
  contra laranja-marrom). Os dois aparecem na mesma tela e não podem ser o mesmo hex.

---

## 2. Pares aprovados

**Lista fechada.** Combinação que não está aqui é proibida em qualquer componente. O teste de
FR-030 percorre esta tabela nos dois temas e falha por par reprovado **ou ausente**.

Mínimos: `text` = 4,5:1 · `large-text` = 3:1 · `ui` (borda, ícone, anel de foco) = 3:1.

| # | Frente | Fundo | Uso | Onde aparece | Claro | Escuro |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `--ink` | `--bg` | text | Texto corrido da página | 16,0 | 15,6 |
| 2 | `--ink` | `--surface` | text | Texto dentro de cartão | 17,2 | 13,1 |
| 3 | `--ink-muted` | `--bg` | text | Meta, legenda, ajuda | 5,6 | 7,8 |
| 4 | `--ink-muted` | `--surface` | text | Meta dentro de cartão | 6,0 | 6,5 |
| 5 | `--accent-ink` | `--accent` | text | Rótulo do botão primário | 8,6 | 9,4 |
| 6 | `--accent-ink` | `--accent-deep` | text | Botão primário em hover | 6,8 | 6,2 |
| 7 | `--accent-text` | `--bg` | text | Link, número da goteira | 5,1 | 9,4 |
| 8 | `--accent-text` | `--surface` | text | Link dentro de cartão | 5,4 | 7,9 |
| 9 | `--accent-text` | `--bg` | ui | Anel de foco | 5,1 | 9,4 |
| 10 | `--state-confident` | `--surface` | text | Selo "confiante" | 5,9 | 7,5 |
| 11 | `--state-uncertain` | `--surface` | text | Selo "incerto" | 6,3 | 9,3 |
| 12 | `--state-missing` | `--surface` | text | Selo "não encontrada", erro | 6,5 | 6,9 |
| 13 | `--rule-strong` | `--bg` | ui | Borda de controle, contorno de capa, sobre a página | 3,3 | 4,2 |
| 14 | `--rule-strong` | `--surface` | ui | Borda de controle dentro de cartão | 3,5 | 3,6 |
| 15 | `--rule-strong` | `--surface-raised` | ui | Borda de campo em foco, linha alternada | 3,1 | 3,0 |

**Estes números vêm de `tests/unit/contrast.spec.ts`, não de cálculo manual.** O teste é a
autoridade (FR-036): ele lê os hex de `src/styles/tokens.css` e mede. Divergência entre esta
tabela e o teste se resolve corrigindo a tabela.

Quatro valores foram corrigidos contra a estimativa manual da versão anterior — pares 2, 6, 8 e
11, com o par 6 estimado em 10,4 e medido em 6,8. Nenhum reprovava; a diferença é ilustrativa do
motivo de a autoridade ser o cálculo.

### Par 13 — resolvido (T016)

`--rule-strong` escureceu no claro (`#c9c0ac` → `#8f887a`) e clareou no escuro
(`#3d4f66` → `#5e7a9d`), até passar de 3:1 **sobre as três superfícies**, não só sobre `--bg`.

Das duas saídas que este contrato admitia, a escolhida foi a primeira — aceitar bordas mais
presentes — e vale registrar por que a segunda, que o contrato chamava de preferível, não se
aplicava:

**A separação por superfície já está implementada, e por outro token.** O sistema tem dois traços,
não um. `--rule` (`#e3dccd` / `#2c3a4d`) é o divisor discreto: borda de cartão, separador de lista.
Ele **não está e não deve estar** nesta tabela — é reforço de uma separação que a luminosidade da
superfície e a sombra já fazem, exatamente a solução que a opção (b) descreve.

O que sobra para `--rule-strong` são os dois usos em que o traço **é** o delimitador:

1. **Borda de controle** — campo de texto e botão secundário. É a borda que diz onde o controle
   começa; a WCAG 1.4.11 pede 3:1 justamente aqui.
2. **Contorno de capa de álbum** (FR-021) — imagem de terceiro, com cores arbitrárias, que precisa
   se separar de um fundo que pode ser quase igual a ela.

Nenhum dos dois pode delegar a separação à superfície, porque em ambos **não há superfície
intermediária**: o controle pousa direto no fundo, e a capa é a própria imagem. Aplicar a opção (b)
aqui significaria remover a borda e não pôr nada no lugar.

Consequência para o sistema, e é a razão de esta decisão vir antes de qualquer componente: os dois
traços passam a ter regras distintas e não intercambiáveis.

| Token | Papel | Contraste | Onde |
| --- | --- | --- | --- |
| `--rule` | Reforço de uma separação que já existe | Sem mínimo | `app-card`, divisores, linhas de lista |
| `--rule-strong` | O próprio delimitador | **≥ 3:1 em toda superfície** | Campo, botão secundário, contorno de capa |

Trocar um pelo outro deixou de ser questão de intensidade e passou a ser questão de função. Um
cartão com `--rule-strong` fica pesado sem motivo; um campo com `--rule` deixa de ser
identificável — e é o segundo que o portão pega.

---

## 3. Tipografia

Família única: **Space Grotesk** variável, embarcada. Ver research §3 e §4.

| Token | Tamanho | Peso | Ajuste |
| --- | --- | --- | --- |
| `--text-step` | 1,625rem | 600 | `letter-spacing: -0.02em` |
| `--text-section` | 1,0625rem | 600 | — |
| `--text-body` | 0,9375rem | 400 | `line-height: 1.55` |
| `--text-item` | 0,9375rem | 500 | Nome de faixa na conciliação |
| `--text-meta` | 0,8125rem | 400 | — |
| `--text-data` | 0,75rem | 500 | `tabular-nums`, `letter-spacing: +0.03em` |

`--text-data` é obrigatoriamente tabular: a goteira numerada depende de os algarismos alinharem
em coluna (design.md §5).

---

## 4. Espaçamento, raio, profundidade

**Espaçamento** — 7 degraus, nada fora deles:

`--space-1: 0.25rem` · `--space-2: 0.5rem` · `--space-3: 0.75rem` · `--space-4: 1rem` ·
`--space-6: 1.5rem` · `--space-8: 2rem` · `--space-12: 3rem`

**Raio** — 3 degraus:

`--radius-control: 4px` · `--radius-card: 8px` · `--radius-pill: 9999px`

O raio de cartão cai de `0.75rem` (12px) para 8px. É deliberado: cantos generosos são o registro
visual do painel de SaaS genérico, e a tese do design é documento, não painel.

**Profundidade** — assimétrica por tema, e isso é escolha:

| Tema | Mecanismo |
| --- | --- |
| Claro | Um nível: `0 1px 2px rgb(20 28 38 / 6%), 0 4px 12px rgb(20 28 38 / 5%)` |
| Escuro | **Nenhuma sombra.** Profundidade por degrau de luminosidade (`--bg` → `--surface` → `--surface-raised`) e filete de 1px |

Sombra preta sobre fundo quase-preto não é visível. Aplicar o mesmo sistema aos dois temas
produziria um tema escuro chapado com custo de renderização e nenhum benefício.

---

## 5. Layout

| Token | Valor | Papel |
| --- | --- | --- |
| `--measure` | 46rem | Largura máxima da coluna de conteúdo |
| `--gutter` | 2.5rem | Goteira à esquerda: número de linha e marca de estado |
| `--gutter-collapse` | 40rem | Abaixo disto, a goteira vira prefixo em linha |

---

## 6. Regras de consumo

1. Componente consome **nome**, nunca valor. Verificado por `tp/no-raw-visual-values` (research §10).
2. Combinação de cor não listada na seção 2 é proibida.
3. Preenchimento sólido significa **acionável**. Estado usa fundo tingido + texto + ícone (FR-047).
4. Texto claro sobre `--accent` é proibido em qualquer contexto (FR-046).
5. Foco usa `outline`, nunca `box-shadow` — `box-shadow` desaparece em modo de cores forçadas.
6. Todo token de cor existe nos dois temas. Definição parcial é erro.
