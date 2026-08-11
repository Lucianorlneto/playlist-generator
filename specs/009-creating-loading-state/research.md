# Fase 0 — Pesquisa e decisões

**Feature**: 009 · Estado de carregamento da criação de playlist ·
[spec.md](./spec.md)

A spec chegou com cinco esclarecimentos já registrados. O que sobrou de aberto não era
"o que a tela mostra" — isso o arquivo de design decide — e sim **como cada exigência
vira código verificável dentro das fechaduras que este projeto já tem**: a escala finita,
a lista fechada de pares de contraste, a proibição de valor visual cru, a proibição de
ramificar por provedor e a exigência de que todo invariante tenha teste.

Onze decisões. Cada uma nomeia a alternativa recusada, porque decisão sem alternativa
registrada vira folclore e alguém a reverte achando que corrige um esquecimento.

---

## R1 — A geometria do arquivo, lida nó a nó

**Decisão**: os valores abaixo são a fonte de verdade da composição. Foram lidos de
`playlist-importer.pen` pela ferramenta que o edita (MCP `pencil`), com
`resolveVariables`, e não de captura de tela.

`qBqxK — Service Result · Loading`, 480 de largura, pilha vertical com respiro 16:

| Nó | Tipo | Geometria e tinta do arquivo |
| --- | --- | --- |
| `Y5hpLw` Card Header | linha, respiro 7 | ícone 13 em `#1DB954`; texto 12,5/600 em `#8A94A6` |
| `RIMcK` Spinner Row | linha, respiro 14 | — |
| `oENUo` Spinner Box | 44 × 44, raio 999 | `#F5B3011A` — âmbar a **10,2%** sobre `#161C25` |
| `ee41i` Spinner Icon | 22 × 22 | `#F5B301` = `--accent` cheio |
| `sp1sM` Load Text | coluna, respiro 3 | — |
| `gT44B` Load Title | texto 18/800 | `#E9EEF5` = `--ink` |
| `FeEHR` Load Sub | texto 12,5/500 | `#8A94A6` = `--ink-muted` |
| `G37LNR` Load Desc | texto 12,5/500, largura cheia | `#8A94A6` |
| `SxRFw` Skeleton Grid | coluna, respiro 14 | duas linhas de dois, respiro 24 entre colunas |
| `mHVO0` … Skeleton Stat | coluna, respiro 6 | quatro blocos idênticos |
| `V4140k` … Skeleton Label | 110 × 11, raio 4 | `#252D3A` opaco |
| `xldXN` … Skeleton Value | 150 × 17, raio 5 | `#FFFFFF14` — branco a **7,8%** sobre `#161C25` |
| `mJCdf` Load Footnote | texto 12/500 | `#5B6474` — a terceira tinta, recusada pelo FR-020 |

E o cartão irmão, `yTOJb — Success Card` em `C13Hj`, para o qual esta tela cede o lugar:
cabeçalho idêntico (`EvlNu`), título 22/800 **sem disco**, e `y5BYM Stats Grid` com duas
linhas de dois e os mesmos respiros 16 / 24.

**Por que isso é decisão e não coleta**: a comparação entre os dois cartões é o que
revela que o arquivo **não** preserva a posição do título entre os dois momentos — o de
carregamento tem 18px ao lado de um disco de 44, o de sucesso tem 22px sozinho. O SC-004
exige que preserve. R3 resolve.

**Alternativa recusada**: transcrever os valores por inspeção visual. Foi exatamente o
método que a 007 usou e que a 008 existiu para consertar.

---

## R2 — Os dois valores medidos que decidem a camada de tokens

**Decisão**: as duas tintas novas não podem ser derivadas por analogia; foram calculadas.

**A barra de esqueleto contra o substrato do cartão.** `#252D3A` sobre `#161C25` dá
**1,24:1**. Isso está muito abaixo de 3:1, o mínimo da categoria `ui` da lista de pares
aprovados. E está certo que esteja: a barra não carrega informação nenhuma, e uma barra
de esqueleto a 3:1 lê como conteúdo — o usuário tenta lê-la.

Consequência: **o token de esqueleto não pode entrar em `APPROVED_PAIRS`.** Declará-lo
como par `ui` reprovaria; declará-lo como par e afrouxar o mínimo destruiria o portão
para todo mundo.

**O precedente existe e é literal**: `--rule` está em `COLOR_TOKENS` e em nenhum par
aprovado, porque `#252d3a` sobre `--bg` dá 1,37:1 e ele é filete decorativo. O
comentário de `approvedPairs.ts` já diz que um token pode existir sem par aprovado e
ainda assim precisar existir nos dois temas.

**O que substitui o par**: uma **faixa de perceptibilidade**, que é a forma executável do
FR-008a. O token de esqueleto contra `--surface` precisa cair em `[1,15 ; 1,60]` nos dois
temas — piso para "é visto", teto para "não é lido como conteúdo". Os valores propostos
caem dentro: escuro `#252d3a` → 1,24:1; claro `#e7e0d2` → 1,31:1 (o cálculo é do próprio
portão, não deste documento; ver `contracts/tokens.md` §3).

**O substrato do disco.** O arquivo usa âmbar a 10,2% sobre `#161C25`. O sistema já tem a
receita de tingimento — `color-mix` da cor com a superfície, na proporção
`--state-tint-amount` (12% no claro, 15% no escuro) — e a Assumption da spec manda
reaproveitá-la. Mas `--accent-tint` **já existe e mistura sobre `--surface-zone`**, porque
nasceu no disco da trilha. Sobre o cartão isso entrega, no tema claro, um disco bege
(`#f1ece0` de base) num cartão branco.

Logo: token derivado novo, `--accent-tint-surface`, mesma receita, substrato `--surface`.
Ele **é** par aprovado — o glifo âmbar fica inteiramente sobre ele, que é precisamente o
caso em que a intuição erra (008/research §R4). Medido: claro `#816001` sobre `#fef6e0`;
escuro `#f5b301` sobre `#373320` ≈ 7:1. Passa como `ui` com folga nos dois.

**Alternativas recusadas**:

- **Reaproveitar `--rule` para o esqueleto** — recusada pela própria spec (FR-019a). Um
  token de filete pintando superfície abriria precedente na camada mais rígida do sistema,
  e o fato de o arquivo usar por acaso o mesmo hex do `--rule` escuro é coincidência de
  paleta, não parentesco de papel.
- **Duas tintas para as duas barras**, como o arquivo aparenta ter — recusada na spec com
  medição: `#252D3A` opaco e branco a 8% sobre `#161C25` resolvem em 1,02:1 entre si. Não
  são dois tons; o que separa rótulo de valor é dimensão.
- **Reaproveitar `--accent-tint`** para o disco — recusada acima, pelo substrato errado.
- **Afrouxar `CONTRAST_MINIMUM` ou criar uma categoria `decorative`** com mínimo 1:1 —
  recusada: uma categoria cujo mínimo é 1:1 aprova qualquer coisa, inclusive um token
  invisível. A faixa com **teto** verifica algo que nenhuma categoria de contraste
  verifica, que é "não parece conteúdo".

---

## R3 — Como o SC-004 deixa de ser aproximação

**Decisão**: o título do cartão em carregamento usa o **mesmo degrau tipográfico** do
título do cartão de resultado (`text-step`), e a linha do indicador alinha os itens pelo
centro. Com isso a posição vertical do título passa a ser **idêntica**, não aproximada.

A aritmética é o argumento inteiro:

- coluna de texto = título `text-step` (1,5rem × 1,2 = 28,8px) + respiro `0.5` (2px) +
  subtítulo `text-meta` (0,8125rem × 1,45 = 16,9px) = **47,7px**;
- disco = **48px** (`size-12`; ver R4);
- a coluna e o disco ficam a 0,3px um do outro, então a linha tem a altura de qualquer um
  dos dois e o topo do título coincide com o topo da linha.

E o topo da linha, no cartão em carregamento, é o mesmo ponto em que o `StepHeading` do
cartão de resultado começa: ambos são o segundo filho do cartão, depois do mesmo
cabeçalho e do mesmo respiro. **O deslocamento é zero, e é verificável por medição.**

**O que isso custa em fidelidade**: o arquivo escreve 18px aqui e 22px no cartão de
sucesso. Nenhum dos dois está na escala finita de seis degraus; o degrau que os dois
mapeiam é `text-step`. Adotar dois tamanhos diferentes exigiria um degrau novo na escala
para servir a uma tela só — e entregaria de brinde o salto de layout que o SC-004 proíbe.
A 007 já registrou a mesma decisão sobre o tamanho mais frequente do arquivo (12,5px):
o arquivo informa a intenção, a escala decide o valor.

**Alternativa recusada**: adotar 18px como valor em colchete e operacionalizar o SC-004
com tolerância de alguns pixels. Recusada duas vezes — `tp/no-raw-visual-values` recusa
o valor, e um critério de sucesso com tolerância negociável é um critério que não falha.

---

## R4 — Disco de 48px, barras na escala, raio `hair`

**Decisão**: toda medida do arquivo é mapeada para o degrau mais próximo da escala finita,
e nenhuma medida nova entra em escala nenhuma.

| Arquivo | Adotado | Utilitário |
| --- | --- | --- |
| disco 44 × 44 | 48 × 48 | `size-12` |
| glifo 22 | 24 (1em de `text-step`) | `icon-glyph` já resolve |
| respiro da linha 14 | 12 | `gap-3` |
| respiro título↔subtítulo 3 | 2 | `gap-0.5` |
| respiro da grade 14 / 24 | 8 | `gap-2`, o mesmo do `dl` do resultado |
| barra de rótulo 110 × 11 | 50% × 12 | `w-1/2 h-3` |
| barra de valor 150 × 17 | 66% × 16 | `w-2/3 h-4` |
| raio 4 e 5 | 2 | `rounded-hair` |

As larguras viram fração porque o que o FR-008 manda preservar é a **proporção** entre as
duas barras, e no arquivo os dois blocos preenchem a coluna (`fill_container`): 110 e 150
sobre uma coluna de ~228 são 48% e 66%. Fração preserva a relação em qualquer largura;
110px fixos não sobrevivem a 375px nem a 200% de zoom.

O raio 4/5 do arquivo não tem degrau: a escala vai de 2 (`hair`) a 8 (`control`). Em uma
barra de 12px de altura, 8px de raio é quase pílula. `hair` é a escolha.

**Alternativa recusada**: declarar `--loading-disc-size: 2.75rem` como medida estrutural,
no molde de `--rail-width` e `--topbar-height`. Aquelas três existem porque são as
dimensões que **definem as zonas da casca** e não pertencem a espaço de nome nenhum do
Tailwind. Um disco dentro de um cartão pertence à escala de espaçamento, e criar medida
estrutural para ele abriria a porta para a próxima e a seguinte.

---

## R5 — Onde a `motion` toca o código: um único ponto, com fechadura

**Decisão**: a biblioteca `motion` é importada em **um único diretório**,
`src/ui/motion/`, que exporta exatamente **três** componentes de movimento — um por
movimento autorizado pelo FR-010b. Nenhum outro arquivo de `src/` importa de `motion` ou
de `motion/react`.

A fechadura é a mesma dos ícones, e pelo mesmo motivo: uma regra de lint local nova,
`tp/no-motion-library-import`, com allowlist de diretório, mais uma asserção em
`tests/unit/` de que o diretório exporta três primitivas e não quatro. O FR-010b diz "o
movimento autorizado é exatamente três"; sem isso, essa frase é prosa.

O precedente é literal e está escrito em `src/ui/icons.ts`: `react-icons` entrou como
dependência por decisão registrada, e o que se comprou em troca foi **rastreabilidade** —
o custo de trocar o ícone de um papel é uma edição, não uma varredura.

**O que os três componentes NÃO fazem**: nenhum deles reexporta `motion` nem
`motion.div`. Um `export { motion }` devolveria a chave à fechadura — qualquer arquivo
poderia importar o objeto e animar o que quisesse, e o teste de "três primitivas"
continuaria passando.

**Alternativa recusada**: usar `motion/react` diretamente nos dois ou três componentes que
animam. Mais curto de escrever, e deixa a superfície aberta: a quarta animação entra sem
discussão, e o FR-010b vira uma intenção.

---

## R6 — Movimento reduzido: o interruptor é JavaScript, não CSS

**Decisão**: cada uma das três primitivas consulta `useReducedMotion()` de `motion/react`
e, quando ele devolve `true`, **não anima nada** — devolve o estado final, estático.

Isto não é zelo redundante. O projeto já tem uma regra global em `index.css` que zera
`animation-duration` e `transition-duration` sob `prefers-reduced-motion`, e essa regra
**não alcança a `motion`**: a biblioteca anima por WAAPI e por atualização de valor em
JavaScript, não por `@keyframes` que o CSS possa encurtar. Confiar na regra existente
entregaria uma tela que gira e pulsa exatamente para quem pediu que não girasse.

Também **não basta** `<MotionConfig reducedMotion="user">`. A documentação da própria
biblioteca é explícita: essa opção desativa animação de transformação e de layout **e
preserva** a animação de `opacity`. A pulsação do esqueleto é `opacity`, e o FR-016 manda
suprimi-la. O interruptor tem de ser explícito e por primitiva.

**Consequência para os testes**: `useReducedMotion` lê `matchMedia`, que o happy-dom não
oferece por padrão — o projeto já contorna isso com `vi.stubGlobal('matchMedia', …)` em
`tests/components/shell.spec.tsx` e em `tests/a11y/steps.spec.tsx`. O mesmo padrão serve
aqui. No Playwright a preferência é opção de contexto (`reducedMotion: 'reduce'`), o que
permite um projeto de teste dedicado sem duplicar a suíte.

**Alternativa recusada**: escrever as três animações em CSS puro, com `@keyframes`, e
herdar a supressão de graça da regra global. É **tecnicamente superior** e custa zero
byte de execução — está registrado como tal no Complexity Tracking do plano. Foi recusada
porque a escolha da ferramenta é do pedido, não da implementação.

---

## R7 — A fusão cruzada sem animação de layout

**Decisão**: a troca do esqueleto pelas quatro informações reais é feita com o bloco que
**sai** posicionado de forma absoluta sobre o que **entra**. Só `opacity` anima, em 200ms,
nos dois sentidos.

O ponto é o que isso evita. As duas alternativas óbvias falham:

- **Empilhar os dois na mesma célula de grade** faz a altura do contêiner ser a do maior
  dos dois durante os 200ms. O caminho efetivo da playlist quebra em duas linhas quando é
  longo, então a altura saltaria — e voltaria — dentro da transição.
- **`AnimatePresence mode="wait"`** espera a saída terminar antes de montar a entrada,
  produzindo 200ms de cartão vazio. É o salto de layout que o SC-004 existe para proibir,
  só que em duas etapas.

Com o bloco que sai fora do fluxo, a altura do contêiner é sempre a do conteúdo real, do
primeiro quadro ao último. E `opacity` não dispara recálculo de layout, que é o FR-017a.

**Consequência estrutural**: o `ResultScreen` precisa parar de retornar duas árvores
diferentes conforme `result` seja nulo ou não. O cartão, o cabeçalho e o título passam a
ser renderizados **uma vez**, e só o corpo troca — sem isso o React desmonta e remonta a
seção inteira e não há transição alguma a executar. Essa reorganização é o item de maior
risco da feature e está detalhada em `contracts/loading-card.md` §5.

---

## R8 — O rodapé, e por que ele é uma região viva só

**Decisão**: o rodapé é um único nó `role="status"` cujo texto é função do progresso:

- nenhum lote confirmado → "Aguardando confirmação do {serviço}…" (o texto do nó `mJCdf`);
- a partir do primeiro lote confirmado → a contagem em itens que a tela já dá hoje
  (`result.creationProgress`).

Um nó só, não dois. Duas regiões vivas que se revezam produzem dois anúncios na troca —
a saída de uma e a entrada da outra — e o FR-013 pede um.

**O que muda em relação a hoje**: hoje a contagem aparece assim que a criação começa,
mostrando "1 de N itens" antes de qualquer item ter sido confirmado. Passa a aparecer
**depois** do primeiro lote. Isso é o FR-011 e o FR-012 aplicados, e não uma perda: o
número que sumiu do primeiro instante era `committedItemCount + 1`, ou seja, uma
promessa, não uma confirmação.

**A verificação de que ninguém perdeu informação** é o SC-008: a suíte existente de
criação, cota, retomada e rede passa sem alteração de asserção. O levantamento feito na
Fase 0 encontrou **nenhuma** asserção sobre `result.creationProgress` em
`tests/` ou `e2e/` — a única citação do texto está no inventário de textos e no
instantâneo de i18n, os dois artefatos que esta feature atualiza de propósito.

---

## R9 — O aviso de espera na criação inicial, e o que é "contagem"

**Decisão**: `RateLimitWaiting` ganha uma segunda forma, escolhida por propriedade
(`variant: 'spinner' | 'countdown'`, padrão `'spinner'`):

- `'spinner'` — o que existe hoje, intocado. É o que a busca e a retomada usam.
- `'countdown'` — sem ícone algum, com os segundos que faltam ao lado do texto. É o que a
  criação usa, e é o FR-018a: o disco do cartão é o único elemento **em rotação** da tela.
  A pulsação do esqueleto continua — ela é textura que reserva espaço, não indicador de
  progresso, e congelá-la faria a grade pedir atenção justamente quando ela não tem nada a
  dizer (§2.2 do contrato de movimento).

"Contagem", no esclarecimento da spec, só pode ser a contagem regressiva: é o único
número que o estado de espera carrega (`WaitState.resumesAt`), e o aviso acabou de perder
a única coisa que comunicava duração, que era o giro do ícone.

**A contagem é `aria-hidden`.** Um número que muda a cada segundo dentro de um
`role="status"` é um anúncio por segundo. A região viva carrega a frase — anunciada uma
vez, na entrada — e a contagem é informação visual. É o FR-013a lido ao pé da letra: as
duas regiões vivas não podem dizer a mesma coisa, e uma delas não pode dizer nada
repetidamente.

**Onde o tempo mora**: a conversão de `resumesAt` em segundos restantes é função pura e
vai para `src/domain/retry/countdown.ts` — o Princípio III proíbe relógio ambiente no
domínio, então o `now` é **parâmetro**. O `setInterval` de um segundo vive no componente,
que é o lugar de I/O de tempo, e só existe enquanto o aviso está montado.

**Alternativa recusada**: mostrar a contagem também na busca, por simetria. Ampliaria a
feature para uma tela que ela não toca, e o SC-008 pede o contrário.

**Alternativa recusada**: manter o ícone parado em vez de removê-lo. Um ícone de
carregamento congelado lê como travamento.

---

## R10 — Nenhuma ramificação nova por provedor

**Decisão**: a linha do indicador, a grade de esqueleto e o rodapé não conhecem
`ProviderId`. Recebem o **nome do serviço já resolvido** — que é o que o `ResultScreen`
já faz hoje com `nameOf(provider)` — e nada mais.

O cabeçalho do cartão já ramifica, e já está resolvido do jeito certo: `PROVIDER_ICON` e
`BRAND_INK` são mapas de literais completos em `ResultScreen.tsx`, exigidos por
`tp/no-dynamic-classname`. Esta feature não acrescenta nenhum mapa desses, porque **nada
que ela introduz é colorido pela marca**: o disco é âmbar, as barras são neutras, os
textos são tinta principal e secundária.

O FR-023 fica, portanto, satisfeito por construção, e o portão é o de sempre —
`tests/unit/provider-registry.spec.ts` e a leitura do diff.

---

## R11 — O inventário de textos: uma reversão e quatro entradas

**Decisão**: o item hoje registrado como `mantido-diferente` para o nó `yjjDB/FeEHR` é
**revertido para `adotado`**, e o inventário ganha as demais frases da tela.

O motivo escrito naquele item diz, textualmente, que a aplicação exibe progresso real "no
lugar" das três frases de espera, e que substituir informação por tranquilização genérica
seria regressão. **Essa premissa deixa de valer nesta feature**: o progresso real não sai
de lugar nenhum — ele passa a viver no rodapé (R8) — e as três frases entram além dele,
não no lugar dele.

Quatro entradas, e uma divergência que permanece registrada:

| Nó | Texto do arquivo | Desfecho |
| --- | --- | --- |
| `yjjDB/FeEHR` | "Isso pode levar alguns segundos." | **adotado** (era `mantido-diferente`) |
| `yjjDB/G37LNR` | "Estamos enviando sua lista para o Spotify. Isso pode levar alguns segundos — não feche esta janela." | **mantido-diferente** — FR-006 |
| `yjjDB/mJCdf` | "Aguardando confirmação do Spotify…" | **adotado** |
| `yjjDB/gT44B` | "Criando playlist no Spotify…" | já está no inventário, inalterado |

A divergência do `G37LNR` é a única da feature e já está decidida na spec: a oração
repetida sai, porque um leitor de tela lê o subtítulo e a descrição em sequência e produz
a mesma frase duas vezes.

**E uma correção de cobertura**: `design-inventory-exclusions.json` exclui o ramo
`result.` inteiro por prefixo, com o motivo de que "o restante é o caminho de criação
interrompida e retomada, que o arquivo não desenha". As chaves novas do rodapé e da
descrição **são** desenhadas pelo arquivo, então o motivo passa a ser falso para elas. A
entrada de exclusão é reescrita para dizer o que continua fora, e as chaves novas entram
no inventário como itens próprios. Deixar o prefixo cobrindo-as calaria justamente o
portão que a 008 construiu.

---

## Resumo do que a Fase 0 fechou

| Aberto | Fechado por | Onde vira contrato |
| --- | --- | --- |
| Como o esqueleto passa pelo portão de contraste | R2 | `contracts/tokens.md` §3 |
| Qual token o disco usa | R2 | `contracts/tokens.md` §2 |
| Como o SC-004 vira medição sem tolerância | R3 | `contracts/loading-card.md` §3 |
| Que medidas do arquivo entram e como | R1, R4 | `contracts/loading-card.md` §2 |
| Onde a `motion` pode ser importada | R5 | `contracts/motion.md` §1 |
| Como o movimento reduzido é garantido | R6 | `contracts/motion.md` §4 |
| Como a fusão cruzada não move layout | R7 | `contracts/motion.md` §3 |
| Quantas regiões vivas, e o que cada uma diz | R8, R9 | `contracts/loading-card.md` §4 |
| O que "contagem" significa no FR-018a | R9 | `contracts/loading-card.md` §6 |
| Como os textos entram no inventário | R11 | `contracts/text-inventory.md` |

Nenhum `NEEDS CLARIFICATION` permanece.
