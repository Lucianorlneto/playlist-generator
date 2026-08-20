# Contrato — Superfícies animadas

Definição normativa de FR-016 a FR-033. Uma seção por superfície: o que anima, o que **não**
anima, e o que a acessibilidade exige em troca.

---

## 1. Troca de etapa (FR-021 a FR-024)

**Onde**: `src/app/Wizard.tsx`. **Primitiva**: `StepTransition`.

| | |
| --- | --- |
| Anima | `opacity` e `x` do miolo da coluna principal |
| Não anima | barra superior, trilha, barra de ação, fundo ambiente, aviso de rascunho |
| Direção | `x` entra de `+16px` no avanço e de `−16px` no retorno; o que sai vai ao oposto |
| Duração | `base` |

### 1.1 O nó que sai fica fora do fluxo

Mesmo arranjo que `CrossFade` já usa, justificado em `009/research §R7`: o bloco que **sai**
vai para `position: absolute` num envoltório nosso; o que **entra** fica no fluxo e define a
altura.

Os dois modos que a biblioteca oferece foram descartados por motivo concreto:

- **`mode="wait"`** monta o novo só depois que o antigo sai. `StepHeading` foca no efeito
  disparado por `focusToken`; o foco chegaria 200ms depois. É violação direta do FR-016 e do
  SC-008, e é a mesma falha que a 009 já recusou no cartão de criação.
- **`mode="popLayout"`** faz o certo automaticamente, mas exige que o filho encaminhe `ref`
  até o nó do DOM — o que obrigaria as cinco telas de etapa a virarem `forwardRef`. Com o
  envoltório sendo nosso, nenhuma `ref` atravessa as telas, e o projeto passa a ter **um**
  mecanismo de saída fora de fluxo em vez de dois.

A direção vem de `usePresenceData()`, lido pelo nó que sai, com `custom` no
`AnimatePresence`. Esse mecanismo existe justamente porque o nó que sai precisa da direção
que valia quando ele saiu, e uma prop mudaria embaixo dele.

### 1.2 A árvore que sai some para o teclado e para o leitor de tela

Por 200ms existem **dois** cabeçalhos de etapa, dois conjuntos de controles e possivelmente
dois `aria-current="step"`. O envoltório de saída recebe `inert` e `aria-hidden="true"`.

Sem isto, a transição introduziria a exata falha que o FR-017 proíbe: alterar a ordem de
leitura e a contagem de controles alcançáveis, ainda que por um quinto de segundo.

### 1.3 Altura

A altura do contêiner passa a ser a da etapa que entra já no primeiro quadro. **Isso não é
regressão** — é exatamente o que acontece hoje, e animar altura é proibido pelo FR-009. O
que o FR-023 proíbe é salto **causado pela transição**: ir à altura do maior, ou a zero, e
voltar. Nenhum dos dois ocorre neste arranjo.

### 1.4 O alcance é só a etapa

`StepTransition` envolve a troca de **etapa do assistente** e nada mais. As trocas de fase
dentro da etapa Serviço — conexão, estimativa, busca, revisão, criação, conclusão — **não
animam** (FR-021a). A proibição de `009/contracts/motion.md` §3 permanece literal para elas.

A razão é semântica, não de custo: várias dessas fases trocam **sozinhas**, quando a busca
ou a criação termina. Uma transição com direção comunica avanço comandado, e aplicá-la a uma
troca autônoma mentiria sobre quem agiu. Somam-se a isso o cartão de criação, que já tem
movimento próprio da 009 e não deve receber outro por cima.

`ServiceStep` renderiza cada fase diretamente, como hoje. Nada nele muda.

### 1.5 O aviso de recuperação de rascunho fica de fora

`DraftRecoveryBanner` vive **acima** do bloco que transita e permanece imóvel durante a troca
de etapa (FR-021b). Ele não pertence a nenhuma etapa — sobrevive a todas —, e transitá-lo
junto o faria sair e voltar a cada avanço, sugerindo que sumiu.

Quando **ele mesmo** aparece, anima a entrada com o papel `enter`, o mesmo da lista de
revisão. Sendo um irmão só, a defasagem é zero. O descartar continua imediato: é ação
comandada, e segurar a saída atrasaria a confirmação de que o descarte aconteceu.

Consequência de layout, registrada: o aviso entra e sai do fluxo e empurra o bloco abaixo,
exatamente como hoje. Isso **não** é violação do FR-021 — a casca ali é a barra superior, a
trilha e a barra de ação, e nenhuma delas se move.

### 1.6 Primeira montagem não anima

`initial={false}` no `AnimatePresence`. Recarregar a página, voltar do retorno de
autorização ou restaurar um rascunho **não é uma troca** e não deve animar (FR-024) — é o
precedente que `CrossFade` já estabeleceu.

`stepDirection` devolve `0` quando não há etapa anterior, e `0` significa sem movimento.

---

## 2. Trilha de etapas (FR-025)

**Onde**: `src/app/StepRail.tsx`. **Primitivas**: `CrossFade` e CSS.

| Elemento | Como | Duração |
| --- | --- | --- |
| Conector | `transition-colors`, já existente | `base` |
| Disco, preenchimento e contorno | `transition-colors` | `quick` |
| Conteúdo do disco: numeral ↔ glifo de conclusão | `CrossFade` | `base` |

**Nenhuma primitiva nova.** A troca do numeral pelo glifo é conteúdo substituindo conteúdo
na mesma célula, que é literalmente o papel do `CrossFade` — reaproveitá-lo aqui é o teste
mais forte de que ele foi nomeado por papel e não por tela.

**A distinção entre estados continua sendo por forma** — preenchido, tingido, vazado — e a
tabela de `StepRail.tsx` não muda. A animação interpola cor; ela não pode produzir um quadro
em que o disco não seja legível como um dos três estados.

---

## 3. Lista de correspondências (FR-026 a FR-028)

**Onde**: `src/features/review/ReviewScreen.tsx`. **Primitivas**: `Stagger` (papel `enter`) e
`Settle`.

### 3.1 Entrada

As linhas **não chegam em fluxo** (`research.md` §R2). `search_done` despacha a lista inteira
depois que a busca resolve; durante a busca só a contagem avança. A entrada escalonada
acontece, portanto, num momento em que **não há requisição em voo**.

| | |
| --- | --- |
| Anima | `opacity` 0→1 e `y` +8px→0, por linha |
| Defasagem | `min(i × 40ms, 240ms)` |
| Identidade | `item.line.id`, que já é a chave da lista |

**Numa execução retomada**, linhas já em cena antes da busca começar não animam: a entrada é
por montagem de nó, e elas não remontam. Nenhum tratamento especial — a chave estável faz o
trabalho.

### 3.2 Saída e acomodação

Descartar uma linha na revisão anima a saída em `opacity`, e as linhas abaixo assumem a nova
posição com `Settle`. O portão é `idle={search.running === false}`, que na revisão é sempre
verdadeiro — passá-lo mesmo assim é o que mantém o portão auditável em vez de decorativo.

### 3.3 O que não anima

- **A barra de progresso.** É o `<progress>` nativo, escolhido por acessibilidade, e o
  `value` já avança sozinho. A justificativa antiga citava a CSP e não se sustenta
  (`research.md` §R1); a razão que sobra basta.
- **Nada durante a busca** (FR-026a). A tela continua com a barra e a contagem.
- **A ordem.** A lista é renderizada por `line.index` e **nunca reordenada** — decisão da
  001, preservada. `Settle` acomoda remoção, não reordenação.

### 3.4 O que a acessibilidade exige

As regiões vivas de `SearchProgress` não mudam de texto, de momento nem de contagem. O
`aria-label` da lista permanece. Nenhuma linha é anunciada por entrar — a entrada é visual.

---

## 4. Periferia (FR-029 a FR-031)

**Nenhuma primitiva nova.** A maior parte desta história é CSS, e é assim que deve ser.

| Superfície | Onde | Como |
| --- | --- | --- |
| Chip de conexão | `src/features/connect/ConnectionChip.tsx` | `transition-colors` em `quick`; a troca de rótulo, se houver, por `CrossFade` |
| Cartão de destino | `src/features/destinations/DestinationSelector.tsx` | `transition-colors` em `quick`, **sem transformação** — ver abaixo |
| Painel de fila | `src/features/destinations/ExecutionOrderPanel.tsx` | `Settle`, com o portão em "nenhuma execução em curso" |

O estado de cada uma continua legível por **texto e forma**, nunca só por cor e nunca só por
movimento (FR-015).

### 4.1 O cartão de destino não é transformado

Decidido na segunda rodada de clarificações: apenas uma fusão das cores que mudam ao acionar —
preenchimento, contorno e caixa de marcação. **Nada de escala, pressão ou deslocamento**
(FR-031).

O cartão é uma área clicável grande e contém texto que a pessoa está lendo no momento em que
clica; encolhê-lo moveria esse texto. A marcação já é legível por forma — a caixa marcada — e
o foco visível já dá o retorno de acionamento por teclado, que uma pressão só por ponteiro
não daria.

---

## 5. Adesivos de Destinos (FR-032 a FR-034)

**Onde**: `src/ui/Stickers.tsx`. **Primitiva**: `Stagger` (papel `decor`).

| | |
| --- | --- |
| Anima | `opacity` 0→1 e `scale` 0,92→1, por adesivo |
| Defasagem | a mesma fórmula com teto; onze adesivos saturam no sexto |
| Quando | **uma vez por sessão**, na primeira aparição de Destinos (FR-032, FR-032a) |
| Permanece | `aria-hidden="true"`, `alt=""`, `pointer-events-none` |
| Não anima | nada em repouso — os adesivos assentam e ficam imóveis (FR-034) |

### 5.0 Uma vez por sessão

Voltar a Destinos para corrigir a lista ou trocar de destino é caminho comum. Reencenar onze
adesivos a cada volta chamaria atenção justamente para o que menos importa na tela — e o que
é charme na primeira vez é ruído na terceira.

O sinalizador vive **em memória** e nunca é persistido: nem no rascunho, nem em chave nova de
armazenamento. Um rascunho recuperado não deve carregar o que já foi encenado, e recarregar a
página legitimamente reencena — é uma sessão nova.

### 5.1 A inclinação não é movimento

Cada adesivo já nasce torto: `rotate` vem da transcrição do nó `wv9Cp` e é **geometria
estática**. `Stagger` acrescenta `opacity` e `scale` **por cima** dela, e a inclinação
final é a mesma da tabela — animar `scale` não pode alterar o ângulo que o arquivo declara.

### 5.2 A faixa não empurra nada

A camada é `absolute inset-0` e continua sendo. Nenhum quadro da entrada desloca conteúdo
acima dela (FR-033), porque ela nunca esteve no fluxo.

### 5.3 Cores forçadas

Nenhum tratamento é adicionado. No modo de cores forçadas os adesivos somem, como já somem
hoje, e a tela continua inteira — eles não carregam informação nenhuma (FR-019).

---

## 6. O que esta feature não anima

Registro explícito, para não ser redescoberto:

| Superfície | Por quê |
| --- | --- |
| Entrada e saída de diálogo | O elemento nativo abre e fecha por chamada imperativa e vive na camada de topo; animar a saída exigiria segurá-lo em cena depois do fechamento, e o diálogo de confirmação é o que segura o Princípio V (FR-036) |
| Fundo ambiente | Movimento ocioso contínuo foi recusado na clarificação de escopo (FR-034) |
| Grade de números do resultado | Contagem animada disputaria com a região viva que já anuncia o resultado |
| Barra de progresso | §3.3 |
| Cartão de criação | A 009 já o resolveu; esta feature não o toca |

---

## 7. Verificação

| Portão | Onde | Requisito |
| --- | --- | --- |
| As zonas da casca não se deslocam na transição | `e2e/motion.spec.ts`, por caixa delimitadora | FR-021, SC-007 |
| A transição tem direção, e o retorno é o oposto | `tests/components/step-transition.spec.tsx` | FR-022 |
| O foco chega ao título sem esperar a animação | idem | FR-016, SC-008 |
| A árvore que sai é `inert` e `aria-hidden` | idem | FR-017 |
| Primeira montagem não anima | idem | FR-024 |
| Nenhuma fase do ciclo de serviço anima | `tests/components/service-phases.spec.tsx` | FR-021a, SC-016 |
| O aviso de rascunho não transita com a etapa | `tests/components/step-transition.spec.tsx` | FR-021b |
| O aviso de rascunho anima ao aparecer sozinho | idem | FR-021b |
| O cartão de destino não é transformado | `tests/components/destination-card.spec.tsx` | FR-031 |
| Os adesivos não reanimam na segunda visita | `tests/components/stickers.spec.tsx` | FR-032a, SC-017 |
| `stepDirection` devolve o esperado para todo par | `tests/unit/step-direction.spec.ts` | FR-022 |
| A defasagem da última de 120 é igual à da última de 8 | `tests/unit/stagger.spec.ts` | FR-013, SC-009 |
| Nada anima durante a busca | `tests/components/review-motion.spec.tsx` | FR-026a, SC-015 |
| Linhas de execução retomada não animam | idem | FR-026a |
| A faixa de adesivos não desloca conteúdo | `e2e/motion.spec.ts` | FR-033 |
| Nenhuma rolagem horizontal em nenhum quadro | `e2e/motion.spec.ts`, `narrow-375` | SC-012 |
| Nenhuma violação séria ou crítica | `tests/a11y/`, nos dois temas | FR-020, SC-011 |
| Interrupção resolve no estado final | `e2e/motion.spec.ts` | FR-018, SC-013 |
| Em repouso nada anima | `e2e/motion.spec.ts` | FR-034, SC-014 |
