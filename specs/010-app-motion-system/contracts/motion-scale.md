# Contrato — Escala de movimento

Definição normativa de FR-006, FR-007, FR-008 e do SC-003.

O par de `007/contracts/tokens.md`: aquilo é a origem única dos valores **visuais**, isto é a
origem única dos valores de **tempo**. A disciplina é a mesma e o motivo é o mesmo — sem
escala finita, cada superfície nova traz o seu próprio "0,35s, quase-`easeOut`", e o sistema
perde a propriedade que o torna reconhecível.

---

## 1. A escala

Normativa. Alterá-la aqui sem alterar o código, ou o contrário, quebra
`tests/unit/motion-scale.spec.ts`.

### 1.1 Durações

| Nome | Valor | Papel | Quem usa |
| --- | --- | --- | --- |
| `quick` | 120ms | microinteração de periferia | cor do chip de conexão, marcação do cartão de destino, preenchimento do disco da trilha |
| `base` | **200ms** | o orçamento herdado do sistema | conector da trilha, `CrossFade`, `StepTransition`, `Stagger` |
| `settle` | 320ms | acomodação de posição | `Settle` |
| `spin` | 1000ms | período do giro | `SpinningDisc` |
| `pulse` | 1200ms | período da pulsação | `PulsingBar` |

**`base` é herdado, não escolhido.** Ele é o orçamento que `docs/style-guide.md` já fixava
para o conector da trilha antes da 009, e que a fusão cruzada reaproveitou. O sistema tem
**um** tempo de transição, e os outros dois degraus existem porque têm papel que só eles
atendem:

- `quick` é mais curto porque microinteração de periferia acontece longe do olho. Nos 200ms
  de `base` a mudança de um chip no canto oposto termina depois que o olhar já passou.
- `settle` é mais longo porque é o único momento em que o olho precisa **seguir** um objeto
  de um lugar a outro. Uma acomodação de posição em 200ms lê como um salto com borrão.

`spin` e `pulse` **não são durações de transição** — são períodos de ciclo, vêm da 009 sem
alteração, e nenhuma transição pode usá-los.

### 1.2 Escalonamento

| Nome | Valor |
| --- | --- |
| `staggerStep` | 40ms |
| `staggerCap` | 240ms |

```text
atraso(i) = min(i × staggerStep, staggerCap)
```

**O teto é o requisito, não o passo** (FR-013, SC-009). O `stagger()` da biblioteca
distribui proporcionalmente e não tem teto: 120 linhas a 40ms fariam a última esperar 4,8s.
Com o teto, ela espera 240ms — o mesmo que a última de uma lista de oito.

Acima do sexto irmão a defasagem satura e as linhas seguintes entram juntas. É o
comportamento certo: o papel do escalonamento é dar sequência à leitura das primeiras, não
fazer alguém esperar a centésima vigésima.

### 1.3 Curvas

| Nome | Curva | Papel |
| --- | --- | --- |
| `standard` | `easeOut` | entradas e trocas — o movimento chega e para |
| `through` | `easeInOut` | ciclos de ida e volta |
| `linear` | `linear` | rotação contínua |

Três. Uma quarta exige papel declarado que nenhuma das três atenda.

---

## 2. Duas camadas, uma origem

O movimento do catálogo roda em JavaScript e precisa dos números **como números**. O CSS
precisa deles **como texto**, para `transition-colors` de `Button` e `Toggle` e para o
conector da trilha.

| Camada | Arquivo | Papel |
| --- | --- | --- |
| Origem | `src/ui/motion/scale.ts` | os valores, como dado tipado; consumido pelas primitivas |
| Espelho | `src/styles/index.css`, bloco `@theme` | os mesmos valores como utilitários `duration-*` e `ease-*` |

### Por que TypeScript é a origem

Ler o CSS de dentro de uma primitiva — `getComputedStyle` — colocaria acesso ao DOM numa
camada que não deveria tê-lo, custaria uma leitura de layout por montagem e não funcionaria
em `happy-dom`, onde os testes de componente rodam.

### Por que o espelho não é duplicação silenciosa

Porque há teste. `tests/unit/motion-scale.spec.ts` lê os dois arquivos, extrai os pares
nome→valor de cada um e falha por divergência — **e também por token presente num e ausente
no outro**. É o mesmo molde de `tests/unit/no-secrets.spec.ts`, que confere a tabela de
hosts contra o código e falha tanto por ausência quanto por excesso.

### O que o espelho corrige de passagem

`--default-transition-duration` passa a ser `base`. Hoje `transition-colors` em `Button`,
`Toggle` e `ConnectionChip` herda os **150ms padrão do Tailwind** — um valor que o sistema
nunca escolheu e que não aparece em documento nenhum. Depois desta feature, o sistema tem
uma duração padrão porque decidiu ter.

---

## 3. Nenhum valor cru

`tp/no-raw-motion-values` é a regra de lint nova, no molde exato de
`tp/no-raw-visual-values`. Ela falha por:

| Padrão | Exemplo | Por quê |
| --- | --- | --- |
| Literal numérico em `duration`, `delay` ou `repeatDelay` | `transition={{ duration: 0.35 }}` | é a origem de um degrau não declarado |
| Literal de curva | `ease: [0.4, 0, 0.2, 1]`, `ease: 'circOut'` | idem, para curvas |
| Utilitário de duração fora do conjunto emitido | `duration-150`, `duration-[350ms]` | o scanner do Tailwind aceita e o sistema perde a escala |
| Utilitário de curva fora do conjunto emitido | `ease-linear` escrito à mão onde há papel | idem |

**Isento**: `src/ui/motion/scale.ts`, que é a origem. Nada mais — nem as próprias
primitivas, que importam da escala como qualquer outro consumidor.

A regra existe pelo mesmo motivo que as outras quatro de `eslint-rules/index.js`: é um erro
que **não falha**. `duration-[350ms]` gera CSS válido, passa no `typecheck`, passa no build,
e só um par de olhos numa revisão perceberia que o sistema ganhou um sexto tempo.

---

## 4. Verificação

| Portão | Onde | Requisito |
| --- | --- | --- |
| A escala tem exatamente os degraus da §1 | `motion-scale.spec.ts` | FR-006 |
| TypeScript e CSS concordam, valor a valor | idem | FR-006, SC-003 |
| Nenhum token existe em só uma das camadas | idem | FR-006 |
| `base` continua valendo 200ms | idem | FR-007 |
| Nenhum valor cru de tempo ou curva em `src/` | `tp/no-raw-motion-values` + `motion-scale.spec.ts` | FR-008, SC-003 |
| O teto de defasagem é respeitado | `tests/unit/stagger.spec.ts` | FR-013, SC-009 |
