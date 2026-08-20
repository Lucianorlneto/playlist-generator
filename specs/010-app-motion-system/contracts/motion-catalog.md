# Contrato — Catálogo de movimento

Definição normativa de FR-001 a FR-005, FR-009, FR-014 e dos SC-001, SC-002 e SC-005.

**Substitui `009/contracts/motion.md` §1 e §3.** Os três movimentos da 009 continuam com
comportamento idêntico; o que muda é o que a fechadura protege.

---

## 1. A fechadura, e o que ela passa a proteger

`src/ui/motion/` continua sendo o **único** diretório de `src/` autorizado a importar de
`motion` ou `motion/react`, e continua sem reexportar a biblioteca sob nenhum nome.

O que muda é o objeto da verificação. A 009 afirmava **"exatamente três"**. Esta feature
afirma **quais são**.

### Por que a contagem sai

A contagem nunca foi a invariante — era um proxy barato para ela. A invariante é: *toda
animação do produto tem nome, papel e passou por revisão*. Um número falha nos dois sentidos
errados: ele quebra quando um movimento novo entra **com** revisão, e não diz qual sumiu
quando quebra. A identidade falha exatamente onde precisa — movimento entrando calado — e
o modo de falha nomeia o culpado.

### As duas verificações permanecem, redundantes de propósito

| Verificação | Alcance | Falha quando |
| --- | --- | --- |
| `tp/no-motion-library-import` | `src/**/*.{ts,tsx}` | alguém importa a biblioteca fora do diretório, ou importa `framer-motion` em qualquer lugar |
| `tests/unit/motion-catalog.spec.ts` | `src/**/*.{ts,tsx,css}` | o catálogo diverge da tabela, o barril reexporta algo indevido, ou uma primitiva anima propriedade proibida |

A regra de lint falha no editor, enquanto ainda custa uma tecla consertar. O teste alcança
o `.css`, que o ESLint não lê, e sobrevive a um comentário de supressão. A mensagem da regra
é reescrita: ela deixa de citar "exatamente três" e passa a apontar o catálogo.

`tests/unit/motion-surface.spec.ts` é **renomeado** para `motion-catalog.spec.ts`. Renomear
e não criar ao lado: dois testes com o mesmo propósito e critérios diferentes é como um
deles apodrece.

---

## 2. O catálogo

Seis entradas. A tabela abaixo é normativa e é o que o teste afirma.

| Primitiva | Papel | Propriedades animadas | Degrau | Curva | Repetição |
| --- | --- | --- | --- | --- | --- |
| `SpinningDisc` | giro do glifo de carregamento | `rotate` | `spin` | `linear` | infinita |
| `PulsingBar` | pulsação das barras de esqueleto | `opacity` | `pulse` | `through` | infinita |
| `CrossFade` | troca de conteúdo na mesma célula | `opacity` | `base` | `standard` | uma vez |
| `StepTransition` | troca de etapa, com direção | `opacity`, `x` | `base` | `standard` | uma vez |
| `Stagger` | entrada escalonada com teto | `opacity` + `y` \| `scale` | `base` | `standard` | uma vez |
| `Settle` | acomodação de posição em superfície ociosa | posição, por transformação | `settle` | `standard` | uma vez |

### 2.1 Regra de admissão

Uma primitiva nova exige, no mesmo commit: entrada nesta tabela, entrada no barril, entrada
no teste de identidade e um parágrafo em `docs/style-guide.md` §Movimento. Quatro edições —
é a revisão que se quer forçar.

### 2.2 Superfície pede papel, nunca configura animação

Nenhuma primitiva aceita `duration`, `ease`, `delay` ou `transition` como prop. Uma
superfície que precise de tempo próprio **não** ganha um parâmetro: ela vira papel novo.

É a mesma disciplina que `src/ui/icons.ts` já impõe — `<Icon role="advance" />`, não
`<Icon name="chevron-right" size={16} />`.

A única variação admitida é a de `Stagger`, e ela é fechada:

| Papel | Keyframes | Quem pede |
| --- | --- | --- |
| `enter` | `opacity` 0→1, `y` +8px→0 | lista de correspondências da revisão; aviso de recuperação de rascunho |
| `decor` | `opacity` 0→1, `scale` 0,92→1 | faixa de adesivos de Destinos |

`enter` serve **um ou mais** irmãos: com um só, a fórmula devolve defasagem zero e o papel
degenera em entrada simples. É por isso que o aviso de rascunho não custa entrada nova no
catálogo (FR-021b).

---

## 3. Propriedades proibidas

Nenhuma primitiva anima propriedade que dispare recálculo de layout ou repintura da árvore:
`height`, `width`, `top`, `left`, `right`, `bottom`, `margin`, `padding`, `border*`,
`box-shadow`, `filter`, `background*`.

A lista já existe em `motion-surface.spec.ts` e é herdada literalmente.

### A exceção declarada por nome

`Settle` anima **posição**, e é a única. Ela o faz por transformação — a biblioteca compõe
com `translate`, nunca com `top`/`left` — mas **mede** o layout para calcular o delta. É a
medição que custa, e é por isso que o portão da seção 4 existe.

O teste afirma isto de forma dirigida: `Settle` está na lista de quem pode animar posição, e
essa lista tem um elemento.

---

## 4. O portão de ociosidade

`Settle` **exige** a prop `idle: boolean`. Com `false`, devolve os filhos sem animação
alguma.

```text
<Settle idle={search.running === false}>…</Settle>
```

### Por que um portão em vez de uma lista de arquivos permitidos

Uma allowlist diria **onde** `Settle` pode aparecer. Não diria se ele está ligado no momento
errado — e a lista de revisão é exatamente uma superfície que tem os dois momentos, com
busca e sem busca. O portão declarado por quem chama é a única forma de a fronteira do
FR-010 ser verificável em vez de convencional.

### O que cada superfície passa

| Superfície | Expressão | Por quê |
| --- | --- | --- |
| Lista de revisão | busca não está em curso | durante a busca há requisição em voo |
| Painel de fila | nenhuma execução em curso | a fila muda por seleção, não por trabalho |

`idle` não tem valor padrão. Um padrão `true` faria o esquecimento abrir o portão, e o modo
de falha de um portão deve ser fechar.

---

## 4a. Interrupção

Toda animação do catálogo é **interrompível a partir do valor corrente** (FR-018a). Uma nova
animação que substitui outra em curso assume os valores onde ela estava e segue dali. É o
comportamento padrão da biblioteca, e adotá-lo é decisão, não omissão.

**Nenhum salto ao estado final precede a troca.** Cortar e recomeçar produziria um piscar a
cada clique rápido — exatamente o que esta feature existe para remover.

**Consequência para os testes**: o que se afirma é o **estado final** e a **ausência de nó
preso**. Os quadros intermediários de uma interrupção não são objeto de asserção, e um teste
que os afirmasse seria instável por construção.

## 5. Movimento reduzido

**Cada uma das seis primitivas consulta `useReducedMotion()` e devolve o estado final
estático.** Sem animação, sem transição, sem exceção.

As duas razões pelas quais isso não pode ser delegado continuam válidas palavra por palavra
de `009/contracts/motion.md` §5:

- a regra global de `index.css` zera `animation-duration` e `transition-duration`, e **não
  alcança** a biblioteca, que anima por atualização de valor e não por `@keyframes`;
- `MotionConfig reducedMotion="user"` **preserva** animação de `opacity`, que é justamente o
  que `PulsingBar` e `Stagger` fazem.

### Estado final de cada uma

| Primitiva | Estado final sob movimento reduzido |
| --- | --- |
| `SpinningDisc` | glifo parado |
| `PulsingBar` | barra cheia |
| `CrossFade` | o conteúdo real assim que existe; o esqueleto antes disso |
| `StepTransition` | a etapa que entra, em um quadro, opaca e sem deslocamento |
| `Stagger` | todos os irmãos visíveis, sem defasagem |
| `Settle` | a nova posição, em um quadro |

### O que permanece

Tudo que é informação. A contagem de textos exibidos e de controles alcançáveis é **idêntica**
com e sem a preferência — SC-004 mede isso literalmente, tela a tela.

---

## 6. Verificação

| Portão | Onde | Requisito |
| --- | --- | --- |
| Nenhum arquivo fora do diretório importa a biblioteca | `tp/no-motion-library-import` + `motion-catalog.spec.ts` | FR-003 |
| `framer-motion` não é importado em lugar nenhum | idem | FR-003 |
| O barril exporta exatamente o catálogo, e nada mais | `motion-catalog.spec.ts` | FR-001, SC-001 |
| O barril só reexporta arquivos locais | idem | FR-003, SC-002 |
| Nenhuma primitiva anima propriedade proibida | idem | FR-009 |
| `Settle` é a única que anima posição | idem | FR-010 |
| `Settle` sem `idle` não compila | `tsc --noEmit` | FR-010a |
| `Settle` com `idle={false}` não anima | `tests/components/settle.spec.tsx` | FR-010a, SC-015 |
| Nenhuma primitiva aceita duração, curva ou atraso | `motion-catalog.spec.ts` | FR-004 |
| Nada anima sob movimento reduzido | `tests/components/` + projeto `reduced-motion` | FR-014, SC-005 |
| Todo texto permanece sob movimento reduzido | idem | FR-015, SC-004 |
