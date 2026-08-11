# Contrato — Movimento

Definição normativa de FR-010a, FR-010b, FR-014 a FR-017a e dos SC-003 e SC-011.

Esta é a primeira feature do produto com movimento contínuo. O guia de estilo descreve
hoje um sistema "quase sem movimento": conector da trilha e transição de estado dos
degraus em 200ms, e o resto instantâneo. Este contrato é o que amplia essa descrição sem
abrir a porta para a próxima animação e a seguinte.

---

## 1. Um único ponto de importação, com fechadura

**`src/ui/motion/` é o único diretório de `src/` autorizado a importar de `motion` ou
`motion/react`.** Ele exporta **exatamente três** componentes, um por movimento
autorizado:

| Componente | Movimento | Propriedade animada |
| --- | --- | --- |
| `SpinningDisc` | giro contínuo do glifo do disco | `transform: rotate` |
| `PulsingBar` | pulsação contínua das barras | `opacity` |
| `CrossFade` | fusão cruzada esqueleto → resultado | `opacity` |

**Nenhum deles reexporta `motion` nem `motion.div`.** Um `export { motion }` devolveria a
chave à fechadura: qualquer arquivo passaria a poder animar o que quisesse, e a contagem
de três continuaria passando.

### Por que a fechadura existe

O precedente é literal e está em `src/ui/icons.ts`: uma biblioteca entrou por decisão
registrada, e o que se comprou em troca foi rastreabilidade — trocar o ícone de um papel
custa uma edição, não uma varredura. O FR-010b diz que o movimento autorizado é
"exatamente três"; sem fechadura, essa frase é prosa.

### Verificação

Duas, redundantes de propósito:

1. **`tp/no-motion-library-import`** — regra de lint local nova, no molde exato de
   `tp/no-icon-library-import`, com allowlist de diretório. Falha no editor, enquanto
   ainda custa uma tecla consertar.
2. **`tests/unit/motion-surface.spec.ts`** — varre `src/`, exige que nenhum arquivo fora
   de `src/ui/motion/` cite `from 'motion` e que o diretório exporte exatamente três
   primitivas. Alcança também o `.css`, que o ESLint não lê, e sobrevive a uma supressão
   de lint.

---

## 2. Os três movimentos, um a um

### 2.1 Giro do disco (FR-014)

| | |
| --- | --- |
| Alvo | o **glifo**, não o disco — o substrato tingido é circular e girá-lo não produziria movimento visível |
| Propriedade | `rotate`, que compila para `transform` |
| Ciclo | rotação completa, repetição infinita, temporização linear |
| Duração | ~1s por volta, na cadência do `animate-spin` que `RateLimitWaiting` já usa na busca — o produto não deve ter duas velocidades de giro |
| Semântica | decorativo; o disco é `aria-hidden` e o glifo é `<Icon>` sem `label` |

### 2.2 Pulsação das barras (FR-015)

| | |
| --- | --- |
| Alvo | as oito barras da grade |
| Propriedade | `opacity`, ida e volta entre dois valores, repetição infinita |
| Faixa | a barra nunca chega a zero: o esqueleto existe para ocupar espaço visível, e uma barra que some periodicamente pisca o cartão |
| Fase | **as oito pulsam juntas**, sem defasagem por barra |
| Semântica | a grade inteira é `aria-hidden` |

A fase única é decisão, não simplificação: oito barras defasadas produzem uma onda que
puxa o olho para a grade — exatamente o oposto do papel dela, que é reservar espaço sem
pedir atenção.

### 2.3 Fusão cruzada (FR-010a)

| | |
| --- | --- |
| Alvo | a grade de esqueleto que sai e o `<dl>` de informações reais que entra |
| Propriedade | `opacity`, uma única vez |
| Duração | **200ms**, o mesmo orçamento que o guia de estilo já fixa para o conector da trilha |
| Layout | o bloco que **sai** fica fora do fluxo (`position: absolute`); o que entra define a altura |

**Por que o que sai fica fora do fluxo** (research §R7): empilhar os dois na mesma célula
de grade faria a altura ser a do maior durante 200ms — e o caminho efetivo da playlist
quebra em duas linhas quando é longo, então a altura saltaria e voltaria dentro da
transição. `AnimatePresence mode="wait"` produziria 200ms de cartão vazio, que é o mesmo
salto em duas etapas.

---

## 3. O que esta feature **não** anima (FR-010b)

Proibições explícitas, porque a ausência delas é o que mantém o sistema legível:

- **Nenhuma animação de posição ou de dimensão.** Nada de `layout`, `layoutId`, `height`,
  `width`, `top`, `left`.
- **Nenhuma entrada ou saída animada do cartão.** O cartão aparece e some em um quadro.
- **Nenhuma animação nas demais fases do ciclo** — conexão, estimativa, busca, revisão
  ficam exatamente como estão.

`SC-011` é a asserção de que o conjunto é exatamente três.

---

## 4. Só transformação e opacidade (FR-017a)

As três animações usam **apenas** `transform` e `opacity`. Nenhuma outra propriedade é
admitida.

O motivo é concreto e não é higiene abstrata: a tela anima continuamente **enquanto uma
requisição está em voo**. Movimento que força recálculo de layout a cada quadro competiria
com o próprio trabalho que a tela está esperando — e o pior caso é o YouTube, cujo lote é
de um item, onde a criação faz uma requisição por faixa.

`transform` e `opacity` são compostas pela GPU sem recálculo de layout nem repintura da
árvore.

---

## 5. Movimento reduzido (FR-016, SC-003)

**Cada uma das três primitivas consulta `useReducedMotion()` e, quando ele devolve `true`,
devolve o estado final estático.** Sem animação, sem transição, sem exceção.

### Por que a regra de CSS que já existe não basta

`src/styles/index.css` zera `animation-duration` e `transition-duration` sob
`prefers-reduced-motion`, com `!important`, e essa regra **não alcança a `motion`**: a
biblioteca anima por WAAPI e por atualização de valor em JavaScript, não por `@keyframes`
que o CSS possa encurtar. Confiar nela entregaria uma tela que gira e pulsa exatamente
para quem pediu que não girasse.

### Por que `MotionConfig reducedMotion="user"` também não basta

A documentação da biblioteca é explícita: essa opção desativa animação de transformação e
de layout **e preserva** a animação de `opacity`. A pulsação do esqueleto é `opacity`, e o
FR-016 manda suprimi-la. O interruptor tem de ser explícito, por primitiva.

### O que permanece sob a preferência

Tudo que é informação. Título, subtítulo, descrição, rodapé e aviso de espera continuam
presentes e anunciados. O estado "criação em curso" está escrito em três lugares e não
depende de movimento em nenhum (FR-017).

`SC-003` mede isso literalmente: a contagem de textos exibidos é a mesma com e sem a
preferência.

### Verificação

| Camada | Como |
| --- | --- |
| Componente | `vi.stubGlobal('matchMedia', …)` devolvendo `prefers-reduced-motion: reduce`, como `tests/components/shell.spec.tsx` já faz |
| Ponta a ponta | projeto Playwright com `use: { reducedMotion: 'reduce' }` |

---

## 6. Cores forçadas e o esqueleto

No modo de cores forçadas o navegador descarta preenchimento, e as barras — que são só
preenchimento — desaparecem. **Nenhum tratamento é adicionado para trazê-las de volta.**

Elas não carregam informação nenhuma; o texto do cartão continua inteiro, e o rodapé
continua dizendo o que está acontecendo. Dar contorno às barras nesse modo faria o
esqueleto parecer conteúdo justamente para quem escolheu o modo que remove decoração.

---

## 7. O guia de estilo é atualizado junto

`docs/style-guide.md` §Movimento diz hoje que o sistema "quase não tem movimento" e que
"o resto é instantâneo". Isso deixa de ser verdade nesta feature.

A seção passa a registrar: os três movimentos, as duas propriedades autorizadas, o
orçamento de 200ms preservado para a fusão cruzada, e o interruptor de movimento reduzido
em JavaScript com o motivo pelo qual o interruptor de CSS não bastava.

O guia **descreve** o código. Divergência entre os dois se resolve corrigindo o guia,
nunca duplicando um valor.

---

## 8. Portões

| Verificação | Onde | Requisito |
| --- | --- | --- |
| Nenhum arquivo fora de `src/ui/motion/` importa a biblioteca | `tp/no-motion-library-import` + `tests/unit/motion-surface.spec.ts` | FR-010b |
| O diretório exporta exatamente três primitivas | `tests/unit/motion-surface.spec.ts` | FR-010b, SC-011 |
| As três animam só `transform` e `opacity` | idem, por asserção sobre as primitivas | FR-017a, SC-011 |
| Nada anima sob movimento reduzido | `tests/components/creating-card.spec.tsx` + `e2e/` | FR-016, SC-003 |
| Todo texto permanece sob movimento reduzido | idem | FR-016, FR-017, SC-003 |
| A fusão cruzada não move o cabeçalho nem o título | `e2e/creating-loading.spec.ts` | FR-010, SC-004 |
