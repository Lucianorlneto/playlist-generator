# Research — Sistema de movimento do aplicativo

Fase 0 de `plan.md`. Cada seção é uma decisão com a razão e a alternativa descartada.
Referências à biblioteca vêm do codex do Motion consultado via MCP; referências ao design
vêm de `playlist-importer.pen` lido via MCP do Pencil.

---

## R1 — A CSP alcança o movimento?

**Pergunta**: o artefato de produção declara `style-src 'self'` (`vite.config.ts`). A
biblioteca de movimento escreve valores em `element.style` a cada quadro. Isso é bloqueado?

**Decisão**: **não é bloqueado**, e nenhuma providência é necessária.

**Apuração**: a restrição de estilo inline da CSP alcança **estilo que chega como texto** —
o atributo `style` presente no HTML servido e blocos `<style>`. Escrita programática via
CSSOM (`element.style.opacity = …`), que é o que a biblioteca e o próprio React fazem, não
passa pelo analisador de CSP. A prova está no próprio repositório e é anterior a esta
feature: `src/ui/Stickers.tsx` posiciona os onze adesivos com `style={{ left, top, width,
rotate }}` e funciona no `dist/`; e a feature 009 já embarca movimento em produção.

**Consequência colateral**: a justificativa que `src/features/review/SearchProgress.tsx`
registra — "uma largura em porcentagem simplesmente não seria aplicada" — **está errada**.
A escolha do `<progress>` nativo continua certa, mas por acessibilidade, que é a outra
razão que o mesmo comentário já dá. O FR-028 da spec foi corrigido para não apoiar a
decisão numa premissa falsa. Corrigir o comentário do arquivo é tarefa desta feature.

**Alternativa descartada**: afrouxar a CSP com `'unsafe-inline'`. Além de desnecessário,
seria emenda de fato a uma decisão de segurança registrada, e o Princípio II não admite
afrouxamento por conveniência.

---

## R2 — As linhas da revisão chegam em fluxo?

**Pergunta**: a spec original supunha que as correspondências apareciam progressivamente
durante a busca. É isso que o código faz?

**Decisão**: **não**. A entrada escalonada acontece num único momento, quando a busca
termina.

**Apuração**: em `src/features/service/ServiceStep.tsx`, a fase `search` chama
`runMatching` com `onProgress: (done) => reportSearchProgress(done)`. O `onProgress`
atualiza **apenas o contador**. Os itens só entram no estado quando a promessa resolve,
por `dispatchRun({ type: 'search_done', items })`. `ReviewScreen` renderiza nas fases
`search` **e** `review`, e durante `search` a lista está vazia — exceto numa execução
retomada, em que `mergeItems` traz os itens já obtidos antes.

**Três consequências, todas boas**:

1. A entrada escalonada roda quando **não há requisição em voo** para aquele serviço. Ela
   fica do lado permitido da fronteira do FR-010 sem precisar de exceção.
2. Nada de novo anima **durante** a busca. A tela continua com a barra nativa e a contagem.
3. O caso de teto de defasagem (FR-013) é real e agudo: cento e vinte linhas montam no
   mesmo quadro, não pingando.

**Consequência sobre a execução retomada**: linhas já em cena antes da busca começar não
podem animar quando a busca termina — elas não estão entrando. A entrada é por montagem de
nó, não por mudança de fase, e a identidade do nó é `item.line.id`, que já é a chave da
lista. Nenhum trabalho extra: o que remonta anima, o que permanece não.

---

## R3 — O que substitui "exatamente três"

**Decisão**: um **catálogo nomeado**, verificado por identidade. `tests/unit/motion-surface.spec.ts`
passa a ser `tests/unit/motion-catalog.spec.ts` e afirma:

- o conjunto exato de nomes exportados pelo barril;
- a origem exata de cada `export … from` do barril (nada da biblioteca);
- as propriedades proibidas em cada primitiva, com a exceção do `Settle` declarada por nome;
- que `Settle` é a **única** primitiva que anima posição, e que ela tem o portão de ociosidade.

**Razão**: a contagem "três" nunca foi a invariante — era um proxy barato para ela. A
invariante é "toda animação do produto tem nome, papel e revisão". Um catálogo verificado
por identidade falha exatamente onde a contagem falhava (movimento novo entrando calado) e
não falha onde a contagem falhava por engano (movimento novo entrando **com** revisão).

**Alternativa descartada**: manter a contagem e subi-la para seis. Ela voltaria a ser prosa
na próxima feature, e um número não diz qual movimento sumiu quando o teste quebra.

**A regra de lint permanece**, com a mensagem reescrita: ela é a metade que falha no editor,
e continua sendo a fechadura em volta da importação. O que ela protege deixa de ser a
contagem e passa a ser o ponto de entrada.

---

## R4 — Quantas primitivas novas, e quais

**Decisão**: **três**, levando o catálogo de três a seis.

| Nova | Papel | Anima | Atende |
| --- | --- | --- | --- |
| `StepTransition` | troca de etapa, com direção | `opacity` + `x` | US1 |
| `Stagger` | entrada escalonada com teto | `opacity` + `y` (lista) / `opacity` + `scale` (decoração) | US2, US4 |
| `Settle` | acomodação de posição em superfície ociosa | posição, via transformação | US2 (pós-descarte), US3 (fila) |

**O que não virou primitiva, e por quê**: a maior parte da US3 não precisa de JavaScript.

- **Chip de conexão**: a troca de estado é cor mais rótulo. Cor é `transition-colors`, que
  `Button` e `Toggle` já usam; a troca de rótulo é conteúdo substituindo conteúdo na mesma
  célula — que é literalmente o papel do `CrossFade` da 009.
- **Cartão de destino**: marcação é cor e contorno. `transition-colors`.
- **Disco da trilha**: o numeral vira glifo de conclusão — `CrossFade` outra vez; o
  preenchimento e o conector são cor, e o conector já transita hoje.

Reaproveitar `CrossFade` em três lugares novos é o teste mais forte de que ele foi nomeado
por papel e não por tela. Nenhum deles exige mudança no componente.

**Alternativa descartada**: uma primitiva `StateSwap` para a periferia. Seria `CrossFade`
com outro nome, e um catálogo com dois nomes para o mesmo movimento é pior do que um com
um nome só.

---

## R5 — A escala de movimento

**Decisão**: escala finita, com **origem única em TypeScript** e espelho verificado em CSS.

| Token | Valor | Papel |
| --- | --- | --- |
| `quick` | 120ms | microinteração de periferia — cor de chip, marcação de cartão, disco da trilha |
| `base` | **200ms** | o orçamento herdado: conector da trilha, fusão cruzada, troca de etapa |
| `settle` | 320ms | acomodação de posição, onde o olho precisa **seguir** o objeto |
| `spin` | 1000ms | ciclo do giro (009, inalterado) |
| `pulse` | 1200ms | ciclo da pulsação (009, inalterado) |
| `staggerStep` | 40ms | passo entre irmãos |
| `staggerCap` | 240ms | **teto absoluto** da defasagem acumulada |

Curvas: `standard` (`easeOut`, entradas e trocas), `through` (`easeInOut`, ciclos de ida e
volta), `linear` (giro). Três, e cada uma tem um papel que só ela atende.

**Por que TypeScript é a origem e o CSS é o espelho**: o movimento do catálogo roda em
JavaScript e precisa dos números como números. O CSS precisa deles como texto, para
`transition-colors` do `Button`, do `Toggle` e do conector da trilha. Ler o CSS de dentro
do componente — `getComputedStyle` — colocaria acesso ao DOM numa primitiva e quebraria em
`happy-dom`. Duplicar sem verificação é como as duas camadas divergem.

O espelho é `@theme` em `index.css`, incluindo `--default-transition-duration`, que passa a
ser `base` — hoje `transition-colors` herda os 150ms padrão do Tailwind, um valor que o
sistema nunca escolheu. `tests/unit/motion-scale.spec.ts` lê os dois arquivos e falha por
divergência, no mesmo molde de `tests/unit/no-secrets.spec.ts`, que confere uma tabela
contra o código.

**Alternativa descartada**: CSS como origem e JavaScript lendo variáveis. Custa uma leitura
de layout por montagem e não funciona sem navegador.

**Alternativa descartada**: `MotionConfig` com transição padrão na raiz. Exigiria exportar
um provedor da biblioteca pelo barril — mais superfície na fechadura — e cada primitiva já
declara a sua transição explicitamente. A 009 já havia descartado `MotionConfig` por outro
motivo (`reducedMotion="user"` preserva `opacity`); não vale reabrir a porta por conforto.

**A regra de lint nova**, `tp/no-raw-motion-values`, é o par de `tp/no-raw-visual-values`:
falha por literal numérico em `duration`, `delay` ou `ease` fora do módulo da escala, e por
classe utilitária `duration-*` / `ease-*` fora do conjunto que o `@theme` emite.

---

## R6 — A troca de etapa: direção, foco e altura

**Padrão do codex**: `AnimatePresence custom={direction}` com `usePresenceData()` lido pelo
nó que sai — é o mecanismo que existe justamente porque o nó que sai precisa da direção que
valia quando ele saiu, e uma prop mudaria embaixo dele (exemplo `use-presence-data`,
MotionScore A).

**Decisão sobre o modo**: **não** usar `mode="wait"` nem `mode="popLayout"`.

- `mode="wait"` monta o novo só depois que o antigo sai. `StepHeading` foca no `useEffect`
  disparado por `focusToken`; com `wait`, o foco chegaria 200ms depois — violação direta do
  FR-016 e do SC-008, e a mesma falha que a 009 já havia recusado no cartão de criação.
- `mode="popLayout"` tira o nó que sai do fluxo automaticamente, que é o comportamento
  desejado, mas exige que o filho encaminhe `ref` até o nó do DOM.

**Decisão**: repetir o arranjo que `CrossFade` já usa e que já está justificado em
`009/research §R7` — o nó que **sai** vai para `position: absolute` num envoltório nosso, e
o que **entra** fica no fluxo e define a altura. O envoltório é nosso, então nenhuma
`ref` precisa atravessar as telas de etapa, e o projeto passa a ter **um** mecanismo de
saída fora de fluxo em vez de dois.

**Altura (FR-023)**: a altura do contêiner passa a ser a da etapa que entra já no primeiro
quadro. Isso não é regressão — é exatamente o que acontece hoje, e animar altura é proibido
pelo FR-009. O que o FR-023 proíbe é salto **causado pela transição**: ir à altura do
maior, ou a zero, e voltar. Nenhum dos dois ocorre neste arranjo.

**A árvore que sai precisa sumir para o teclado e para o leitor de tela.** Por 200ms
existem dois cabeçalhos de etapa, dois conjuntos de controles e potencialmente dois
`aria-current`. O envoltório de saída MUST receber `inert` e `aria-hidden`. `inert` é
atributo do navegador e prop do React 19; a asserção de teste é sobre o atributo, o que
funciona em `happy-dom`.

**A direção é derivação pura**: a ordem canônica é `WIZARD_STEPS` em `src/domain/types.ts`.
`stepDirection(from, to)` entra em `src/domain/` como função determinística, testável sem
DOM (Princípio III). Guardar a etapa anterior é orquestração e fica no `Wizard`, num `ref` —
sem estado novo no store e sem tocar `draftPersistence`.

**Efeito colateral verificado**: manter a etapa que sai montada por 200ms não dispara
trabalho. O único `useEffect` com efeito de negócio nas telas é o de `ServiceStep`, que é
guardado por `startedFor.current === key` — ele não remonta, e a chave não muda por causa da
transição.

---

## R7 — Escalonamento com teto

**Decisão**: a defasagem do irmão `i` é `min(i × staggerStep, staggerCap)`.

O `stagger()` da biblioteca distribui proporcionalmente e **não tem teto**: com 120 linhas a
40ms, a última esperaria 4,8s. `delayChildren` aceita uma função de índice, então a fórmula
com teto entra ali sem sair do idioma da biblioteca.

**Consequência assumida e desejada**: acima de seis irmãos o escalonamento vira um
*bloco* — as linhas depois da sexta entram juntas. É o comportamento certo: o papel do
escalonamento é dar sequência à leitura das primeiras, não fazer o usuário esperar a
centésima vigésima.

O SC-009 mede exatamente isso — a defasagem da última de 120 é igual à da última de 8.

**Alternativa descartada**: comprimir o passo conforme a lista cresce
(`cap / total` por irmão). Com listas grandes o passo fica imperceptível e o efeito some;
com listas pequenas fica lento. O teto entrega os dois extremos certos.

---

## R8 — Animação de posição só em superfície ociosa

**Decisão**: `Settle` exige uma prop `idle: boolean` e, quando `false`, devolve os filhos
**sem** animação de posição.

Isto é o que torna o FR-010a verificável em vez de convencional. Uma allowlist de arquivos
diria onde `Settle` pode aparecer, mas não diria se ele está ligado no momento errado; o
portão declarado por quem chama diz.

Quem chama passa um valor derivado do estado real: a fila usa "nenhuma execução em curso",
a lista de revisão usa `search.running === false`.

`layout` da biblioteca anima por transformação, mas **mede** o layout a cada mudança. É essa
medição, e não a animação, que o FR-011 protege — o pior caso continua sendo o YouTube, um
item por lote e uma requisição por faixa.

---

## R9 — Movimento reduzido

**Sem novidade de método, por decisão.** Cada primitiva nova consulta `useReducedMotion()` e
devolve o estado final estático, exatamente como as três da 009. As razões pelas quais nem a
regra global de CSS nem `MotionConfig reducedMotion="user"` bastam estão em
`009/contracts/motion.md` §5 e continuam válidas palavra por palavra.

O que muda é a **cobertura**: o projeto Playwright `reduced-motion` já existe em
`playwright.config.ts` e passa a exercitar o fluxo inteiro, não só o cartão de criação.

---

## R10 — Onde o design pede movimento, e onde ele não pede

O arquivo `.pen` **não anota movimento em lugar nenhum**. Ele é a evidência de quais
superfícies mudam de estado, e o inventário de dez está na spec. Três notas de apuração:

- **`Stickers Decor` (`wv9Cp`)** é uma superfície de 680 × 210 com onze grupos, cada um com
  rotação própria de −10° a +15°. `src/ui/Stickers.tsx` já transcreve a tabela inteira,
  posição a posição, e a inclinação já é **geometria estática**, não movimento. A entrada
  escalonada acrescenta `opacity` e `scale` por cima da inclinação que já está lá.
- **`Progress Track`** é a barra nativa. Ver R1: a razão de não animá-la é acessibilidade.
- **`Ambient Backdrop` + `Backdrop Fade`** são substrato fixo. Movê-los foi recusado na
  clarificação de escopo, e a recusa é o que preserva o significado do movimento contínuo.

---

## R11 — O que não é emenda constitucional

A fechadura de movimento é contrato de feature (`009/contracts/motion.md`), não princípio.
A única lista que a constituição declara como emendável apenas por emenda é a de **hosts**
do Princípio II, e esta feature não a toca.

O que **é** exceção registrável está no Complexity Tracking do plano: o alcance da
biblioteca cresce, e a exceção à simplicidade proporcional da 009 se amplia junto.
