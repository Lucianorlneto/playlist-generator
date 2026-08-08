# Guia de Estilo

**Importador de Playlist por Texto** · sistema de design da feature 005 · 2026-08-07

Este documento é o **árbitro de decisões visuais futuras**. Quando surgir a dúvida "de que cor
fica este texto?", "quanto espaço vai aqui?" ou "isto é um selo ou um botão?", a resposta está
aqui — e se não estiver, a lacuna é do guia.

---

## 0. Como este documento se relaciona com o código

**A definição normativa de cada valor é o ponto único no código; este documento o descreve.**

| O quê | Onde vive a definição |
| --- | --- |
| Valor de cada token, por tema | `src/styles/tokens.css` |
| Nomes semânticos e escalas finitas | `src/styles/index.css` |
| Lista fechada de pares aprovados | `src/domain/theme/approvedPairs.ts` |
| Razões de contraste | produzidas por `tests/unit/contrast.spec.ts` |
| Anatomia de cada componente | o próprio componente em `src/ui/` e `src/features/` |

Divergência entre este guia e o código **se resolve corrigindo o guia** (FR-036). Nunca
duplicando o valor: um hex copiado para cá vira a segunda cópia que diverge em silêncio, e a
cópia errada é sempre a que alguém lê primeiro.

Os números de contraste da seção 3 foram **produzidos pelo teste**, não recalculados à mão. Se
esta tabela e o teste discordarem, o teste está certo.

---

## 1. O sujeito, e por que ele decide o resto

Antes de qualquer cor: **este produto não é um player de música.** Não tem catálogo para navegar,
não tem capa de álbum como herói, não tem descoberta.

É um **conciliador**. Recebe uma lista de texto que alguém digitou, colou de uma mensagem ou
copiou de um setlist, e reconcilia linha a linha contra o catálogo de um serviço — acertando
umas, hesitando em outras, falhando em algumas — até virar playlist.

O mundo dele é o da **lista**: o setlist rabiscado, o verso da capa do disco com as faixas
numeradas, a folha da rádio com a programação, o J-card da fita cassete datilografado.
**Documento, não vitrine.**

Consequência prática, e é a que resolve a maioria das dúvidas de layout: **o herói é a linha, não
a capa.** Se o produto fosse um player, a arte do álbum seria o elemento maior da tela. Como ele é
um conciliador, a capa é apoio de 32px e a linha ocupa o espaço.

---

## 2. Cor

Nomes **semânticos**, nunca descritivos. `--ink-muted` sobrevive a uma troca de paleta;
`--cinza-claro` não. Componente consome nome, jamais valor (FR-004) — a regra de lint
`tp/no-raw-visual-values` recusa o contrário.

### Os 14 tokens

| Token | Papel | Papel (claro) | Noite (escuro) |
| --- | --- | --- | --- |
| `--bg` | Fundo da página | `#faf7f0` | `#0d1219` |
| `--surface` | Superfície elevada, cartão | `#ffffff` | `#1a2332` |
| `--surface-raised` | Hover, linha alternada, campo em foco | `#f4efe4` | `#223045` |
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

### Três coisas que não são óbvias na tabela

**`--accent` é idêntico nos dois temas.** É a âncora da identidade: a cor da ação não muda quando o
substrato muda. Os fundos divergem em temperatura — quente no claro, azul no escuro — e é a
primária, mais a família de tinta, que mantém os dois reconhecíveis como o mesmo produto.

**`--accent` e `--accent-text` são dois tokens porque precisam ser.** Âmbar cheio sobre fundo claro
dá **2,0:1** — reprovado para texto e para borda. `--accent` é **só preenchimento**;
`--accent-text` é o âmbar de texto, link, borda e foco. No tema escuro os dois coincidem, porque
ali não há divergência a fazer.

**`--rule` e `--rule-strong` não são graus da mesma coisa.** São funções diferentes:

| Token | Papel | Contraste exigido | Onde |
| --- | --- | --- | --- |
| `--rule` | Reforça uma separação que a luminosidade já faz | Nenhum | `app-card`, divisores, listas |
| `--rule-strong` | **É** o delimitador | ≥ 3:1 em toda superfície | Campo, botão secundário, contorno de capa |

Trocar um pelo outro não é questão de intensidade. Um cartão com `--rule-strong` fica pesado sem
motivo; um campo com `--rule` deixa de ser identificável — e o portão pega o segundo.

### Fundos tingidos de estado

Não são tokens próprios: são **derivados** por `color-mix` do token de estado com `--surface`, a
12% no claro e 15% no escuro. `--state-confident-tint`, `--state-uncertain-tint`,
`--state-missing-tint`, `--state-neutral-tint`; o filete de cada selo é o mesmo estado a 30%
(`--state-*-edge`).

Derivar em vez de declarar é o que impede que trocar o teal de "confiante" exija editar dois
valores e esquecer um.

---

## 3. Pares aprovados e contraste

**Lista fechada.** Combinação que não está aqui é proibida em qualquer componente — no mesmo
espírito da tabela de hosts do Princípio II. `tests/unit/contrast.spec.ts` percorre a lista inteira
nos dois temas e falha por par reprovado.

Mínimos WCAG 2.x: `text` = 4,5:1 · `large-text` = 3:1 · `ui` (borda, ícone, anel de foco) = 3:1.

| # | Frente | Fundo | Uso | Mínimo | Claro | Escuro | Onde aparece |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `--ink` | `--bg` | text | 4,5:1 | **16,0** | **15,6** | Texto corrido da página |
| 2 | `--ink` | `--surface` | text | 4,5:1 | **17,2** | **13,1** | Texto dentro de cartão |
| 3 | `--ink-muted` | `--bg` | text | 4,5:1 | **5,6** | **7,8** | Meta, legenda, texto de ajuda |
| 4 | `--ink-muted` | `--surface` | text | 4,5:1 | **6,0** | **6,5** | Meta dentro de cartão |
| 5 | `--accent-ink` | `--accent` | text | 4,5:1 | **8,6** | **9,4** | Rótulo do botão primário |
| 6 | `--accent-ink` | `--accent-deep` | text | 4,5:1 | **6,8** | **6,2** | Botão primário em hover |
| 7 | `--accent-text` | `--bg` | text | 4,5:1 | **5,1** | **9,4** | Link e numeral da goteira |
| 8 | `--accent-text` | `--surface` | text | 4,5:1 | **5,4** | **7,9** | Link dentro de cartão |
| 9 | `--accent-text` | `--bg` | ui | 3:1 | **5,1** | **9,4** | Anel de foco |
| 10 | `--state-confident` | `--surface` | text | 4,5:1 | **5,9** | **7,5** | Selo "confiante" |
| 11 | `--state-uncertain` | `--surface` | text | 4,5:1 | **6,3** | **9,3** | Selo "incerta" |
| 12 | `--state-missing` | `--surface` | text | 4,5:1 | **6,5** | **6,9** | Selo "não encontrada", erro |
| 13 | `--rule-strong` | `--bg` | ui | 3:1 | **3,3** | **4,2** | Borda de controle e contorno de capa, sobre a página |
| 14 | `--rule-strong` | `--surface` | ui | 3:1 | **3,5** | **3,6** | Borda de controle dentro de cartão |
| 15 | `--rule-strong` | `--surface-raised` | ui | 3:1 | **3,1** | **3,0** | Borda de campo em foco, linha alternada |

**Proibido em qualquer contexto**: texto claro sobre `--accent` (2,0:1). Não existe variante de
componente que o permita, e o teste de contraste tem um caso dedicado a garantir que nenhuma
apareça (FR-046).

---

## 4. Tipografia

**Space Grotesk**, variável, **família única** (FR-034). Grotesca geométrica com maneirismos reais
— o `g` de perna cortada, o `a` de topo reto — que assinam sem custar legibilidade.

Nenhuma família de exibição separada. A hierarquia vem de peso, tamanho e espaço, não de uma
segunda fonte. É escolha, não economia: um conciliador não precisa de voz editorial.

### A escala — 6 degraus, e nada fora deles

| Token | Tamanho | Peso | Ajuste | Uso |
| --- | --- | --- | --- | --- |
| `--text-step` | 1,625rem | 600 | `letter-spacing: -0.02em` | Título de etapa |
| `--text-section` | 1,0625rem | 600 | — | Título de seção |
| `--text-body` | 0,9375rem | 400 | `line-height: 1.55` | Corpo |
| `--text-item` | 0,9375rem | 500 | — | Nome de faixa na conciliação |
| `--text-meta` | 0,8125rem | 400 | — | Secundário, legenda, entrada original |
| `--text-data` | 0,75rem | 500 | `tabular-nums`, `+0.03em` | Numeral, duração, contagem |

`--text-*: initial` está declarado no `@theme`: `text-sm`, `text-lg` e companhia **não existem**.
Valor fora da escala é violação, não exceção.

### `--text-data` é obrigatoriamente tabular

Número de linha, duração, contagem de faixas e orçamento de cota precisam **alinhar em coluna**.
Os algarismos de Space Grotesk são **proporcionais por padrão** — `08` mede 15,8px e `11` mede
11,2px, uma diferença de mais de um terço da largura do numeral.

Por isso `tabular-nums` mora no utilitário `data-numeral`, não em cada uso. Um numeral que
esquecesse a declaração não quebraria build nem teste — só deixaria a coluna torta.

### Piso de legibilidade da grade densa (FR-044)

Na tela de revisão, **nome de faixa e linha de artista não podem encolher** abaixo do que existia
antes da 005: 0,875rem de corpo e 1,25rem de entrelinha absoluta.
`tests/components/review.spec.tsx` fixa esse piso. Personalidade tipográfica não pode sair cara
justamente na tela mais densa do aplicativo.

### A fonte embarcada

Arquivo versionado em `src/assets/fonts/space-grotesk-subset.woff2` — **24 KB**, contra o teto de
80 KB do SC-013. Nenhuma entrada no `package.json`, nenhuma origem remota (FR-039). A licença é
SIL OFL 1.1 e o texto integral acompanha o arquivo em `src/assets/fonts/OFL.txt`, como a própria
licença exige de redistribuição.

Reproduzir o subconjunto, com `fontTools` em ambiente descartável:

```bash
# 1. Limitar o eixo variável a 400–700 (a origem vai de 300 a 700)
fonttools varLib.instancer 'SpaceGrotesk[wght].ttf' wght=400:700 -o sg-wght-400-700.ttf

# 2. Subsetar preservando explicitamente `tnum`
pyftsubset sg-wght-400-700.ttf \
  --output-file=space-grotesk-subset.woff2 \
  --flavor=woff2 \
  --layout-features+=tnum \
  --unicodes="U+0000-00FF,U+0100-017F,U+2013-2014,U+2018-201A,U+201C-201E,U+2026,U+2039-203A,U+2044,U+20AC,U+2212" \
  --name-IDs='*' --name-legacy --notdef-outline
```

`--layout-features+=tnum` **não é opcional**: `tnum` não está no conjunto que o `pyftsubset` retém
por padrão, e sem essa linha a feature sairia em silêncio.

### Fallback sem deslocamento (FR-037, SC-015)

Durante o `swap`, a pilha nativa desenha o texto. O `@font-face` de fallback traz
`size-adjust: 93.72%` — derivado da razão entre a altura de x de Space Grotesk (486/1000) e a de
Arial (1062/2048) — mais `ascent-override` e `descent-override`. **Recalcular junto se o arquivo da
fonte for trocado.**

---

## 5. Espaçamento, raio, profundidade

### Espaçamento — 7 degraus

`--space-1: 0.25rem` · `--space-2: 0.5rem` · `--space-3: 0.75rem` · `--space-4: 1rem` ·
`--space-6: 1.5rem` · `--space-8: 2rem` · `--space-12: 3rem`

`--spacing: initial` está declarado: o Tailwind **não** gera `p-5` nem `p-13` sob demanda. Zero
(`--spacing-0`) existe porque `inset-0` e `min-w-0` dependem dele, mas não é degrau — é a ausência
de espaço.

### Raio — 3 degraus

`--radius-control: 4px` · `--radius-card: 8px` · `--radius-pill: 9999px`

O raio de cartão caiu de 12px para 8px. É deliberado: cantos generosos são o registro visual do
painel de SaaS genérico, e a tese do desenho é documento.

### Profundidade — assimétrica, e isso é escolha

| Tema | Mecanismo |
| --- | --- |
| Claro | Um nível: `0 1px 2px rgb(20 28 38 / 6%), 0 4px 12px rgb(20 28 38 / 5%)` |
| Escuro | **Nenhuma sombra.** Degrau de luminosidade (`--bg` → `--surface` → `--surface-raised`) mais filete de 1px |

Sombra preta sobre fundo quase-preto não é visível. Aplicar o mesmo sistema aos dois substratos
produziria um tema escuro chapado, com custo de renderização e nenhum benefício.

Existe **um** nível. Um segundo degrau para um elemento pequeno é escala fora da escala.

### Layout

| Token | Valor | Papel |
| --- | --- | --- |
| `--measure` | 46rem | Largura máxima da coluna de conteúdo |
| `--container-panel` | 32rem | Largura do painel modal |
| `--gutter` | 2,5rem | Goteira à esquerda: numeral e marca de estado |
| `--breakpoint-gutter` | 40rem | Abaixo disto a goteira vira prefixo em linha |

---

## 6. A assinatura: o número de linha que não solta

**A goteira numerada é o elemento único desta interface, e ela é informação, não ornamento.**

O número ao lado de uma faixa é **o número da linha que a pessoa colou**. Ele nasce na tela de
entrada e sobrevive a tudo: à busca, à correspondência incerta, à edição manual, à deduplicação, à
falha parcial, à reconexão depois de a sessão expirar, à retomada em lote. A linha 7 continua sendo
a linha 7 na tela de falhas e no resumo.

```text
┌────┬────────────────────────────────────────┐
│ 07 │ Caetano Veloso — Sozinho               │ ← entrada, como digitada
│    │ ▸ Caetano Veloso · Sozinho      4:12   │ ← correspondência
│    │ ◆ confiante                            │ ← estado: tinta + ícone + palavra
├────┼────────────────────────────────────────┤
│ 08 │ tim maia  -  azul da cor do mar        │
│    │ ▸ Tim Maia · Azul da Cor do Mar 3:58   │
│    │ ◇ incerta            [ver alternativas]│
└────┴────────────────────────────────────────┘
```

Isso resolve o problema mais difícil que o produto tem — *"quais das minhas 60 linhas não entraram,
e por quê?"* — com um recurso gráfico em vez de prosa. E é o que justifica a numeração existir:
marcadores numerados costumam ser decoração, válidos apenas quando a ordem carrega informação de
que o leitor precisa. Aqui carrega — é a chave primária do domínio exposta na interface.

Três consequências que amarram o resto do sistema:

- os algarismos tabulares deixam de ser refinamento e viram **requisito funcional**;
- a goteira fixa deixa de ser capricho de layout e vira **a estrutura que unifica as telas** — a
  borda esquerda do conteúdo fica na mesma posição em todo o fluxo, e é o que faz cinco telas
  parecerem cinco páginas do mesmo documento;
- o âmbar ganha um segundo trabalho além do botão: é a cor da identidade da linha.

**Toda a ousadia está aqui.** O resto — botões, campos, diálogos, cartões — é deliberadamente
sóbrio. A régua de progresso foi rebaixada a indicador comum de propósito: dois elementos
memoráveis é o mesmo que nenhum.

A regra de origem é `lineNumeral()` em `src/domain/run/numeral.ts` — função pura, uma só, porque
três telas diferentes precisam produzir o mesmo numeral para a mesma linha.

---

## 7. Componentes

Regra transversal, e é a que mais importa (FR-047):

> **Preenchimento sólido significa acionável.**
> Selo e indicador de estado **nunca** usam preenchimento sólido. Usam fundo tingido + ícone +
> rótulo textual + tinta na cor do estado.

É essa separação **por forma**, não uma diferença de matiz, que impede o selo "incerta" âmbar de
ser lido como o botão primário âmbar.

Estados obrigatórios para todo elemento interativo (FR-015): repouso, foco por teclado, hover,
ativo, desabilitado e — quando aplicável — erro e carregando.

### 7.1 `Button` — `src/ui/Button.tsx`

Ação. Variantes resolvidas por **mapa explícito de literais**, nunca por concatenação: uma classe
montada em tempo de execução não é emitida no CSS, e a falha só aparece no build.

| Variante | Repouso | Hover | Quando usar |
| --- | --- | --- | --- |
| `primary` | `--accent`, texto `--accent-ink` | `--accent-deep` | A ação que faz a etapa avançar. **Uma por tela.** |
| `secondary` | `--surface`, texto `--ink`, borda `--rule-strong` | `--surface-raised` | Ações de apoio |
| `danger` | `--surface`, texto e borda `--state-missing` | fundo tingido de `--state-missing` | Remover credencial, descartar rascunho |
| `ghost` | Transparente, texto `--ink-muted` | `--surface-raised`, texto `--ink` | Ação terciária, dentro de linha |

**Quando não usar**: para navegação entre páginas — use link. Para estado — use selo.

- **Foco**: `outline: 2px solid var(--accent-text)`, offset 2px. Nunca `box-shadow`.
- **Desabilitado**: opacidade reduzida + `cursor: not-allowed`, sem alteração de matiz.
- **Tamanhos**: `md` (padrão) e `sm`.
- **Mudança na 005**: `primary` deixou de ser verde com texto claro e passou a âmbar com texto
  escuro. Texto claro sobre âmbar é proibido — não há variante que o permita.

### 7.2 `TextField` e `TextArea` — `src/ui/`

| Estado | Tratamento |
| --- | --- |
| Repouso | Fundo `--surface`, borda `--rule-strong`, texto `--ink` |
| Foco | `outline` em `--accent-text`; fundo passa a `--surface-raised` |
| Erro | Borda `--state-missing` + mensagem abaixo em `--state-missing`, com ícone |
| Desabilitado | Opacidade reduzida, borda `--rule` |

Rótulo **sempre** associado e visível, nunca substituído por *placeholder*. Mensagem de erro nunca
depende só de cor (FR-017).

`TextArea` é onde a lista é colada — a área de maior importância do fluxo. Usa `--text-body` com
entrelinha 1,55, e é o único lugar onde a altura cresce com o conteúdo.

### 7.3 `Toggle` — `src/ui/Toggle.tsx`

Alternância booleana. Trilho em `--rule-strong` quando desligado, `--accent` quando ligado, botão
em `--surface`. **Estado anunciado por texto**, não só pela posição.

**Quando não usar**: quando existirem mais de dois estados, ou quando "não escolhido" precisar ser
distinguível — foi por isso que o controle de tema é `radiogroup`, e não interruptor.

### 7.4 `Dialog` — `src/ui/Dialog.tsx`

Sobreposição modal sobre `<dialog>` nativo. Véu em `--scrim`: `--ink` a 35% no claro, preto a 55%
no escuro. Painel em `--surface`, `--radius-card`, largura `--container-panel`.

Foco preso dentro enquanto aberto, devolvido ao gatilho ao fechar, fecha por `Esc`. **No tema
escuro o painel não recebe sombra** — separa-se do véu por luminosidade.

### 7.5 `StatusBadge` — `src/features/review/StatusBadge.tsx`

**O componente onde a decisão do FR-047 mais importa.**

Anatomia fixa: fundo tingido (12% claro / 15% escuro) + ícone + rótulo textual + tinta na cor do
estado. Filete de 1px na cor do estado a 30%. `--radius-pill`.

| Estado | Cor | Ícone | Rótulo |
| --- | --- | --- | --- |
| Confiante | `--state-confident` | Losango cheio | "confiante" |
| Incerta | `--state-uncertain` | Losango vazado | "incerta" |
| Não encontrada | `--state-missing` | Traço | "não encontrada" |
| Neutro | `--ink-muted` | — | contexto |

**Três canais redundantes** — cor, forma do ícone e palavra — porque o modo de cores forçadas
remove o primeiro e o daltonismo compromete a distinção teal/âmbar para parte dos usuários. Restar
dois canais é o objetivo, não o acidente.

Os ícones são SVG e não glifos: `◆` e `◇` estão fora do subconjunto embarcado e cairiam na pilha
nativa, com forma e alinhamento imprevisíveis por sistema.

**Nunca** preenchimento sólido — é o que o separa de um botão.

### 7.6 `StepIndicator` — `src/app/StepIndicator.tsx`

Régua de `--accent` que preenche conforme o fluxo avança, com os nomes das etapas em `--text-meta`
abaixo. Etapa atual em `--ink`, concluídas em `--ink-muted`, futuras em `--ink-muted` a 60%.

Semântica preservada: `nav` + `ol`, `aria-current="step"` e a contagem "N de T" para leitor de
tela. **A régua é `aria-hidden`** — duplica visualmente o que a lista já diz.

Transição de 200ms no preenchimento, suprimida sob `prefers-reduced-motion`.

**Quando não usar**: para fases dentro de uma etapa. As seis fases do ciclo por serviço aparecem
como sublinha textual, não como etapas globais — promovê-las tornaria o indicador ilegível.

### 7.7 `ThemeControl` — `src/features/theme/ThemeControl.tsx`

Três opções em `radiogroup`: **Claro · Escuro · Sistema**.

| Estado | Tratamento |
| --- | --- |
| Selecionado | `--surface-raised`, texto `--ink`, borda `--rule-strong` |
| Não selecionado | Transparente, texto `--ink-muted` |
| Foco | `outline` em `--accent-text` no segmento focado |

Abaixo de `--breakpoint-gutter` mostra só ícones, **mantendo o nome acessível** (o rótulo vira
`sr-only`, não desaparece). Setas navegam e selecionam; só o segmento selecionado fica na ordem de
tabulação, de modo que o grupo inteiro é uma parada de Tab.

**Por que não é um interruptor**: um binário sol/lua satisfaz a letra do requisito e é mais
compacto, mas torna "voltar a acompanhar o sistema" inalcançável depois do primeiro clique. O
estado inicial viraria um beco sem saída.

### 7.8 `SearchProgress` — `src/features/review/SearchProgress.tsx`

Continua usando `<progress>` **nativo**, por acessibilidade. Preenchimento em `--accent`, trilho em
`--surface-raised`, contagem em `--text-data` tabular para que o número não dance enquanto sobe.

É por causa deste componente que `color-scheme` precisa ser declarado por tema — sem isso o tema
escuro entrega uma barra clara no meio da tela.

### 7.9 `MatchRow` — `src/features/review/MatchRow.tsx`

**Onde a assinatura vive.** Ver seção 6.

Estrutura: goteira (`--gutter`, com caixa de seleção e numeral) + coluna de conteúdo com entrada
original, correspondência e selo empilhados. Abaixo do breakpoint a goteira colapsa e o numeral
vira prefixo em linha, preservando o alinhamento tabular.

Capa de álbum (`i.scdn.co`, `i.ytimg.com`): 32px, 1px de `--rule-strong`, `--radius-control`. São
imagens de terceiro com cores arbitrárias e precisam de contorno para se separar do fundo nos dois
temas (FR-021).

### 7.10 Componentes menores

| Componente | Tratamento |
| --- | --- |
| `StepHeading` | `--text-step`. Recebe foco na transição de etapa |
| `CopyButton` | `ghost`; confirmação por texto, não só por ícone |
| `MaskedValue` | `--text-data` tabular; alternância de visibilidade anunciada |
| `VersionHintBadge` | Anatomia de selo neutro; nunca preenchimento sólido |
| `RateLimitWaiting` | `--ink-muted` + contagem em `--text-data`; sem animação sob movimento reduzido |
| `LiveRegion` | Sem estilo próprio; aceita `data-numeral` quando a mensagem visível é contagem |
| `DraftRecoveryBanner` | `--surface`, guia de 3px em `--accent` à esquerda (`guide-edge`), texto `--ink` |
| `FolderNotice`, `AuthError` | Faixa informativa; erro usa `--state-missing` com ícone e rótulo |

### 7.11 Utilitários nomeados

Recorrência que aparece em três ou mais lugares vira utilitário, **nunca string copiada**.

| Utilitário | Papel |
| --- | --- |
| `app-card` | Superfície + borda `--rule` + `--radius-card` + espaçamento + `shadow-card` |
| `focus-ring` | `outline` de 2px em `--accent-text` com offset de 2px |
| `status-badge` | Anatomia base do selo, sem preenchimento sólido |
| `field-message` | Mensagem sob campo |
| `gutter-row` | Grade de duas colunas (goteira + conteúdo) com colapso responsivo |
| `data-numeral` | `--text-data` com `tabular-nums` e tracking |
| `guide-edge` | Guia lateral de 3px em `--accent` |

---

## 8. Interação e acessibilidade

### Foco

`outline`, **nunca** `box-shadow`. O modo de cores forçadas descarta sombra e preserva contorno —
um foco feito de `box-shadow` desaparece exatamente para quem mais depende dele.

Cor: `--accent-text`, que diverge entre os temas (5,1:1 no claro, 9,4:1 no escuro), ambos acima do
mínimo de 3:1.

### Estado nunca depende só de cor

Todo estado carrega **palavra e forma** além da cor (FR-017). É o que faz a informação sobreviver
ao modo de alto contraste e ao daltonismo — e sai de graça da decisão do FR-047.

### Movimento

Praticamente nenhum. A régua de etapa avança em 200ms; o resto é instantâneo. Sob
`prefers-reduced-motion: reduce`, também a régua para de animar, **sem perda de informação** — ela
já é `aria-hidden` e o estado está dito por escrito.

### Dois temas, sempre

Todo token de cor existe nos dois temas. **Definição parcial é erro**, não recurso, e o teste de
contraste falha por token ausente. A suíte de acessibilidade roda inteira duas vezes, uma por tema.

### Tela estreita

Sem rolagem horizontal em 320 px. Nenhum contêiner usa largura fixa em pixels; as colunas usam
`minmax(0, …)` para que o conteúdo encolha em vez de estourar a página.

---

## 9. Os portões que sustentam este documento

Nenhum invariante desta feature sobrevive como prosa. Cada regra acima tem verificação executável:

| Regra | Portão |
| --- | --- |
| Contraste dos pares aprovados, nos dois temas | `tests/unit/contrast.spec.ts` |
| Nenhum token removido sobreviveu; escalas finitas respeitadas | `tests/unit/no-orphan-tokens.spec.ts` |
| Nenhum valor visual avulso no componente | `tp/no-raw-visual-values` (ESLint) |
| Zero violação de acessibilidade, nos dois temas | `tests/a11y/steps.spec.tsx` |
| Piso de legibilidade da grade densa | `tests/components/review.spec.tsx` |
| Nenhuma origem remota | `tests/unit/no-secrets.spec.ts` + `e2e/no-remote-origin.spec.ts` |
| Textos existentes inalterados | `tests/unit/i18n-stability.spec.ts` |
| Chave de tema em sincronia com o script de arranque | `tests/unit/theme-boot-sync.spec.ts` |
| Sem piscada de tema, persistência, troca durante execução | `e2e/theme.spec.ts` |
| Foco visível e teclado, nos dois temas | `e2e/keyboard.spec.ts` |
| Sem rolagem horizontal em 320 px, nos dois temas | `e2e/narrow-viewport.spec.ts` |

Se você mudar um valor e um destes falhar, **o portão está certo até prova em contrário**.

---

## 10. Fronteira que este guia não atravessa

Escrita de interface — voz ativa, erro que não se desculpa, tela vazia como convite — **não é
assunto deste documento**. A feature 005 congelou todos os textos existentes de propósito: mexer em
copy junto com identidade visual misturaria duas mudanças de natureza diferente na mesma revisão.

Os únicos textos que nasceram aqui são os do controle de tema. Revisão de copy do fluxo fica
registrada como candidata a feature própria.
