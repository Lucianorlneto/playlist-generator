---
name: playlist-brand
description: Aplica a identidade visual do Importador de Playlist por Texto — paleta de dois temas, tipografia Space Grotesk, escalas finitas e a assinatura da goteira numerada. Use ao criar ou revisar qualquer superfície visual deste produto, ou artefato que precise parecer parte dele. Não confundir com `brand-guidelines`, que é a marca da Anthropic.
---

# Identidade Visual — Importador de Playlist por Texto

## Visão geral

Esta skill carrega a identidade visual **deste produto**, derivada da feature
`005-ui-design-system` e verificada por portão automatizado.

**Palavras-chave**: identidade visual, paleta, tema claro, tema escuro, tokens de design,
Space Grotesk, goteira numerada, selo de estado, contraste, âmbar, teal.

> **Esta skill não substitui `brand-guidelines`.** Aquela é a marca da Anthropic; esta é a de um
> produto específico. Nunca aplique as duas ao mesmo artefato.

## O que decide tudo o mais

**Este produto não é um player de música. É um conciliador.**

Recebe uma lista de texto que alguém colou e reconcilia linha a linha contra o catálogo de um
serviço — acertando umas, hesitando em outras, falhando em algumas. O mundo dele é o da **lista**:
setlist rabiscado, verso da capa do disco com as faixas numeradas, J-card de fita cassete.
**Documento, não vitrine.**

Consequência que resolve a maioria das dúvidas de layout: **o herói é a linha, não a capa.** Se
fosse um player, a arte do álbum seria o maior elemento da tela. Como é um conciliador, a capa é
apoio de 32px e a linha ocupa o espaço.

## Paleta

Dois temas completos. Todo token existe nos dois — definição parcial é erro, não recurso.

### Tema Papel (claro)

| Token | Valor | Papel |
| --- | --- | --- |
| `--bg` | `#faf7f0` | Fundo da página |
| `--surface` | `#ffffff` | Cartão, superfície elevada |
| `--surface-raised` | `#f4efe4` | Hover, linha alternada, campo em foco |
| `--rule` | `#e3dccd` | Divisor discreto |
| `--rule-strong` | `#8f887a` | Borda de controle, contorno de imagem externa |
| `--ink` | `#141c26` | Texto principal |
| `--ink-muted` | `#5a6473` | Texto secundário |
| `--accent` | `#f4a900` | **Primária** — só preenchimento |
| `--accent-deep` | `#d99700` | Hover do preenchimento |
| `--accent-ink` | `#141c26` | Texto sobre preenchimento âmbar |
| `--accent-text` | `#9a5b00` | Âmbar para texto, link, borda, foco |
| `--state-confident` | `#14706b` | Correspondência confiante |
| `--state-uncertain` | `#7a5c00` | Correspondência incerta |
| `--state-missing` | `#b3261e` | Não encontrada, erro |

### Tema Noite (escuro)

| Token | Valor |
| --- | --- |
| `--bg` | `#0d1219` |
| `--surface` | `#1a2332` |
| `--surface-raised` | `#223045` |
| `--rule` | `#2c3a4d` |
| `--rule-strong` | `#5e7a9d` |
| `--ink` | `#e8eaed` |
| `--ink-muted` | `#9aa8b8` |
| `--accent` | `#f4a900` |
| `--accent-deep` | `#c98600` |
| `--accent-ink` | `#0d1219` |
| `--accent-text` | `#f4a900` |
| `--state-confident` | `#4ec4b8` |
| `--state-uncertain` | `#f0c04a` |
| `--state-missing` | `#ff8a7a` |

## As quatro regras de cor que não se negociam

1. **`--accent` é preenchimento, nunca tinta.** Âmbar cheio sobre fundo claro dá 2,0:1 — reprovado
   para texto e para borda. Para texto, link, borda e anel de foco, o token é `--accent-text`.
2. **Texto claro sobre `--accent` é proibido em qualquer contexto.** Não existe variante que o
   permita. O rótulo do botão primário é `--accent-ink`, escuro.
3. **`--accent` é idêntico nos dois temas.** É a âncora da identidade — a cor da ação não muda
   quando o substrato muda. Os fundos divergem em temperatura; a primária, não.
4. **`--rule` e `--rule-strong` não são graus da mesma coisa.** `--rule` reforça uma separação que
   a luminosidade já faz e não tem mínimo de contraste. `--rule-strong` **é** o delimitador e exige
   ≥ 3:1 sobre toda superfície. Um cartão com `--rule-strong` fica pesado sem motivo; um campo com
   `--rule` deixa de ser identificável.

## Contraste verificado

Combinações aprovadas, **medidas** por `tests/unit/contrast.spec.ts` (nunca estimadas à mão).
Combinação fora desta lista é proibida.

| Frente | Fundo | Uso | Claro | Escuro |
| --- | --- | --- | --- | --- |
| `--ink` | `--bg` | texto | 16,0 | 15,6 |
| `--ink` | `--surface` | texto | 17,2 | 13,1 |
| `--ink-muted` | `--bg` | texto | 5,6 | 7,8 |
| `--ink-muted` | `--surface` | texto | 6,0 | 6,5 |
| `--accent-ink` | `--accent` | texto | 8,6 | 9,4 |
| `--accent-ink` | `--accent-deep` | texto | 6,8 | 6,2 |
| `--accent-text` | `--bg` | texto / foco | 5,1 | 9,4 |
| `--accent-text` | `--surface` | texto | 5,4 | 7,9 |
| `--state-confident` | `--surface` | texto | 5,9 | 7,5 |
| `--state-uncertain` | `--surface` | texto | 6,3 | 9,3 |
| `--state-missing` | `--surface` | texto | 6,5 | 6,9 |
| `--rule-strong` | `--bg` | borda | 3,3 | 4,2 |
| `--rule-strong` | `--surface` | borda | 3,5 | 3,6 |
| `--rule-strong` | `--surface-raised` | borda | 3,1 | 3,0 |

Mínimos: texto 4,5:1 · texto grande 3:1 · borda, ícone e anel de foco 3:1.

## Tipografia

**Space Grotesk**, variável, **família única**. Grotesca geométrica com maneirismos reais — o `g`
de perna cortada, o `a` de topo reto — que assinam sem custar legibilidade. Fallback: Arial,
Helvetica, pilha nativa.

Nenhuma família de exibição separada. A hierarquia vem de peso, tamanho e espaço, não de uma
segunda fonte: um conciliador não precisa de voz editorial.

| Papel | Tamanho | Peso | Ajuste |
| --- | --- | --- | --- |
| Título de etapa | 1,625rem | 600 | `letter-spacing: -0.02em` |
| Título de seção | 1,0625rem | 600 | — |
| Corpo | 0,9375rem | 400 | `line-height: 1.55` |
| Nome de faixa | 0,9375rem | 500 | — |
| Secundário / meta | 0,8125rem | 400 | — |
| **Numeral e dado** | 0,75rem | 500 | `tabular-nums`, `+0.03em` |

**A última linha é obrigatória, não decorativa.** Os algarismos de Space Grotesk são
**proporcionais por padrão**: `08` mede 15,8px e `11` mede 11,2px. Numeral, duração e contagem sem
`font-variant-numeric: tabular-nums` não ficam levemente irregulares — ficam visivelmente tortos.

## Escalas finitas

Valor fora da escala é violação, não exceção.

- **Espaçamento**, 7 degraus: `0.25` · `0.5` · `0.75` · `1` · `1.5` · `2` · `3` rem
- **Raio**, 3 degraus: `4px` (controle) · `8px` (cartão) · `9999px` (pílula)
- **Tipografia**, 6 degraus: a tabela acima

O raio de cartão é 8px e não 12px de propósito: cantos generosos são o registro visual do painel de
SaaS genérico, e a tese é documento.

## Profundidade — assimétrica, e isso é escolha

| Tema | Mecanismo |
| --- | --- |
| Claro | Um nível: `0 1px 2px rgb(20 28 38 / 6%), 0 4px 12px rgb(20 28 38 / 5%)` |
| Escuro | **Nenhuma sombra.** Degrau de luminosidade mais filete de 1px |

Sombra preta sobre fundo quase-preto não é visível. Aplicar o mesmo sistema aos dois substratos
produziria um escuro chapado, com custo de renderização e nenhum benefício.

Existe **um** nível. Um segundo degrau para um elemento pequeno é escala fora da escala.

## A assinatura: a goteira numerada

**O elemento único desta interface — e é informação, não ornamento.**

O número ao lado de uma faixa é **o número da linha que a pessoa colou**. Nasce na entrada e
sobrevive à busca, à correspondência incerta, à edição, à deduplicação, à falha parcial, à
reconexão e à retomada. A linha 7 continua sendo a linha 7 na tela de falhas e no resumo.

```text
┌────┬────────────────────────────────────────┐
│ 07 │ Caetano Veloso — Sozinho               │ ← entrada, --ink-muted, meta
│    │ ▸ Caetano Veloso · Sozinho      4:12   │ ← correspondência, --ink
│    │ ◆ confiante                            │ ← estado: tinta + ícone + palavra
├────┼────────────────────────────────────────┤
│ 08 │ tim maia  -  azul da cor do mar        │
│    │ ▸ Tim Maia · Azul da Cor do Mar 3:58   │
│    │ ◇ incerta            [ver alternativas]│
└────┴────────────────────────────────────────┘
```

Goteira de `2,5rem` reservada em **todas** as telas, mesmo as que não têm lista: a borda esquerda
do conteúdo fica na mesma posição em todo o fluxo, e é o que faz telas diferentes parecerem páginas
do mesmo documento. Abaixo de `40rem` a goteira colapsa e o numeral vira prefixo em linha.

Marcadores numerados costumam ser decoração, válidos só quando a ordem carrega informação de que o
leitor precisa. **Aqui carrega**: é a chave primária do domínio exposta na interface, e responde à
pergunta mais difícil do produto — *"quais das minhas 60 linhas não entraram, e por quê?"*.

**Toda a ousadia está aqui.** Botões, campos, diálogos e cartões são deliberadamente sóbrios. Não
acrescente um segundo elemento memorável: dois é o mesmo que nenhum.

## Preenchimento sólido significa acionável

A regra transversal, e a que mais importa:

> **Selo e indicador de estado nunca usam preenchimento sólido.** Usam fundo tingido (12% no claro,
> 15% no escuro) + ícone + rótulo textual + tinta na cor do estado, com filete de 1px a 30%.

É essa separação **por forma**, não uma diferença de matiz, que impede o selo "incerta" âmbar de
ser lido como o botão primário âmbar.

| Estado | Cor | Ícone | Palavra |
| --- | --- | --- | --- |
| Confiante | `--state-confident` | Losango cheio | "confiante" |
| Incerta | `--state-uncertain` | Losango vazado | "incerta" |
| Não encontrada | `--state-missing` | Traço | "não encontrada" |
| Neutro | `--ink-muted` | — | contexto |

**Três canais redundantes** — cor, forma e palavra — porque o modo de cores forçadas remove o
primeiro e o daltonismo compromete a distinção teal/âmbar para parte dos usuários.

## Acessibilidade

- **Foco**: `outline` de 2px em `--accent-text`, offset 2px. **Nunca `box-shadow`** — o modo de
  cores forçadas descarta sombra e preserva contorno.
- **Estado nunca depende só de cor.** Sempre palavra e forma junto.
- **Movimento**: praticamente nenhum. A régua de etapa avança em 200ms; o resto é instantâneo. Sob
  `prefers-reduced-motion`, também ela para.
- **320px**: sem rolagem horizontal. Nenhuma largura fixa em pixels.

## Armadilhas conhecidas

Três coisas que já quebraram uma vez e não avisam:

1. **`<progress>` com `background-color`** faz o Chromium abandonar o desenho nativo — e com ele o
   `accent-color` — caindo no `-webkit-progress-value` legado, que é **verde**. Estilize
   `::-webkit-progress-bar`, `::-webkit-progress-value` e `::-moz-progress-bar` explicitamente.
2. **Utilitário Tailwind inexistente não é erro.** Um token removido não quebra o build: a classe
   simplesmente não gera CSS e a tela fica sem estilo. Renomear token exige varredura, não memória.
3. **`tnum` não sobrevive a um subset por padrão.** Quem regerar a fonte precisa de
   `--layout-features+=tnum`, ou a goteira perde o alinhamento em silêncio.

## Onde a definição normativa mora

Esta skill **descreve**; ela não define. A origem única de cada valor está no código:

| O quê | Onde |
| --- | --- |
| Valor de cada token, por tema | `src/styles/tokens.css` |
| Nomes semânticos e escalas | `src/styles/index.css` |
| Pares aprovados | `src/domain/theme/approvedPairs.ts` |
| Razões de contraste | `tests/unit/contrast.spec.ts` |
| Guia completo, com componentes | `docs/style-guide.md` |

Divergência entre esta skill e o código **se resolve corrigindo esta skill** — nunca duplicando o
valor.
