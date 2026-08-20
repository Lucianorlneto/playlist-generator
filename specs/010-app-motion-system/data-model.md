# Modelo — Sistema de movimento do aplicativo

Fase 1 de `plan.md`. Esta feature **não introduz nenhuma entidade de negócio, nenhum estado
persistido e nenhuma chave de armazenamento**. O que ela modela é a camada de movimento:
uma escala de valores, um catálogo de primitivas e uma derivação pura de direção.

`tp.v2.draft`, `tp.v2.theme` e as chaves por provedor ficam **exatamente** como estão. Uma
preferência de movimento não é gravada: a fonte é `prefers-reduced-motion`, do sistema
operacional.

---

## 1. Escala de movimento

Dado puro, sem tema e sem variação por provedor. **Origem única em TypeScript**, espelhada
em CSS e verificada por teste (research §R5).

### 1.1 Durações

| Nome | Valor | Papel | Quem usa |
| --- | --- | --- | --- |
| `quick` | 120ms | microinteração de periferia | cor do chip, marcação do cartão de destino, disco da trilha |
| `base` | 200ms | o orçamento herdado do sistema | conector da trilha, `CrossFade`, `StepTransition` |
| `settle` | 320ms | acomodação de posição | `Settle` |
| `spin` | 1000ms | ciclo do giro | `SpinningDisc` (009, inalterado) |
| `pulse` | 1200ms | ciclo da pulsação | `PulsingBar` (009, inalterado) |

`spin` e `pulse` **não são durações de transição** — são períodos de ciclo. Estão na mesma
escala porque a origem única vale para todo valor de tempo, mas nenhuma transição pode
usá-los e nenhum ciclo pode usar os três primeiros.

### 1.2 Escalonamento

| Nome | Valor | Papel |
| --- | --- | --- |
| `staggerStep` | 40ms | passo entre irmãos consecutivos |
| `staggerCap` | 240ms | teto absoluto da defasagem acumulada |

Regra: `atraso(i) = min(i × staggerStep, staggerCap)`. Acima do sexto irmão a defasagem
satura (research §R7).

### 1.3 Curvas

| Nome | Curva | Papel |
| --- | --- | --- |
| `standard` | `easeOut` | entradas e trocas — o movimento chega e para |
| `through` | `easeInOut` | ciclos de ida e volta |
| `linear` | `linear` | rotação contínua |

Três, e cada uma tem um papel que só ela atende. Uma quarta exige papel novo declarado.

### 1.4 Regra de integridade

Todo valor de tempo ou de curva usado em movimento **vem daqui**. Verificado por
`tp/no-raw-motion-values` (falha no editor) e por `tests/unit/motion-scale.spec.ts` (falha
também no `.css`, que o ESLint não lê).

---

## 2. Catálogo de movimento

Seis entradas. A verificação afirma a **identidade** deste conjunto, não o tamanho dele
(research §R3).

| Primitiva | Papel | Propriedades | Duração | Origem |
| --- | --- | --- | --- | --- |
| `SpinningDisc` | giro do glifo de carregamento | `rotate` | `spin`, `linear`, infinito | 009 |
| `PulsingBar` | pulsação das barras de esqueleto | `opacity` | `pulse`, `through`, infinito | 009 |
| `CrossFade` | troca de conteúdo na mesma célula | `opacity` | `base`, `standard` | 009 |
| `StepTransition` | troca de etapa, com direção | `opacity`, `x` | `base`, `standard` | 010 |
| `Stagger` | entrada escalonada com teto | `opacity` + `y` ou `scale` | `base`, `standard`, com atraso por índice | 010 |
| `Settle` | acomodação de posição em superfície ociosa | posição, por transformação | `settle`, `standard` | 010 |

### 2.1 Invariantes do catálogo

1. **Nenhuma primitiva reexporta a biblioteca**, sob nenhum nome.
2. **`Settle` é a única que anima posição.** As outras cinco animam apenas `transform` de
   rotação/escala e `opacity`.
3. **`Settle` só anima com o portão aberto.** Ele exige `idle: boolean`; com `false`, devolve
   os filhos sem animação (research §R8).
4. **Toda primitiva devolve o estado final estático sob movimento reduzido.** Sem exceção,
   por consulta explícita — a regra global de CSS não alcança a biblioteca.
5. **Nenhuma primitiva aceita duração, curva ou atraso como parâmetro.** Superfície pede
   papel; quem precisa de tempo próprio vira entrada nova no catálogo (FR-004).

### 2.2 Papéis, onde há mais de um por primitiva

`Stagger` é a única com variação, e ela é fechada:

| Papel | Keyframes | Quem pede |
| --- | --- | --- |
| `enter` | `opacity` 0→1, `y` +8px→0 | lista de correspondências da revisão; aviso de recuperação de rascunho |
| `decor` | `opacity` 0→1, `scale` 0,92→1 | faixa de adesivos de Destinos |

`enter` serve um ou mais irmãos: com um só a defasagem é zero, e o papel degenera em entrada
simples.

Um terceiro papel exige entrada nova na tabela e no teste — é a mesma disciplina de
`<Icon role="…" />`.

---

## 3. Direção de etapa

Derivação **pura**, em `src/domain/` (Princípio III). Sem DOM, sem relógio, sem estado.

```text
stepDirection(from: WizardStep | null, to: WizardStep) → -1 | 0 | 1
```

| Entrada | Saída | Significado |
| --- | --- | --- |
| `from` é `null` | `0` | primeira montagem — não é troca, não anima (FR-024) |
| `from` vem antes de `to` em `WIZARD_STEPS` | `1` | avanço |
| `from` vem depois | `-1` | retorno |
| `from === to` | `0` | nada mudou |

A ordem canônica é `WIZARD_STEPS` de `src/domain/types.ts`, já existente. A função **não**
duplica a lista.

**Onde mora a etapa anterior**: num `ref` do `Wizard`. É orquestração, não estado de
domínio. Não entra no store, não entra em `draftPersistence`, não vira chave de
armazenamento — um rascunho não deve carregar a direção da última transição.

---

## 4. Estado consultado, nunca criado

As primitivas leem estado que já existe. Nenhum campo novo no store.

| Consumidor | Lê | De onde |
| --- | --- | --- |
| `StepTransition` | etapa corrente | `state.step` (`wizardSlice`) |
| `Settle` na revisão | busca em curso | `state.search.running` (`itemsSlice`) |
| `Settle` na fila | execução em curso | fase da execução corrente (`runSlice`) |
| Todas | preferência de movimento | `prefers-reduced-motion`, via a biblioteca |

### 4.1 O único estado novo, e ele não é do store

A encenação dos adesivos acontece **uma vez por sessão** (FR-032a). O sinalizador é um valor
de módulo em memória, no próprio `Stickers.tsx` — não entra no store, não entra em
`draftPersistence`, não vira chave de armazenamento e não sobrevive a uma recarga.

Não entra no store porque nada além do próprio componente precisa dele, e uma fatia nova
existiria só para carregar um booleano decorativo. Não é persistido porque um rascunho
recuperado não deve carregar o que já foi encenado — recarregar a página é uma sessão nova, e
reencenar ali é o comportamento certo.

O foco de etapa continua vindo de `stepToken`, sem alteração: `StepHeading` é o dono desse
comportamento e esta feature **não** o toca.

---

## 5. O que esta feature não modela

- Nenhuma entidade de negócio. Fila, execução, itens, cota, credencial e sessão ficam
  intactos.
- Nenhuma chave de armazenamento nova, nenhuma versão de esquema nova, nenhuma migração.
- Nenhum destino de rede. Nenhuma dependência nova.
- Nenhum texto de interface novo — e se algum surgir, vem de `src/i18n/pt-BR.ts` como
  qualquer outro.
- Nenhum token de cor novo. `tests/unit/contrast.spec.ts` e a tabela de pares aprovados não
  são tocados.
