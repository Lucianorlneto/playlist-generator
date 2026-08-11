# Guia de Estilo

**Importador de Playlist por Texto** · sistema de design da feature 007 · 2026-08-09

Este documento é o **árbitro de decisões visuais futuras**. Quando surgir a dúvida "de que cor
fica este texto?", "quanto espaço vai aqui?" ou "isto é um selo ou um botão?", a resposta está
aqui — e se não estiver, a lacuna é do guia.

A feature 007 realinhou a interface ao arquivo de design oficial. O que mudou foi o **esqueleto**
e os **valores**; o comportamento é o mesmo, linha por linha. As decisões da 005 que este sistema
substitui estão registradas na **seção 11, com o motivo** — não apagadas.

---

## 0. Como este documento se relaciona com o código

**A definição normativa de cada valor é o ponto único no código; este documento o descreve.**

| O quê | Onde vive a definição |
| --- | --- |
| Valor de cada token, por tema | `src/styles/tokens.css` |
| Nomes semânticos e escalas finitas | `src/styles/index.css` |
| Lista fechada de pares aprovados | `src/domain/theme/approvedPairs.ts` |
| Razões de contraste | produzidas por `tests/unit/contrast.spec.ts` |
| Papéis de ícone | `src/ui/icons.ts` |
| Composição da trilha de etapas | `src/domain/rail/index.ts` |
| Anatomia de cada componente | o próprio componente em `src/ui/` e `src/features/` |

Divergência entre este guia e o código **se resolve corrigindo o guia**. Nunca duplicando o
valor: um hex copiado para cá vira a segunda cópia que diverge em silêncio, e a cópia errada é
sempre a que alguém lê primeiro.

Os números de contraste da seção 3 foram **produzidos pelo teste**, não recalculados à mão. Se
esta tabela e o teste discordarem, o teste está certo.

---

## 1. O sujeito, e por que ele decide o resto

Antes de qualquer cor: **este produto não é um player de música.** Não tem catálogo para navegar,
não tem capa de álbum como herói, não tem descoberta.

É um **conciliador**. Recebe uma lista de texto que alguém digitou, colou de uma mensagem ou
copiou de um setlist, e reconcilia linha a linha contra o catálogo de um serviço — acertando
umas, hesitando em outras, falhando em algumas — até virar playlist.

Consequência prática, e é a que resolve a maioria das dúvidas de layout: **o herói é a linha, não
a capa.** Se o produto fosse um player, a arte do álbum seria o elemento maior da tela. Como ele
é um conciliador, a capa é apoio de 32px e a linha ocupa o espaço.

O que a 007 acrescentou a essa tese: o conciliador agora **diz onde você está**. O fluxo tem cinco
etapas e antes elas eram uma faixa fina no topo; agora são uma trilha permanente à esquerda, com
nome, numeral e o que foi decidido em cada uma.

---

## 2. Cor

Nomes **semânticos**, nunca descritivos. `--ink-muted` sobrevive a uma troca de paleta;
`--cinza-claro` não. Componente consome nome, jamais valor — a regra de lint
`tp/no-raw-visual-values` recusa o contrário.

### Os 20 tokens

| Token | Papel | Papel (claro) | Noite (escuro) |
| --- | --- | --- | --- |
| `--bg` | Fundo da página e da área principal | `#faf7f0` | `#0d1117` |
| `--surface-zone` | Barra superior e trilha de etapas | `#f1ece0` | `#12171f` |
| `--surface` | Cartão, painel | `#ffffff` | `#161c25` |
| `--surface-raised` | Hover, linha alternada, campo focado | `#f4efe4` | `#1e2632` |
| `--rule` | Filete decorativo, divisor em repouso | `#e3dccd` | `#252d3a` |
| `--rule-strong` | Contorno **significante** | `#8b8476` | `#5e7a9d` |
| `--ink` | Texto principal | `#141c26` | `#e9eef5` |
| `--ink-muted` | Texto secundário **e etapa pendente** | `#5a6473` | `#8a94a6` |
| `--accent` | **Primária.** Preenchimento de ação | `#f5b301` | `#f5b301` |
| `--accent-deep` | Hover e ativo do preenchimento | `#dfa301` | `#dfa301` |
| `--accent-ink` | Texto sobre preenchimento âmbar | `#141c26` | `#0d1117` |
| `--accent-text` | Âmbar para texto, link, borda, foco | `#816001` | `#f5b301` |
| `--accent-tint-ink` | Texto sobre `--accent-tint` | `#6f5b2a` | `#d9c79a` |
| `--state-confident` | Correspondência confiante | `#1f766e` | `#4fd1c5` |
| `--state-uncertain` | Correspondência incerta | `#7a5c00` | `#f0c04a` |
| `--state-missing` | Não encontrada, erro | `#d31608` | `#f97066` |
| `--state-live` | Sessão viva no chip de conexão | `#349842` | `#3fb950` |
| `--brand-spotify` | Acento identificador do provedor | `#189946` | `#1db954` |
| `--brand-youtube` | Acento identificador do provedor | `#ff3126` | `#ff3b30` |
| `--skeleton` | Barras de esqueleto do cartão de criação | `#e7e0d2` | `#252d3a` |

### Seis coisas que não são óbvias na tabela

**`--accent` é idêntico nos dois temas.** É a âncora da identidade: a cor da ação não muda quando
o substrato muda.

**Não existe `--ink-faint`.** O arquivo de design usa uma terceira tinta (`#5f6878`) para a etapa
pendente da trilha. Ela reprova em todos os substratos, e todo valor que passa fica
indistinguível de `--ink-muted` — razão 1,03 no escuro, 1,07 no claro. A etapa pendente se
distingue por **forma**, não por tinta. Este é o achado mais consequente da feature: a medição de
contraste alterou o **desenho**, não só os valores.

A 009 recusou uma terceira tinta pela segunda vez, pelo mesmo motivo: o rodapé do cartão de criação
usa `#5B6474` no arquivo, e adotá-lo repetiria o erro. Ele usa `--ink-muted` (009/FR-020). A escala
de tinta tem **dois** degraus mais os dois de acento, e `tests/unit/contrast.spec.ts` assere a lista
fechada nos dois temas — uma recusa registrada só em prosa é uma recusa que a próxima feature desfaz
sem perceber.

**`--rule` não é contorno significante.** `#252d3a` sobre `--bg` dá 1,37:1. É separação
decorativa. Tudo que carregue significado usa `--rule-strong`.

**`--skeleton` não é `--rule`, nem alias dele** (009/FR-019a). O hex do tema Noite coincide, e a
coincidência é de paleta, não parentesco de papel: `--rule` pinta **contorno**, e pintar superfície
com ele abriria precedente na camada mais rígida do sistema. No tema Papel os dois valores nem
coincidem. É também o segundo token de cor **sem par aprovado**, pelo mesmo precedente de `--rule` —
ver §3.

**Uma tinta só para as duas barras do esqueleto.** O arquivo de design aparenta usar duas — opaco no
rótulo, branco a 8% no valor —, mas resolvidas sobre `#161C25` elas dão **1,02:1 entre si**: não são
dois tons, são o mesmo tom escrito de duas maneiras. O que separa rótulo de valor é **dimensão**,
como no caso da etapa pendente da trilha. É o mesmo achado, um cartão adiante.

**`--state-uncertain` é deliberadamente deslocado do âmbar de ação**, nos dois temas. Os dois
aparecem na mesma tela, e o selo "incerta" não pode ser o mesmo hex do botão primário.

**`--surface-zone` inverte a direção entre os temas.** No escuro é mais claro que `--bg`; no claro
é mais escuro. É o degrau de luminosidade que separa a zona do conteúdo, e ele só funciona
afastando-se do substrato.

**`--accent-tint-ink` existe porque tinta fria sobre substrato quente lê errado.** O aviso do painel
de ordem de execução usava `--ink-muted`, que passava no contraste (4,78:1 e 4,43:1) e ainda assim
parecia texto caído no lugar errado — o arquivo de design o escreve numa tinta da **família do
substrato**. O valor do escuro é o do arquivo; o do claro conserva matiz e saturação (43°, 45%) e
rebaixa a luminosidade para 30%, a mesma receita das variantes claras de `--brand-*`.

**Cor de marca nunca é ação, estado ou texto.** É acento identificador: tinge o ícone do provedor
e nada mais. A restrição tem base medida — `#ff3b30` sobre `--surface-raised` dá 4,29:1 e
reprovaria como texto. `tp/no-raw-visual-values` recusa `bg-brand-spotify` e `bg-brand-youtube`
em toda parte, sem exceção.

### O substrato de identidade — a exceção nomeada (008/FR-003, FR-004)

Há **um** lugar em que a cor de marca preenche uma superfície: o distintivo do cartão de destino,
que o arquivo de design desenha com `#1DB9541F` no Spotify e `#FF3B301F` no YouTube. Os tokens são
`--brand-tint-spotify` e `--brand-tint-youtube`, derivados por `color-mix` da cor da marca com
`--surface`, a 12% no claro e 15% no escuro.

**A exceção é nomeada, não numérica**, e a diferença importa: um limiar de opacidade ("preenchimento
de marca é permitido abaixo de 20%") seria alegável por qualquer tela nova sem passar por revisão, e
a regra deixaria de ser fechadura para virar argumento. A fechadura é tripla:

1. **nome próprio** — `bg-brand-spotify` continua proibido; `bg-brand-tint-spotify` é outro
   utilitário, com outro token. Não há como alcançar a exceção por acidente de opacidade;
2. **allowlist de arquivo** em `eslint-rules/index.js` — o utilitário é aceito apenas em
   `src/features/destinations/DestinationSelector.tsx`. Autorizar um segundo ponto custa editar a
   regra, que é a revisão que se quer forçar;
3. **teste de ponto único** em `tests/unit/no-orphan-tokens.spec.ts` — cobre o caso de alguém
   desativar a regra de lint com um comentário de supressão.

Os dois pares são **medidos** e entram na lista fechada: glifo verde sobre substrato esverdeado é o
caso em que a intuição erra, porque o tingimento aproxima o fundo da própria cor do glifo.

O marcador da fila do painel "Ordem de execução" e o cabeçalho dos cartões de fase tingem **só o
glifo**, sobre substrato neutro — a exceção não os alcança.

### Fundos tingidos de estado

Continuam **derivados** por `color-mix` do token de estado com `--surface`, a 12% no claro e 15%
no escuro. Não são tokens próprios — derivar impede que trocar uma cor de estado exija editar dois
valores e esquecer um.

O mesmo vale para `--accent-tint`, usado no disco da etapa atual da trilha, no cartão de destino
selecionado e no aviso do painel lateral.

**`--accent-tint-surface` é o mesmo âmbar tingido, sobre o outro substrato** (009/FR-019). São dois
tokens e não um porque o substrato difere: `--accent-tint` nasceu no disco da trilha, que é uma zona
da casca e repousa sobre `--surface-zone`; `--accent-tint-surface` veste o disco do indicador de
criação, que vive **dentro de um cartão**, sobre `--surface`. No tema Papel a diferença é visível a
olho nu — `#f1ece0` contra `#ffffff` —, e reaproveitar o primeiro entregaria um disco bege num cartão
branco. Ele tem **um único ponto de uso**, verificado por contagem de arquivos em
`tests/unit/no-orphan-tokens.spec.ts`, no mesmo molde da exceção de identidade acima.

---

## 3. Pares aprovados e contraste

**Lista fechada de 32 combinações.** Combinação que não está em
`src/domain/theme/approvedPairs.ts` é proibida em qualquer componente. É essa fechadura que torna
a verificação exaustiva: sem ela o portão só cobriria os pares que alguém lembrou de escrever, e
a omissão passaria como aprovação.

Mínimos: `text` = 4,5:1 · `large-text` = 3:1 · `ui` (borda, ícone, anel de foco) = 3:1.

A lista cresceu de 15 (feature 005) para 27 na 007, para 31 na 008 e para 32 na 009. O crescimento
**não vem de cores novas**: vem de substratos novos. Texto e ícone sobre `--surface-zone` — a barra
superior e a trilha — são combinações que não existiam antes de a casca de três zonas existir; o
glifo da marca sobre o seu próprio substrato tingido; e o glifo de carregamento sobre o âmbar
tingido de `--surface`, que é o mesmo caso um cartão adiante.

O par da 009, medido:

| Par | Papel (12%) | Noite (15%) |
| --- | --- | --- |
| `--accent-text` sobre `--accent-tint-surface` | 5,4:1 | 6,8:1 |

O arquivo de design pinta esse glifo com `#F5B301` — `--accent` cheio. `text-accent` é proibido, com
base medida: âmbar cheio como tinta dá 1,7:1. A tinta adotada é `--accent-text`, que no tema Noite
**é** `#f5b301` — ali a fidelidade ao arquivo é literal; no Papel ele escurece para `#816001`, que é
a única forma de o glifo existir sobre substrato claro.

Os quatro pares da 008, medidos:

| Par | Papel (12%) | Noite (15%) |
| --- | --- | --- |
| `--brand-spotify` sobre `--brand-tint-spotify` | 3,20:1 | 5,20:1 |
| `--brand-youtube` sobre `--brand-tint-youtube` | 3,10:1 | 4,20:1 |
| `--accent-tint-ink` sobre `--accent-tint` | 5,23:1 | 8,11:1 |
| `--accent-text` sobre `--accent-tint` | 4,64:1 | 7,30:1 |

**`--accent-tint` entrou na lista como substrato derivado, e a entrada corrige uma omissão.** Ele já
era fundo de texto — o aviso do painel de ordem de execução — sem nunca ter sido medido, que é
exatamente o buraco que uma lista fechada existe para não ter. A tinta daquele aviso passou de
`--ink-muted` para `--accent-tint-ink`: o par antigo até passava (4,78:1 no claro, 4,43:1 no
escuro), mas o cinza-azulado frio sobre âmbar tingido lia como texto caído ali por engano, e o
arquivo de design escreve o aviso numa tinta **quente**, da família do substrato.

A margem do tema Papel é estreita e vale ser dita: 3,10:1 passa por 0,10. Se um acerto futuro no
substrato claro derrubar o número, o grau de liberdade é reduzir `--brand-tint-amount` daquele
tema — **a cor da marca não é alterada nem removida**.

Os substratos derivados são resolvidos pelo próprio teste, que reproduz a mistura em sRGB a partir
dos hex de `tokens.css`. Nenhum valor é digitado duas vezes.

Os pares deliberadamente **ausentes**, e por quê:

- `--brand-*` como texto — proibido por decisão de sistema, com base medida;
- `--accent` como texto sobre qualquer substrato claro — 1,73:1. Só preenchimento;
- qualquer coisa sobre `--rule` — `--rule` é filete, não substrato;
- qualquer coisa com `--skeleton` — ver a faixa de perceptibilidade logo abaixo;
- um derivado como **tinta** — uma mistura translúcida da própria cor do glifo não é tinta de nada.

### A faixa de perceptibilidade — o portão que substitui um par (009/FR-008a)

`--skeleton` é o segundo token de cor **sem par aprovado**, depois de `--rule`. Medido, ele dá
**1,2:1** no Noite e **1,3:1** no Papel contra `--surface`, e o mínimo da categoria `ui` é 3:1.
Declarar o par reprovaria; declarar o par e afrouxar o mínimo destruiria o portão para todos os
outros usos.

**E está certo que seja baixo.** Uma barra de esqueleto a 3:1 é lida como conteúdo — o olho para
nela e tenta decifrá-la. O requisito não pede contraste, pede **perceptibilidade**.

O portão próprio, em `tests/unit/contrast.spec.ts`, é uma faixa com piso e teto nos dois temas:

```text
1,15 ≤ contrastRatio(--skeleton, --surface) ≤ 1,60
```

- **Piso 1,15** — abaixo disso a barra desaparece no substrato e a forma do resultado deixa de ser
  antecipada, que é o motivo pelo qual o esqueleto existe;
- **Teto 1,60** — acima disso a barra compete com o texto do cartão e passa a parecer conteúdo
  esperando ser lido.

O teto é o que **nenhuma categoria de contraste verifica**. Uma categoria `decorative` com mínimo
1:1 aprovaria inclusive um token invisível — foi a alternativa recusada. Se um dos dois temas sair
da faixa, a correção é o valor por tema, nunca a remoção da faixa.

Todos os 32 pares passam nos dois temas. Um único valor foi ajustado na implementação da 007:
`--accent-text` no tema claro saiu de `#896401` para `#816001`, porque o primeiro dava 4,58:1 sobre
`--surface-zone` — passava por 0,08, e qualquer acerto futuro no substrato da zona o derrubaria.

---

## 4. Tipografia

Família única: **Space Grotesk**, variável, subsetada, com substituta de métrica compatível.
**Inalterada em relação à 005** — a 007 não tocou no `@font-face`, no subset nem no fallback.

### A escala — 6 degraus, e nada fora deles

| Degrau | Tamanho | Peso | Uso |
| --- | --- | --- | --- |
| `--text-data` | 0,75rem | 500 | Rótulo tabular, numeral, selo |
| `--text-meta` | 0,8125rem | 400 | Meta, legenda, linha de apoio |
| `--text-body` | 0,875rem | 400 | Texto corrido, rótulo de item |
| `--text-section` | 1rem | 600 | Título de seção, título de cartão |
| `--text-step` | 1,5rem | 600 | Título de seção interna de tela |
| `--text-page` | 2rem | 700 | **Título de tela** |

`--text-*: initial` está declarado: o Tailwind **não** gera `text-xl` nem `text-7xl` sob demanda.

**Piso de legibilidade**: `--text-data` é reservado a rótulo tabular, numeral e selo. **Nenhum
texto que carregue conteúdo desce abaixo de `--text-meta`.** O tamanho mais frequente do arquivo
de design é 12,5px — 98 ocorrências —, abaixo do degrau `meta`; adotá-lo literalmente encolheria
a interface inteira. O agrupamento preserva a proporção do desenho e descarta a precisão falsa de
meio pixel.

**Pesos**: 500 (corrente), 600 (ênfase), 700 (título). O peso 800 aparece 7 vezes no arquivo de
design e é normalizado para 700.

### `--text-data` é obrigatoriamente tabular

O utilitário `data-numeral` liga `font-variant-numeric: tabular-nums`. Sem ele, a diferença medida
entre `08` e `11` desalinha a coluna em 4,6px nas telas de resultado.

**O utilitário sobreviveu à goteira, e de propósito.** Ele fazia duas coisas: dava o corpo do
numeral da goteira e ligava `tabular-nums`. A goteira saiu; a numeração tabular ficou. Removê-lo
junto seria uma regressão que a denylist **não pegaria** — o utilitário continuaria existindo, e
só o alinhamento quebraria.

### A fonte embarcada

Arquivo versionado em `src/assets/fonts/space-grotesk-subset.woff2` — **24 KB**. Nenhuma entrada
no `package.json`, nenhuma origem remota. A licença é SIL OFL 1.1 e o texto integral acompanha o
arquivo em `src/assets/fonts/OFL.txt`.

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

### Fallback sem deslocamento

Durante o `swap`, a pilha nativa desenha o texto. O `@font-face` de fallback traz
`size-adjust: 93.72%` — derivado da razão entre a altura de x de Space Grotesk (486/1000) e a de
Arial (1062/2048) — mais `ascent-override` e `descent-override`. **Recalcular junto se o arquivo
da fonte for trocado.**

---

## 5. Espaçamento, raio, profundidade, layout

### Espaçamento — 8 degraus

`--spacing-0.5: 0.125rem` · `--spacing-1: 0.25rem` · `--spacing-2: 0.5rem` ·
`--spacing-3: 0.75rem` · `--spacing-4: 1rem` · `--spacing-6: 1.5rem` · `--spacing-8: 2rem` ·
`--spacing-12: 3rem`

`--spacing: initial` está declarado: o Tailwind **não** gera `p-5` nem `p-13` sob demanda. Zero
(`--spacing-0`) existe porque `inset-0` e `min-w-0` dependem dele, mas não é degrau — é a ausência
de espaço.

O degrau de 2px entrou na 007 porque o arquivo de design o usa 73 vezes: é o respiro entre o nome
da etapa e a linha de apoio, e colapsá-lo em 4px engordaria a trilha inteira.

### Raio — 5 degraus

| Token | Valor | Uso |
| --- | --- | --- |
| `--radius-hair` | 2px | Conector da trilha, barra de progresso |
| `--radius-control` | 8px | Botão, campo, caixa de seleção |
| `--radius-card` | 12px | Cartão, painel |
| `--radius-panel` | 16px | Zona, cartão de destino, diálogo |
| `--radius-pill` | 9999px | Chip, selo |

### Profundidade — assimétrica, e isso é escolha

| Tema | Mecanismo |
| --- | --- |
| Claro | Um nível: `0 1px 2px rgb(20 28 38 / 6%), 0 4px 12px rgb(20 28 38 / 5%)` |
| Escuro | **Nenhuma sombra.** Degrau de luminosidade (`--bg` → `--surface-zone` → `--surface` → `--surface-raised`) mais filete de 1px |

Sombra preta sobre fundo quase-preto não é visível. Aplicar o mesmo sistema aos dois substratos
produziria um tema escuro chapado, com custo de renderização e nenhum benefício.

Existe **um** nível. Um segundo degrau para um elemento pequeno é escala fora da escala.

### Layout

| Token | Valor | Papel |
| --- | --- | --- |
| `--container-measure` | 42,5rem | Coluna primária de leitura |
| `--container-panel` | 32rem | Largura do painel modal |
| `--rail-width` | 18,5rem | Largura da trilha de etapas |
| `--side-panel-width` | 20,625rem | Painel lateral de apoio |
| `--topbar-height` | 4,25rem | Altura mínima da barra superior |
| `--chip-max-width` | 18,75rem | Teto de largura do chip de conexão |
| `--breakpoint-shell` | 64rem | Abaixo daqui a casca colapsa |

**`--breakpoint-shell` foi medido, não estimado**: 18,5rem de trilha + 42,5rem de coluna de
leitura + 2rem de respiro lateral = 63rem de mínimo absoluto. 64rem é o primeiro rem inteiro
acima disso. Abaixo, a coluna de leitura teria de encolher para caber a trilha — e a trilha existe
para servir o conteúdo, não o contrário.

O valor existe **duas vezes**: aqui e em `src/styles/breakpoints.ts`, porque CSS não lê constante
de JavaScript e `@media` não aceita `var()`. `tests/components/shell.spec.tsx` falha se as duas
divergirem.

As três medidas de zona vivem como propriedade customizada simples, fora do `@theme`, porque não
pertencem a nenhum espaço de nome que o Tailwind reconheça. Elas são consumidas pelos utilitários
`zone-topbar`, `zone-rail`, `zone-side-panel` e `chip-measure` — **não** por `min-h-topbar`
escrito no componente, que seria uma classe que não emite CSS nenhum.

---

## 6. A casca de três zonas

**A estrutura permanente da aplicação, e a assinatura desta versão.**

```text
┌─ Barra superior ─────────────────────────────────────────────┐
│ Marca            Chip Spotify · Chip YouTube │ ⌗ Tema        │
├─ Trilha ──────────┬─ Área principal ─────────────────────────┤
│ ETAPAS            │  ┌ Coluna primária ─┐  ┌ Painel lateral ┐│
│  ① Configuração   │  │                  │  │   (opcional)   ││
│  ② Destinos       │  └──────────────────┘  └────────────────┘│
│  ③ Entrada        │                                          │
│  ④ Serviço        ├─ Barra de ações (Config.·Destinos·Entrada)┤
│  ⑤ Resumo         │  Estado em texto            Voltar  Ir → │
│ ↺ Recomeçar       │                                          │
└───────────────────┴──────────────────────────────────────────┘
```

**Ordem no DOM = ordem visual de leitura**: barra superior → trilha → conteúdo → barra de ações.
Nenhuma reordenação por CSS que descole as duas — é o que faz a ordem de tabulação seguir o olho
sem `tabindex` positivo em lugar nenhum.

### O que cada zona responde

| Zona | A pergunta que ela responde | Substrato |
| --- | --- | --- |
| Barra superior | "Estou conectado?" | `--surface-zone` |
| Trilha | "Onde eu estou, e o que já decidi?" | `--surface-zone` |
| Área principal | "O que faço agora?" | `--bg` |
| Barra de ações | "Posso avançar? Se não, por quê?" | `--bg` |

### A casca não rola; quem rola é o conteúdo

Uma zona que responde a pergunta de orientação **deixa de responder quando sai da tela**. A barra
superior e a trilha permanecem à vista: a casca ocupa a janela (`h-dvh` com `overflow-hidden`) e
entrega a rolagem ao contêiner da área principal.

Três detalhes que sustentam isso, e cada um é fácil de perder numa refatoração de layout:

- **`min-h-0` no contêiner de conteúdo.** Um item de flex tem `min-height: auto` e se recusa a
  encolher abaixo do próprio conteúdo. Sem essa classe o contêiner cresce e devolve a rolagem ao
  documento, levando as duas zonas junto;
- **`relative` nas regiões roláveis.** `sr-only` é `position: absolute`, e sem um ancestral
  posicionado esses elementos ancoram no **documento** — escapam do `overflow-hidden` da casca e
  inflam o `scrollHeight` do `html` com altura invisível. Foram 832 px de fantasma, que só a
  rolagem programática revelava: com a roda funcionava, e `scrollIntoView` ou o link "Ir para o
  conteúdo" deslizavam a página inteira;
- **`overflow: hidden` em `html, body`**, como segunda linha de defesa contra o mesmo caminho.

`dvh` e não `vh`: em navegador de telefone a barra de endereço entra e sai, e `100vh` mede a janela
**sem** ela — a diferença é uma faixa de conteúdo cortada embaixo, que só aparece no aparelho de
alguém.

A trilha rola por conta própria (`overflow-y-auto`) porque numa janela baixa — telefone deitado,
zoom de texto a 200% — os cinco degraus mais o rodapé passam da altura disponível.

O portão é `e2e/shell-scroll.spec.ts`, que exercita os três gestos (roda, API e âncora) e exige que
todo contêiner rolável contenha algo focável — uma região que rola sem nada focável dentro é
inalcançável por teclado, e é a regra `scrollable-region-focusable` do axe que os testes de
acessibilidade deste projeto **não** pegam, porque sem layout nada é considerado rolável.

### A trilha decide nada

`src/app/StepRail.tsx` **desenha** o que `src/domain/rail/` devolve. Quais degraus existem, como
se numeram e o que cada um declara é regra de negócio, e regra de negócio não mora em componente.
A regra "a etapa Resumo só existe com mais de um destino" tinha duas cópias antes da 007 — entre
o indicador e o redutor da fila — e agora tem um lar único, testável sem DOM.

### Anatomia do indicador — a distinção é por forma

| Estado | Disco | Conteúdo | Conector | Tinta do nome |
| --- | --- | --- | --- | --- |
| `done` | Preenchido `--accent` | Ícone `check` em `--accent-ink` | `--accent` | `--ink` |
| `current` | Tingido (`--accent-tint`) | Numeral em `--accent-text` | `--rule` | `--ink` |
| `pending` | Vazado, contorno `--rule-strong` | Numeral em `--ink-muted` | `--rule` | `--ink-muted` |

**Esta tabela é a razão pela qual `--ink-faint` não existe.** Preenchido / tingido / vazado é
forma, e forma sobrevive a cores forçadas e a daltonismo.

### A linha de apoio nunca afirma o que não aconteceu

Uma regra, e uma só (008/FR-028): **a linha deriva quando há valor decidido, e fica neutra quando
não há.** Vale igualmente para degrau concluído, corrente e à frente — o estado do degrau não é
lido.

A 007 tinha uma guarda a mais, `if (state !== 'done')`. Eram duas regras onde uma basta, e a segunda
produzia um efeito que o arquivo de design contradiz: na etapa Destinos corrente, com os dois
serviços já marcados, a linha continuava dizendo "Escolha onde criar as playlists" em vez de nomear
o que foi escolhido.

**Isto não afrouxa a proibição.** O que impede a trilha de afirmar uma escolha inexistente nunca foi
o estado do degrau, e sim a **ausência de valor** — um degrau sem dado real volta a neutro em vez de
afirmar um vazio. É o que separa esta implementação do mockup: o arquivo mostra "Spotify e YouTube"
sob Destinos já na tela de Configuração, e reproduzir isso seria a trilha declarando uma escolha que
o usuário ainda não fez.

Uma consequência que a regra única expôs, e que precisou de correção de **valor**: a etapa Serviço
derivava da contagem de destinos, o que era inofensivo enquanto só degrau concluído derivava. Sem a
guarda, a trilha passaria a dizer "2 serviços concluídos" no instante em que o segundo destino fosse
marcado. O valor decidido daquela etapa não é quantos destinos existem, é **quantos serviços
terminaram** — e o `RailSnapshot` ganhou `servicesFinished` para dizer isso.

A fonte dos destinos também mudou, pelo mesmo motivo: era `queue.order`, que só existe depois da
etapa Entrada, e passou a ser `destinations.selected`, que existe enquanto a escolha está sendo
feita. Não é uma segunda fonte de ordem — `destinations.selected` já é mantido ordenado por
`orderSelection`, pela mesma `PROVIDER_ORDER` de que `buildQueue` deriva.

### Largura estreita

Abaixo de `--breakpoint-shell` a trilha **não é renderizada**: o `StepSummary` toma o seu lugar no
topo do conteúdo, o painel lateral desce para baixo da coluna primária, e a ação de recomeçar
migra para a barra superior.

A troca acontece em JavaScript e não por `display: none` porque as duas formas carregam
`aria-current="step"`, e duas cópias — mesmo com uma escondida — seriam dois portadores da mesma
afirmação para qualquer coisa que leia o DOM sem aplicar CSS.

O `StepSummary` é **informação, não navegação**: sem estado de abertura, sem controle acionável
novo, sem parada de tabulação adicional.

### A barra de ações, e onde ela não existe

**Configuração, Destinos e Entrada. A lista é fechada**, e vive num único ponto —
`ACTION_BAR_BY_STEP` em `src/app/Shell.tsx`. O critério é **ter uma decisão de etapa a
confirmar**.

Configuração entrou na 008, revertendo uma decisão da 007. O argumento de lá — "esta etapa tem um
cartão por serviço, cada um com a sua ação" — continua valendo para **salvar e remover**, que são
sobre aquele Client ID e permanecem nos cartões. Ele não valia para o avanço, que é decisão da
etapa: ao pé de uma página de dois mil pixels, um botão só existe depois de rolar tudo.

Configuração, ciclo de serviço e Resumo mantêm as ações **dentro do cartão que as explica**. Em
particular, "Pular o {serviço}" permanece adjacente ao cartão de conexão, reautorização, orçamento
e revisão. Redesenhar sim; realocar não — mover a ação para uma faixa genérica desfaria a ligação
entre o que se pula e onde se está.

Quando o avanço não é possível, o **motivo é dito por escrito** na faixa, e a indisponibilidade é
perceptível sem cor: o botão fica `disabled` — atributo que o navegador anuncia e o teclado
respeita — e o motivo está à esquerda, com prefixo e ícone.

---

## 7. Componentes

Regra transversal, e é a que mais importa: **estado nunca depende só de cor.** Todo estado carrega
pelo menos dois canais entre tinta, forma, ícone e palavra.

Segunda regra transversal: **preenchimento sólido significa acionável — e principal.** Estado usa
fundo tingido com contorno, ícone e rótulo, nunca preenchimento. É o que impede o selo "incerta",
que é âmbar, de ser confundido com o botão de avançar, que também é âmbar.

### 7.1 `Button` — `src/ui/Button.tsx`

`--radius-control` (8px). Quatro variantes, e só uma tem fundo cheio.

| Variante | Repouso | Hover | Ativo | Desabilitado |
| --- | --- | --- | --- | --- |
| `primary` | `--accent` sólido, texto `--accent-ink` | `--accent-deep` | `--accent-deep` | `opacity: 50%`, cursor bloqueado, sem hover |
| `secondary` | `--surface`, contorno `--rule-strong` | `--surface-raised` | idem | idem |
| `danger` | `--surface`, tinta e contorno `--state-missing` | `--state-missing-tint` | idem | idem |
| `ghost` | transparente, tinta `--ink-muted` | `--surface-raised`, tinta `--ink` | idem | idem |

**Foco**: `outline` de 2px em `--accent-text`, com `outline-offset: 2px`. Nunca `box-shadow`.

**`danger` não é preenchido** de propósito: um botão destrutivo sólido competiria com a ação
primária da mesma tela pela mesma pista visual.

### 7.2 `TextField` e `TextArea` — `src/ui/`

`--radius-control` (8px). Contorno `--rule-strong` — carrega significado, é ele que separa a área
digitável do substrato.

| Estado | Aparência |
| --- | --- |
| Repouso | `--surface`, contorno `--rule-strong` |
| Foco | Fundo passa a `--surface-raised`, mais o `outline` do anel de foco |
| Erro | Contorno `--state-missing`, `aria-invalid`, mensagem com `role="alert"` |
| Aviso | Mensagem em `--state-uncertain`, **sem** invalidar o campo |
| Desabilitado | Herda o padrão do navegador; nenhum estilo próprio |

O `TextArea` difere em uma coisa: `font-mono`. A lista colada é dado tabular, e o alinhamento
entre "título - artista" de linhas sucessivas é o que deixa conferir de relance.

### 7.3 `Toggle` — `src/ui/Toggle.tsx`

`<button role="switch">` com `aria-checked`. Trilho `--radius-pill`.

Ligado: trilho `--accent`, botão com o glifo `done` dentro. Desligado: trilho `--surface-raised`,
contorno `--rule-strong`, botão liso.

**O glifo é a distinção por forma.** Sem ele, a única diferença entre os dois estados seria a
posição do botão e a cor do trilho — e a posição sozinha é sutil num controle de 48px.

### 7.4 `Dialog` — `src/ui/Dialog.tsx`

`<dialog>` nativo, `showModal()` sempre. `--radius-panel` (16px), contorno `--rule-strong`, véu
`--scrim`, largura `--container-panel`.

**Analogia declarada** — ver seção 12.

### 7.5 `StatusBadge` — `src/features/review/StatusBadge.tsx`

O componente onde a regra de FR-024 mais importa. Anatomia: fundo tingido + contorno na cor do
estado + ícone + rótulo textual. **Nunca preenchimento sólido.**

| Estado | Tinta | Ícone (papel) | Rótulo |
| --- | --- | --- | --- |
| `confident` | `--state-confident` | `confident` (`gem`) | "Confiante" |
| `uncertain` | `--state-uncertain` | `uncertain` | "Incerta" |
| `not_found` | `--state-missing` | `missing` | "Não encontrada" |
| `unparsed` | `--state-uncertain` | `uncertain` | "Não interpretada" |
| `searching` | `--ink-muted` | `loading` | "Buscando" |
| `pending` · `discarded` | `--ink-muted` | — | Rótulo próprio |

`pending` e `discarded` não têm ícone: são ausência de resultado, não um resultado. Dar-lhes um
glifo sugeriria que algo foi decidido.

### 7.6 `StepRail` e `StepSummary` — `src/app/`

Ver seção 6.

### 7.7 `ConnectionChip` — `src/features/connect/ConnectionChip.tsx`

Três estados, distinguíveis por **rótulo e forma**, não só por cor.

| Estado | Ícone do provedor | Indicador | Conta | Ações |
| --- | --- | --- | --- | --- |
| `connected` | Cor de marca | Ponto `--state-live` preenchido | Identificador | Reconectar · Sair |
| `disconnected` | Cor de marca, esmaecido | Anel vazado `--rule-strong` | — | Conectar |
| `no-credential` | Neutro (`--ink-muted`) | Ausente | **Nunca** | Configurar |

**`no-credential` nunca exibe identificador de conta** — nem vazio, nem genérico. Não houve
autorização, e um lugar reservado para a conta sugere que houve.

**Nenhum dos três é beco sem saída.** É o defeito que a feature 004 fechou e a 007 preserva: a
lista era "provedores com sessão ativa", e o serviço sumia do cabeçalho no exato instante em que a
sessão caía, levando junto o seu único ponto de interação.

O nome acessível das ações diz "a conta do {serviço}" e não "ao {serviço}", para não colidir com o
botão primário da etapa de conexão. Dois controles com o mesmo nome acessível deixam quem usa
leitor de tela sem como escolher entre eles.

### 7.8 `ActionBar` — `src/app/ActionBar.tsx`

Estado à esquerda, ações à direita. Avançar é a **única** ação primária; retornar é `ghost`.

Três estados do lado esquerdo, e eles dizem coisas diferentes:

| Estado | Ícone | Texto |
| --- | --- | --- |
| Livre | `status-ok` em `--state-confident` | O estado da etapa |
| Bloqueado | `hint` em `--state-uncertain` | "Para avançar:" + o motivo |
| Ocupado | `loading` em `--ink-muted` | "Carregando…" |

**Bloqueado e ocupado não são o mesmo estado.** No primeiro o usuário precisa *fazer* algo; no
segundo, *esperar*. Tratá-los juntos faria a faixa acusar o usuário de não ter feito nada quando o
aplicativo é que está trabalhando.

### 7.9 `MatchRow` — `src/features/review/MatchRow.tsx`

A linha da tela mais densa. Caixa de seleção, numeral tabular, entrada como colada em
`--text-meta`, correspondência em `--text-body`.

**Capa de terceiro recebe contorno `--rule-strong`**: são imagens com cores arbitrárias e precisam
de contorno para se separar do fundo nos dois temas. É por causa deste uso que `--rule-strong`
precisa dos 3:1 que tem.

### 7.10 `ThemeControl` — `src/features/theme/ThemeControl.tsx`

Três opções, não um interruptor. Padrão de `radiogroup`: setas movem **e** selecionam, e só o
segmento selecionado fica na ordem de tabulação — o grupo inteiro é **uma** parada de Tab.

Um interruptor binário tornaria "acompanhar o sistema" inalcançável depois do primeiro clique.

Abaixo do ponto de corte da casca sobra só o ícone; o rótulo vira `sr-only`, não desaparece.

### 7.11 Componentes menores

| Componente | Anatomia |
| --- | --- |
| `CopyButton` | `Button` `secondary` `sm` + `LiveRegion` que anuncia o desfecho |
| `VersionHintBadge` | `status-badge` com tinta `--state-uncertain` e ícone `uncertain` |
| `RateLimitWaiting` | Cartão `--radius-card`, fundo `--state-uncertain-tint`, ícone `loading` girando |
| `LiveRegion` | `aria-live` sempre presente, mesmo vazia |
| `QueueIndicator` | Ícone `queue` e a posição por extenso, no cabeçalho dos cartões de fase. **Não é região viva** desde a 008 — quem anuncia é o `StepContextLine` |
| `DraftRecoveryBanner` | `guide-edge` (barra âmbar de 3px), fundo `--surface` |
| `StepContextLine` | `--text-meta`; primeiro nome em `--accent-text`, complemento em `--ink-muted`. `role="status"` **só** na forma de serviço |
| `ExecutionOrderPanel` | Painel `--surface` com contorno `--rule` e `--radius-panel`; texto antes da fotografia |
| `DestinationSelector` | Cartão com distintivo tingido, linha de estado da conta e marca de verificação à direita |

### 7.12 Utilitários nomeados

Recorrência que aparece em três ou mais lugares vira utilitário, nunca string copiada entre
componentes.

| Utilitário | O que carrega |
| --- | --- |
| `app-card` | Cartão: raio, contorno, superfície, respiro, profundidade. **Não envolve o cabeçalho de etapa** — ver abaixo |
| `focus-ring` | Anel de foco por `outline` |
| `status-badge` | Anatomia base do selo de estado |
| `field-message` | Mensagem de apoio de campo |
| `data-numeral` | Numeral tabular |
| `guide-edge` | Barra âmbar de 3px à esquerda |
| `icon-glyph` | Tamanho em `1em`, proteção em flex, alinhamento óptico |
| `zone-topbar` · `zone-rail` · `zone-side-panel` · `chip-measure` | As medidas das zonas |

**Onde `app-card` vale, e onde não** (008/FR-006). O arquivo de design não desenha cartão em volta
do cabeçalho de etapa em **nenhuma** das quatorze telas: `Heading` é filho direto de
`Primary Column`, sem preenchimento e sem contorno. Até a 007 o `Wizard` envolvia o conteúdo de toda
etapa num `app-card`, e era essa a "div com borda e cor" em volta de "Para onde vai a playlist?".

O utilitário permanece, e é usado onde o arquivo **desenha** cartão: linha de correspondência
(`g3IhDr`), resultado por serviço (`x2kz71`), cartão de orçamento (`rxIZJ`) e cartão de resultado do
ciclo (`yTOJb`). Nos dois últimos ele é declarado pela própria tela, e não herdado — é o que devolve
o degrau de luminosidade às caixas internas, que o arquivo desenha em `--bg` sobre `--surface`.
| `brand-mark` · `sticker` · `sticker-faint` · `stickers-band` · `ambient-backdrop` · `mood-photo-veil` | Tratamento de decoração por tema |

---

## 8. Ícones

**Uma superfície pede um papel, nunca um componente.** `<Icon role="advance" />`, nunca
`<LuArrowRight />`.

`src/ui/icons.ts` é o único arquivo do projeto que importa de `react-icons`. A regra é imposta
duas vezes: `tp/no-icon-library-import` pega no editor,
`tests/unit/icon-roles.spec.ts` pega em CI.

### Os dezenove papéis

`brand` · `theme-light` · `theme-dark` · `theme-system` · `restart` · `reconnect` · `advance` ·
`back` · `done` · `status-ok` · `confident` · `uncertain` · `missing` · `hint` · `queue` ·
`loading` · `external` · `provider-spotify` · `provider-youtube`

Dezoito vêm da biblioteca — dezesseis do Lucide, dois do Phosphor. **A marca é o único que resolve
para arte**: `Logo Mark.png`, que não existe em biblioteca alguma, não herda `currentColor` e
exige tratamento por tema.

### As três regras de consumo

1. **Cor vem do contexto.** `currentColor`, sempre. Um ícone que fixa a própria cor sobrevive à
   troca de tema com a cor errada, e a falha é invisível em revisão de código.
2. **Tamanho acompanha o tipo do contexto.** `1em`, nunca medida avulsa — é o que impede a escala
   finita de tipografia de ser contornada por uma escala paralela de ícones.
3. **Semântica pelo papel na frase.** Decorativo quando acompanha rótulo textual; nome acessível
   próprio quando é o único conteúdo de um controle.

**Importação por subcaminho** (`react-icons/lu`, `react-icons/pi`), nunca do índice raiz: o índice
puxa a árvore inteira sem emitir aviso nenhum.

### Por que uma dependência, se o projeto escreve SVG à mão

Decisão de padronização explícita do autor, registrada no **Complexity Tracking** do plano.
Transcrever os dezesseis SVGs à mão era mais simples e tecnicamente viável; o que se ganha em
troca é rastreabilidade — o nome do ícone no arquivo de design mapeia para um componente nomeado,
e não para um caminho SVG anônimo que ninguém consegue conferir contra o desenho.

---

## 9. Decoração

Três elementos, todos versionados localmente, todos servidos da própria origem. **Nenhum carrega
informação.**

| Elemento | Recurso | Onde |
| --- | --- | --- |
| Fundo ambiente | `Ambient Backdrop.png` (617 KB) | Área principal, todas as etapas |

**A opacidade do arquivo já está dentro do arquivo.** O PNG foi exportado do design com os 22% do nó
`eEqZf` **aplicados no canal alfa** — medido, não suposto: todo pixel tem `alpha = 56/255`. O CSS
declara `opacity: 1`; declarar 22% de novo conta a mesma atenuação duas vezes e entrega 4,8% de
textura, que é indistinguível de não ter fundo nenhum.

**A textura é ancorada na área principal, não na janela.** No arquivo ela é um retângulo dentro de
`Main` — 1144 × 832 em Destinos, 1144 × 359 em Configuração. Presa à janela, a parada mais clara do
degradê cai atrás da barra superior e o conteúdo começa já a meio caminho do esmaecimento.

**Nada pode pintar `--bg` opaco acima dela.** Ela é `position: absolute` com `z-index: -10`, isto é,
um contexto de empilhamento negativo — pintado **antes** dos fundos dos descendentes de bloco em
fluxo. O substrato vive no `body`, cujo fundo se propaga para a tela do documento e é pintado antes
dos contextos negativos. Uma casca que declarasse o próprio `bg-bg` apagaria a textura inteira sem
nenhum sinal de erro.

**O esmaecimento é um véu, não uma máscara** (`ambient-backdrop-veil`, nó `AB230`). Camada irmã da
textura, nunca filha — dentro do elemento atenuado o véu também ficaria transparente. As três
paradas são as do arquivo: 40% de `--bg` no topo, 80% a 35% da altura, opaco a 80%.

Os três fatos acima são invisíveis a qualquer verificação estrutural: o PNG carrega, tem o tamanho
certo, a classe certa e o tratamento por tema certo. `e2e/decor-loading.spec.ts` mede o **pixel
composto** nos dois temas, que é a única forma de a regressão aparecer.
| Fotografia de clima | `loja-de-discos-….jpg` (292 KB) | Painel lateral de Destinos |
| Adesivos | 11 PNGs (23 KB no total) | Coluna primária de Destinos, ao pé |

**Os adesivos compõem, não margeiam.** O arquivo de design os espalha por uma superfície de
680 × 210 (`Stickers Decor`, nó `wv9Cp`), com posição, largura e inclinação declaradas para cada um.
`stickers-band` carrega essa razão de aspecto e `Stickers.tsx` posiciona os onze em **fração da
grade** — é o que faz a composição sobreviver ao redimensionamento da coluna. Sem a razão de
aspecto a faixa teria altura zero (todos os filhos são absolutos) e as onze peças se empilhariam
numa linha; pendurá-los nas bordas com degraus de espaçamento, como até a 007, produz recortes
cortados nas duas beiradas em vez do desenho.

A faixa é travada em `--container-measure`: presa à razão de 680 × 210, ela cresce **em altura**
junto com a coluna, e numa janela de 1920 px a decoração passava de 350 px e virava o assunto da
tela.

A opacidade é declarada por tema — 55% no escuro, que é o valor do arquivo, e 80% no claro, pelo
mesmo motivo da tabela de contraste logo abaixo: 55% sobre o papel apagaria justamente a arte que
já parte de 1,40:1.

### Peso sem teto, proteção comportamental

A primeira visita transfere ~930 KB de decoração. **Não há teto de peso**, por decisão explícita
registrada no plano. A contrapartida é obrigatória:

- fora do caminho crítico de renderização;
- carregamento diferido e decodificação assíncrona;
- espaço pré-dimensionado — nada se desloca quando o recurso chega;
- sem imagem alguma, a tela permanece plenamente utilizável e sem buraco.

Os portões são `e2e/decor-loading.spec.ts` e `e2e/no-remote-origin.spec.ts`.

### Tratamento por tema é obrigatório

**Um único tratamento para os dois substratos é erro, não simplificação.** As artes foram
compostas contra um quase-preto, e a medição de T074 quantifica o que isso significa:

| Arte | Sobre `--bg` claro | Sobre `--bg` escuro |
| --- | --- | --- |
| `Vinyl 2.png` | **1,40** | 12,62 |
| demais adesivos | 1,67 – 2,80 | 6,31 – 10,57 |
| `Logo Mark.png` | 1,88 | 9,42 |

**Todas as doze artes perdem entre 4× e 9× de contraste no tema claro.** `Vinyl 2` cruza o limiar
em que a silhueta deixa de ser perceptível e recebe variante própria (`sticker-faint`); as demais
usam o tratamento genérico.

**O fundo ambiente é a exceção que ilustra o risco pelo outro lado.** Ele levava `mix-blend-mode:
multiply` no tema Papel, escrito para "escurecer o papel em vez de depositar cinza sobre ele" — regra
correta para uma textura escura, e a textura é o oposto: neon rosa, branco e verde-água. `multiply`
de branco sobre off-white é a **identidade**, e no tema claro a decoração simplesmente não existia.
Em `normal` a mesma arte tinge o papel de rosa e verde. O efeito continua mais discreto que no
escuro, e isso é aritmética: arte clara sobre papel claro tem menos para onde deslocar a cor.

**Nenhum teste automatizado pega isto.** `src`, `alt` vazio, tamanho e carregamento diferido estão
corretos nos doze casos. É o item de maior risco da conferência manual.

---

## 10. Interação e acessibilidade

### Foco

`outline` de 2px em `--accent-text`, com `outline-offset: 2px`. **Nunca `box-shadow`** — o modo de
cores forçadas descarta sombra e preserva contorno, e um foco feito de sombra desaparece
exatamente para quem mais depende dele.

### Ordem de tabulação

Barra superior → trilha → conteúdo → barra de ações. Igual à ordem visual, garantida pela ordem no
DOM. Nenhum `tabindex` positivo em lugar nenhum.

O link "Ir para o conteúdo" vem antes de tudo e aponta para o `<main>` da área principal. Ele
importa mais na 007 do que importava antes: há mais controles a pular.

### Estado nunca depende só de cor

Todo estado carrega pelo menos dois canais entre tinta, forma, ícone e palavra. É por isso que a
etapa pendente da trilha é um disco **vazado**, e não uma tinta mais fraca.

### Cores forçadas

As três zonas ganham contorno próprio sob `@media (forced-colors: active)`. Neste modo o navegador
descarta `background-color`, e o degrau de luminosidade que separa `--bg` de `--surface-zone`
desaparece — as três zonas viram uma superfície só, e a estrutura fica ilegível justamente para
quem mais depende de estrutura.

### Movimento

Até a 008 este parágrafo dizia que o sistema "quase não tem movimento" e que "o resto é
instantâneo". **A 009 tornou isso falso**, e o guia descreve o código: a fase de criação de
playlist é a primeira superfície com movimento contínuo.

O que permanece: conector da trilha e transição de estado dos degraus em **200ms**, e o resto
instantâneo.

O que entrou, e é **exatamente três** (009/FR-010b):

| Movimento | Onde | Propriedade | Duração |
| --- | --- | --- | --- |
| Giro do glifo de carregamento | Disco do cartão de criação | `transform: rotate` | 1s por volta, linear, infinito |
| Pulsação das barras de esqueleto | As oito barras da grade | `opacity`, nunca até zero | 1,2s de ida e volta, em fase única |
| Fusão cruzada esqueleto → resultado | A célula que os dois dividem | `opacity` | **200ms**, o mesmo orçamento do conector |

**Só `transform` e `opacity`.** Nenhuma outra propriedade é admitida, e o motivo é concreto e não
higiene abstrata: a tela anima continuamente **enquanto uma requisição está em voo**. Movimento que
forçasse recálculo de layout a cada quadro competiria com o próprio trabalho que a tela está
esperando — e o pior caso é o YouTube, cujo lote é de um item e faz uma requisição por faixa.

**As três são escritas em JavaScript, com biblioteca.** É uma exceção à simplicidade proporcional,
registrada no Complexity Tracking de `specs/009-creating-loading-state/plan.md`: as três animações
são escrevíveis em CSS puro, e essa alternativa é tecnicamente superior. A escolha da ferramenta foi
do autor do projeto, não da implementação. A mitigação é a fechadura — `src/ui/motion/` é o
**único** diretório autorizado a importar a biblioteca, exporta exatamente três primitivas, e duas
verificações independentes falham no dia em que a quarta tentar entrar: a regra de lint
`tp/no-motion-library-import` e `tests/unit/motion-surface.spec.ts`.

**Sob `prefers-reduced-motion`, o interruptor é JavaScript — e a regra de CSS não substitui.**
A regra global abaixo zera `animation-duration` e `transition-duration` com `!important`, e ela
**não alcança** a biblioteca: esta anima por WAAPI e por atualização de valor, não por `@keyframes`
que o CSS possa encurtar. Confiar nela entregaria uma tela que gira e pulsa exatamente para quem
pediu que não girasse. `<MotionConfig reducedMotion="user">` também não bastaria — a documentação da
biblioteca é explícita em que essa opção **preserva** a animação de `opacity`, que é justamente o
que a pulsação do esqueleto faz. Cada uma das três primitivas consulta `useReducedMotion()` e
devolve o estado final estático.

Nenhum texto se perde com a supressão: o estado "criação em curso" está escrito em três lugares e
não depende de movimento em nenhum. `tests/components/creating-card.spec.tsx` mede isso
literalmente — a contagem de textos exibidos é idêntica com e sem a preferência.

O que **não** anima, e a ausência é o que mantém o sistema legível: nenhuma animação de posição ou
de dimensão (`layout`, `layoutId`, `height`, `width`, `top`, `left`); nenhuma entrada ou saída
animada do cartão, que aparece e some em um quadro; e nenhuma animação nas demais fases do ciclo —
conexão, estimativa, busca e revisão ficam como estavam.

A regra global de `prefers-reduced-motion` cobre também a decoração, sem que cada componente repita
a consulta.

### Dois temas, sempre

Toda superfície nova nasce verificada nos dois. `tests/unit/contrast.spec.ts` falha por par
reprovado **ou ausente**, e também quando um token existe em apenas um tema.

A árvore de zonas e componentes é **idêntica** entre os temas; a única divergência autorizada é
cromática.

### Tela estreita

De 320px a 1920px, nenhuma rolagem horizontal. A casca colapsa em 64rem. A 200% de zoom de texto
as três zonas continuam legíveis e nenhuma corta conteúdo — é por isso que a barra superior usa
`min-height` e não `height`.

---

## 11. Decisões da 005 que este sistema substitui

**Registradas com o motivo, não apagadas.** Uma decisão revertida sem explicação vira folclore, e
alguém a reintroduz achando que está corrigindo um esquecimento.

### 11.1 A goteira numerada

**O que era**: uma coluna reservada de 2,5rem à esquerda, em todas as telas, carregando o numeral
da linha. A 005 a chamava de "a assinatura" e escrevia que ela era "o elemento único desta
interface".

**Por que sai**: o arquivo de design oficial não a tem, e FR-001 diz que ele vence. Mas o motivo
mais forte é que **a trilha faz melhor o que a goteira fazia**. A tese da goteira era "a borda
esquerda do conteúdo fica na mesma posição em todo o fluxo, e é o que faz cinco telas parecerem
cinco páginas do mesmo documento". A trilha entrega a mesma continuidade e ainda **diz onde você
está** — a goteira parecia consistente, a trilha informa.

**O que sobrevive**: o numeral. Ele continua sendo o número da linha que a pessoa colou, continua
nascendo na entrada e sobrevivendo à busca, à edição e à falha parcial. O que mudou é que ele
deixou de ter coluna própria. `lineNumeral()` em `src/domain/run/numeral.ts` continua sendo a
origem única, e `data-numeral` continua garantindo o alinhamento tabular.

### 11.2 A coluna única de 46rem

**O que era**: uma coluna centralizada, com a largura da linha de texto confortável.

**Por que muda para 42,5rem**: ela deixou de ser a tela inteira. Agora divide a largura com a
trilha (18,5rem) e, em Destinos, com o painel lateral. Encolher a medida foi a alternativa a
encolher a trilha, e a trilha carrega estado.

### 11.3 O indicador horizontal de etapas

**O que era**: `StepIndicator` — uma régua de progresso `aria-hidden` mais uma lista horizontal com
`aria-current="step"` e contagem "N de T" para leitor de tela.

**Por que sai**: era uma faixa fina que competia por atenção com a goteira e perdia. A 005 a
rebaixou de propósito — "dois elementos memoráveis é o mesmo que nenhum".

**O que sobrevive**: os três comportamentos acessíveis, integralmente. A régua virou o conector
vertical entre discos, também `aria-hidden`; a contagem virou o `ordinal` do domínio; o
`aria-current="step"` permanece literal, e continua aparecendo **uma única vez** por etapa.

### 11.4 O raio de cartão fechado em 8px

**O que era**: a 005 fechou o raio de cartão de 12px para 8px com uma tese explícita — "cantos
generosos são o registro visual do painel de SaaS genérico, e a tese do desenho é documento, não
painel".

**Por que reverte**: o arquivo de design oficial reabre para 12px, e FR-001 diz que ele vence. A
tese da 005 não estava errada; ela foi **substituída por uma decisão de outra autoridade**. Fica
registrada porque é um argumento bom, e quem quiser reabri-lo precisa saber que ele já foi feito.

### 11.5 `--text-item` como degrau próprio

**O que era**: um sétimo degrau tipográfico, 0,9375rem, para o nome de faixa na conciliação.

**Por que sai**: media exatamente o mesmo que `--text-body` e divergia só em entrelinha e peso —
distinção que o componente declara melhor do que a escala. Foi fundido em `--text-body`.

O **piso de legibilidade** que ele protegia continua valendo: nenhum texto com conteúdo desce
abaixo de `--text-meta`, e a tela mais densa do aplicativo não é onde a legibilidade sai barata.

### 11.6 `SessionHeader` como lista de contas

**O que era**: uma `<ul>` no cabeçalho listando "destinos selecionados com credencial salva".

**Por que sai**: o chip de conexão cobre tudo que ele mostrava e mais — o estado `no-credential`,
que ele simplesmente não exibia. Manter os dois significaria a mesma informação em dois lugares,
com estados que podem divergir.

**O que sobrevive**: o defeito que a 004 fechou continua fechado. Nenhum estado é beco sem saída, e
"Desconectar" permanece — o arquivo de design não a desenha, mas silêncio do design não é remoção,
e sem ela quem quer trocar de conta fica sem caminho.

---

## 12. Analogias adotadas

O arquivo de design não desenha todas as superfícies que a aplicação tem. **Silêncio do design não
é remoção**: a superfície permanece e recebe vocabulário por analogia com a coisa mais próxima que
o design define.

| Superfície | Analogia | Justificativa |
| --- | --- | --- |
| `Dialog` | O **painel** — cartão de destino e painel lateral | É a superfície mais alta da pilha; daí `--radius-panel` (16px), contorno `--rule-strong` e largura `--container-panel` |
| Selo "incerta" | O selo de correspondência confiante | Mesma família visual do `gem`; a distinção entre os três estados é por forma, tinta e rótulo. Ícone: `LuTriangleAlert` |
| Selo "não encontrada" | Idem | Ícone: `LuSearchX` — entre os candidatos de ausência, o único que diz **a busca não encontrou** em vez de **proibido** ou **removido**. O estado é ausência de resultado, não erro do usuário |
| `VersionHintBadge` | O selo de correspondência | Anatomia completa: fundo tingido, contorno, ícone `uncertain` e rótulo. Nunca preenchimento sólido |
| `RateLimitWaiting` | A **caixa de dica** | Cartão baixo, fundo tingido, contorno na cor do estado. Tinta de "incerta" e não de erro: uma pausa por limite de taxa é o serviço pedindo calma, não uma falha, e pintá-la de vermelho ensinaria o usuário a temer o normal |
| `ReauthDialog` | O `Dialog` | Herda a analogia de painel |
| `DraftRecoveryBanner` | Cartão com `guide-edge` | Barra âmbar de 3px à esquerda: preenchimento é o único uso autorizado do âmbar cheio, e a barra migra a informação de fundo tingido para estrutura |

---

## 13. Os portões que sustentam este documento

Este guia descreve; os testes obrigam.

| Portão | O que garante |
| --- | --- |
| `tests/unit/contrast.spec.ts` | Os 27 pares nos dois temas; token ausente em um tema é erro |
| `tests/unit/no-orphan-tokens.spec.ts` | Nenhum utilitário de token removido sobrevive em `src/` |
| `tests/unit/icon-roles.spec.ts` | Todo papel resolve; nenhuma importação da biblioteca fora do mapa |
| `tests/unit/rail-composition.spec.ts` | A trilha nunca afirma uma escolha que não aconteceu |
| `tests/components/shell.spec.tsx` | As três zonas, nos dois temas e nas duas larguras |
| `tests/components/action-bar.spec.tsx` | O motivo do bloqueio é dito por escrito |
| `tests/a11y/steps.spec.tsx` | axe em todas as etapas, nos dois temas e nas duas larguras |
| `e2e/decor-loading.spec.ts` | Conteúdo operável antes da decoração; nada se desloca |
| `e2e/no-remote-origin.spec.ts` | Nenhuma requisição a terceiro, inclusive decorativa |
| `e2e/narrow-viewport.spec.ts` | De 320px a 1920px, sem rolagem horizontal |
| `e2e/keyboard.spec.ts` | Ordem de tabulação pelas três zonas; foco visível |
| `tp/no-raw-visual-values` | Valor visual avulso no componente |
| `tp/no-icon-library-import` | Importação de ícone fora do mapa |
| `tp/no-dynamic-classname` | Classe montada em tempo de execução |

**O modo de falha que todos eles existem para pegar é o mesmo**: no Tailwind, utilitário
inexistente **não é erro**. A classe simplesmente não emite CSS, o build passa, o `typecheck`
passa, e a tela fica sem estilo até alguém abri-la.

---

## 14. Fronteira que este guia não atravessa

**Ele não descreve o que a aplicação faz.** Fluxo, regras de correspondência, cota, fila de
serviços e persistência vivem nas specs de cada feature e nos contratos delas.

**Ele não substitui a conferência manual.** As asserções estruturais não pegam desalinhamento de
2px, peso tipográfico errado nem adesivo invisível sobre o tema claro. A lista de conferência tela
a tela é versionada em
`specs/007-official-design-alignment/checklists/design-fidelity.md`.

**Ele não decide texto.** Todo rótulo vive em `src/i18n/pt-BR.ts`, e a revisão de copy do fluxo
continua sendo uma feature própria que ninguém abriu.
