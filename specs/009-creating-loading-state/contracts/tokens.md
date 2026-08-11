# Contrato — Tintas novas e o portão de contraste

Definição normativa de FR-019, FR-019a, FR-008a, FR-020 e SC-002.

Autoridade sobre os **números**: `tests/unit/contrast.spec.ts`. Este documento descreve o
que o cálculo produz; divergência entre os dois se resolve corrigindo este documento, como
manda `docs/style-guide.md`.

---

## 1. Duas tintas, e exatamente duas

O FR-019 fecha a conta antes de a implementação começar: **um** token de esqueleto, usado
nas duas barras, e **um** substrato tingido para o disco. Nada além disso é introduzido, e
nenhum valor visual cru aparece em componente.

| Token | Tipo | Papel | Onde é usado |
| --- | --- | --- | --- |
| `--skeleton` | declarado por tema | preenchimento das barras de esqueleto | as quatro barras de rótulo e as quatro de valor |
| `--accent-tint-surface` | derivado por `color-mix` | substrato do disco do indicador | o disco de 48px, e nada mais |

---

## 2. `--accent-tint-surface` — o disco

### Receita

```css
--accent-tint-surface: color-mix(in srgb, var(--accent) var(--state-tint-amount), var(--surface));
```

Declarada **uma vez**, fora dos blocos de tema, no mesmo lugar em que `--accent-tint` e os
dois `--brand-tint-*` já vivem. `var()` em propriedade customizada é substituída no
elemento onde a declaração vence, então tanto `--accent` quanto `--state-tint-amount` já
chegam com o valor do tema em vigor.

### Por que não `--accent-tint`

O token que já existe mistura sobre `--surface-zone`, porque nasceu no disco da etapa
atual da trilha — e a trilha é uma zona da casca. Este disco vive **dentro de um cartão**,
sobre `--surface`. No tema Papel a diferença é visível a olho nu: `--surface-zone` é
`#f1ece0` e `--surface` é `#ffffff`, então reaproveitar o token existente entregaria um
disco bege num cartão branco.

### Registro em `approvedPairs.ts`

Entra em `DERIVED_TOKENS`:

```ts
'--accent-tint-surface': {
  source: '--accent',
  amount: '--state-tint-amount',
  over: '--surface',
},
```

E ganha **um** par aprovado — o glifo âmbar fica inteiramente sobre a mistura, que é o
caso em que a intuição erra:

```ts
{
  foreground: '--accent-text',
  background: '--accent-tint-surface',
  usage: 'ui',
  where: 'Glifo de carregamento no disco do cartão de criação',
},
```

`APPROVED_PAIR_COUNT` vai de **31 para 32**, e o valor precisa ser editado à mão — é o que
faz apagar uma linha da lista virar falha de teste em vez de silêncio.

### O glifo é `--accent-text`, não `--accent`

O arquivo pinta o glifo com `#F5B301`, que é `--accent` cheio. `text-accent` é proibido
por `tp/no-raw-visual-values` (`accentMisuse`) e a proibição tem base medida: âmbar cheio
como tinta dá 1,7:1. No tema Noite `--accent-text` **é** `#f5b301`, então a fidelidade ao
arquivo é literal ali; no tema Papel ele escurece para `#816001`, que é a única forma de o
glifo existir sobre substrato claro.

---

## 3. `--skeleton` — as barras

### Valores

| Tema | Valor | Origem |
| --- | --- | --- |
| Papel (claro) | `#e7e0d2` | mesma família quente de `--rule` e `--surface-raised`, com luminosidade escolhida para cair na faixa do §3.2 |
| Noite (escuro) | `#252d3a` | o valor do nó `V4140k` do arquivo |

Declarados nos **dois** blocos de tema e repetidos no bloco `prefers-color-scheme: dark`,
como todos os outros — `contrast.spec.ts` falha se o `@media` divergir do
`[data-theme='dark']`.

Entra em `COLOR_TOKENS` e em `TokenName`. A lista vai de 19 para **20** nomes. Sem isso, a
asserção "nenhum token de cor foi declarado sem entrar em `COLOR_TOKENS`" falha — e é ela
que garante que o token exista nos dois temas.

### Uma tinta para as duas barras

O arquivo aparenta usar duas: `#252D3A` opaco no rótulo e branco a 8% no valor. Resolvidas
sobre `#161C25` elas dão **1,02:1 entre si** — não são dois tons, são o mesmo tom escrito
de duas maneiras. O que separa rótulo de valor é **dimensão**, e é isso que o FR-008 manda
preservar.

### `--skeleton` não é `--rule`, nem alias dele

O FR-019a é explícito. O fato de o valor do tema escuro coincidir com o hex de `--rule` é
coincidência de paleta, não parentesco de papel: `--rule` pinta **contorno**, e pintar
superfície com ele abriria precedente na camada mais rígida do sistema. No tema claro os
dois valores nem coincidem.

### 3.1 Por que `--skeleton` não tem par aprovado

Medido: `#252d3a` sobre `#161c25` dá **1,24:1**. O mínimo da categoria `ui` é 3:1.
Declarar o par reprovaria; declarar o par e afrouxar o mínimo destruiria o portão para
todos os outros usos.

E está certo que seja baixo. Uma barra de esqueleto a 3:1 é lida como conteúdo — o olho
para nela e tenta decifrá-la. O FR-008a não pede contraste, pede **perceptibilidade**.

O precedente é `--rule`, que está em `COLOR_TOKENS` e em nenhum par: filete decorativo,
1,37:1 sobre `--bg`, e o comentário de `approvedPairs.ts` já registra que um token pode
existir sem par aprovado e ainda assim precisar existir nos dois temas.

### 3.2 A faixa de perceptibilidade — o portão que substitui o par

Asserção nova em `tests/unit/contrast.spec.ts`, citando FR-008a:

```text
para cada tema:
  razão = contrastRatio(--skeleton, --surface)
  1,15 ≤ razão ≤ 1,60
```

- **Piso 1,15** — abaixo disso a barra desaparece no substrato e a forma do resultado
  deixa de ser antecipada, que é o motivo pelo qual o esqueleto existe.
- **Teto 1,60** — acima disso a barra compete com o texto do cartão e passa a parecer
  conteúdo esperando ser lido.

Os dois valores propostos caem dentro: escuro **1,24:1**, claro **1,31:1**. Se um deles
sair da faixa, a correção é o valor por tema — nunca a remoção da faixa.

**O que essa faixa verifica que nenhuma categoria de contraste verifica**: o teto. Uma
categoria `decorative` com mínimo 1:1 aprovaria inclusive um token invisível.

---

## 4. O rodapé usa `--ink-muted`, e a terceira tinta não entra

O nó `mJCdf` do arquivo usa `#5B6474` — uma tinta entre `--ink-muted` e o fundo. Ela
**não** é adotada (FR-020).

É a mesma decisão que a 007 registrou ao recusar `--ink-faint` para a etapa pendente da
trilha, e pelo mesmo motivo: a terceira tinta reprova em todos os substratos, e todo valor
que passa no limiar fica indistinguível de `--ink-muted`. Duas tintas com a mesma
aparência e nomes diferentes são uma armadilha, não uma escala.

O par `--ink-muted` sobre `--surface` já está aprovado. Nada a acrescentar.

**O portão é executável, e não um item de checklist.** Uma recusa registrada só em prosa é
uma recusa que a próxima feature desfaz sem perceber — o Princípio IV vale para o que a
spec proíbe tanto quanto para o que ela exige. `contrast.spec.ts` assere que o conjunto de
tokens de tinta é a lista fechada conhecida e que `#5b6474` não aparece em nenhum tema.

---

## 5. Emissão no `@theme inline`

```css
--color-skeleton: var(--skeleton);
--color-accent-tint-surface: var(--accent-tint-surface);
```

O modificador `inline` é o que faz o utilitário emitir `var(--…)` em vez do hex resolvido
em tempo de build. Sem ele a troca por `[data-theme]` não surte efeito nenhum.

Utilitários resultantes, e os **únicos** autorizados:

| Utilitário | Uso |
| --- | --- |
| `bg-skeleton` | as oito barras do esqueleto |
| `bg-accent-tint-surface` | o disco do indicador |

`text-skeleton`, `border-skeleton` e qualquer uso do disco fora do cartão de criação são
violações. A varredura de `tests/unit/no-orphan-tokens.spec.ts` os alcança pela regra
geral de valores visuais; o ponto único de uso do disco é verificado como em 008/FR-004,
por asserção de contagem de arquivos.

---

## 6. Portões

| Verificação | Onde | Requisito |
| --- | --- | --- |
| `--skeleton` existe nos dois temas e no bloco `@media` | `tests/unit/contrast.spec.ts` | FR-019, SC-002 |
| `--skeleton` cai na faixa de perceptibilidade nos dois temas | idem, asserção nova | FR-008a, SC-002 |
| `--accent-tint-surface` resolve e o par `ui` passa nos dois temas | idem | FR-019, SC-002 |
| `APPROVED_PAIR_COUNT` acompanha a lista (31 → 32) | idem | SC-002 |
| `COLOR_TOKENS` acompanha os tokens declarados (19 → 20) | idem | SC-002 |
| Nenhum valor visual cru em componente | `npm run lint` + `no-orphan-tokens.spec.ts` | FR-019 |
| O disco tem um único ponto de uso | `tests/unit/no-orphan-tokens.spec.ts` | FR-019 |
| A terceira tinta do arquivo não foi adotada | `tests/unit/contrast.spec.ts` — lista fechada de tokens de tinta, e `#5b6474` ausente dos dois temas | FR-020 |
