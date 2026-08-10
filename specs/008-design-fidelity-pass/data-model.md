# Data Model — Correções de fidelidade ao design oficial

Fase 1 do plano. Esta feature **não cria nem altera nenhuma entidade persistida**:
nenhuma chave de `localStorage`, nenhum formato, nenhuma migração. O que este documento
modela são as três projeções puras que a spec nomeia em *Key Entities* — todas
derivadas de estado que já existe.

---

## 1. Linha de contexto do cabeçalho

**Onde vive**: `src/domain/header/index.ts` — puro, sem DOM, sem store, sem relógio.

### Entrada

```ts
export interface HeaderSnapshot {
  readonly step: WizardStep;
  /** Fase da execução corrente. `null` fora da etapa `service`. */
  readonly phase: RunPhase | null;
  /** Provedor da execução corrente. `null` fora da etapa `service`. */
  readonly provider: ProviderId | null;
  /** Posição 1-based do provedor corrente na fila. */
  readonly position: number;
  /** Tamanho da fila. `1` omite a posição (FR-012). */
  readonly total: number;
  /**
   * Nome de exibição da conta conectada, na ordem fixa do produto. `null`
   * quando não há sessão nenhuma ou quando o nome é vazio (FR-011).
   */
  readonly displayName: string | null;
}
```

### Saída

```ts
export type HeaderContext =
  | { readonly kind: 'absent' }
  | { readonly kind: 'greeting'; readonly firstName: string | null; readonly complement: string }
  | { readonly kind: 'service'; readonly text: string };
```

`greeting` devolve o primeiro nome **separado** do complemento porque os dois têm tintas
diferentes: o nome em `--accent-text`, o complemento em `--ink-muted` (FR-010). Juntá-los
numa string obrigaria o componente a recortá-la de volta.

### Regras

| Regra | Enunciado | Requisito |
| --- | --- | --- |
| H1 | `credential` e `summary` devolvem `absent` | FR-009 |
| H2 | `destinations` e `input` devolvem `greeting`, com o complemento da etapa | FR-009 |
| H3 | `service` devolve `service`, com o texto da fase | FR-009 |
| H4 | O primeiro nome é o primeiro termo do nome de exibição, após `trim`; nome de um termo só é o próprio primeiro nome | Premissa da spec |
| H5 | Sem sessão, ou com nome de exibição vazio, `firstName` é `null` e o componente exibe **só** o complemento | FR-011 |
| H6 | Com `total === 1`, a linha do ciclo omite a posição | FR-012 |
| H7 | `service` nunca contém saudação, em nenhuma fase | FR-009 |

### Tabela de fases (a metade `service` de H3)

| Fase da execução | Texto |
| --- | --- |
| `pending`, `connect`, `awaiting_reauth`, `search`, `review` | `{Serviço} — {posição} de {total}` (ou só `{Serviço}` se `total === 1`) |
| `estimate` | `{Serviço} · Conferindo o orçamento` |
| `creating`, e execução com desfecho | `{Serviço} · Concluído` |

O detalhe normativo, incluindo os nós do arquivo de design que produzem cada linha, está
em [`contracts/header-context.md`](./contracts/header-context.md).

---

## 2. Fila de execução exibida

**Onde vive**: `src/domain/run/selection.ts`, ao lado das funções de seleção que já
existem.

```ts
export interface QueuedDestination {
  readonly provider: ProviderId;
  /** 1-based, contígua, na ordem fixa do produto. */
  readonly position: number;
  /** `true` quando a fila tem um só destino: a nota de ordem relativa some. */
  readonly solo: boolean;
}

export function displayedQueue(selection: DestinationSelection): readonly QueuedDestination[];
```

### Regras

| Regra | Enunciado | Requisito |
| --- | --- | --- |
| Q1 | Contém **exatamente** os destinos selecionados — nunca um que não foi escolhido | FR-015 |
| Q2 | A ordem vem de `PROVIDER_ORDER`, nunca desta projeção nem da tela | Invariante P1 (007) |
| Q3 | Seleção vazia devolve lista vazia; **o painel não some** — quem trata o vazio é a superfície, com o convite de FR-015a | FR-015a |
| Q4 | Com um único destino, `solo` é `true` e a nota de ordem relativa não é exibida | Borda da spec |

**Não é uma segunda fonte de ordem.** É projeção de `destinations.selected`, e a única
autoridade sobre ordem continua sendo `PROVIDER_ORDER`.

---

## 3. Linha de apoio da trilha (alteração de regra existente)

**Onde vive**: `src/domain/rail/index.ts` — módulo existente, com duas mudanças.

### Mudança 1 — a guarda de estado sai

```diff
-if (state !== 'done') return { kind: 'neutral' };
```

A regra passa a ser uma só: **deriva quando há valor decidido, fica neutra quando não
há**. `done`, `current` e `pending` recebem o mesmo tratamento (FR-028). O parâmetro
`state` deixa de ser lido por `supportFor`.

### Mudança 2 — o `RailSnapshot` ganha um campo

```diff
 export interface RailSnapshot {
   readonly current: WizardStep;
   readonly destinations: readonly ProviderId[];
   readonly lineCount: number;
   readonly credentialsReady: boolean;
+  /** Execuções encerradas — com desfecho, qualquer que seja ele. */
+  readonly servicesFinished: number;
 }
```

**Por quê**: com a guarda removida, derivar a etapa Serviço de `destinations.length`
faria a trilha dizer "2 serviços concluídos" no instante em que o segundo destino é
marcado — uma afirmação falsa, exatamente o que FR-029 proíbe. O valor decidido da etapa
Serviço não é quantos destinos existem; é quantos serviços terminaram. Ver
[`research.md` §R7](./research.md).

### Mudança 3 — a fonte da etapa Destinos

`src/app/StepRail.tsx:142` monta o `RailSnapshot` com `destinations: queue.order`. A
`ExecutionQueue` só é construída por `buildQueue()`, chamada em
`src/features/input/InputActionBar.tsx:28` — isto é, **ao sair da etapa Entrada**. Enquanto
a etapa Destinos é a corrente, `queue.order` está vazia.

Sob a regra da 007 isso era invisível: só degrau concluído derivava, e a etapa Destinos
concluída sempre vinha depois da fila construída. Com FR-028, a linha precisa derivar
**com a etapa Destinos corrente** (AC-4 da US6), e a fila ainda não existe nesse instante.

A fonte passa a ser a seleção viva:

```diff
 const rail = composeRail({
   current,
-  destinations: queue.order,
+  destinations: destinations.selected,
   lineCount: lines.length,
   credentialsReady: Object.values(credentials).some((c) => c !== null),
+  servicesFinished: runsInOrder(queue).filter(isFinished).length,
 });
```

**Não é uma segunda fonte de ordem.** `destinations.selected` já é mantido ordenado por
`orderSelection` em `src/domain/run/selection.ts:58`, pela mesma `PROVIDER_ORDER` de que
`buildQueue` deriva. Depois de `lockSelection`, os dois valores coincidem.

### Tabela resultante

| Etapa | Neutra (sem valor decidido) | Derivada (com valor) | Condição para derivar |
| --- | --- | --- | --- |
| `credential` | "Suas credenciais" | "Preferências salvas" | `credentialsReady` |
| `destinations` | texto neutro de descrição | os destinos escolhidos, unidos por `listAnd` | `destinations.length > 0` |
| `input` | "Cole a lista de músicas" | a quantidade de linhas coladas | `lineCount > 0` |
| `service` | "Criação e resultado" | quantos serviços concluíram | `servicesFinished > 0` |
| `summary` | texto neutro | — | nunca deriva |

Os textos exatos, com o nó do arquivo de design que os produz, estão no inventário.

---

## 4. Estado da conta no cartão de destino

**Não é entidade nova.** É uma função dos dois estados que a store já mantém, calculada
na superfície:

| `credentials[p]` | `sessions[p]` | Estado | Linha secundária |
| --- | --- | --- | --- |
| `null` | — | `no-credential` | motivo do bloqueio + atalho para a Configuração |
| presente | `null` | `pending-auth` | diz **quando** a autorização acontece — ao executar aquele serviço |
| presente | presente | `connected` | nomeia a conta conectada |

É a mesma derivação de três estados que `ConnectionChip` já faz, com o mesmo nome de
estados. A diferença é o que cada estado escreve, e a exigência nova é a de FR-021a: os
três ocupam a **mesma altura**.

---

## 5. Inventário de divergências

**Onde vive**: `tests/fixtures/design-inventory.json` — dado versionado, lido apenas por
teste. Esquema normativo em [`contracts/text-inventory.md`](./contracts/text-inventory.md).

```ts
interface InventoryEntry {
  /** Nome da tela no arquivo de design, ex.: "Importador · Destinos". */
  readonly tela: string;
  /** Id do nó no arquivo de design. Rastreabilidade, não usado pelo teste. */
  readonly no: string;
  /** O texto exatamente como o arquivo o contém. */
  readonly design: string;
  readonly desfecho: 'adotado' | 'mantido-diferente';
  /** Caminho pontilhado em `t`, ex.: "rail.neutral.credential". Só em `adotado`. */
  readonly chave?: string;
  /** Valores de interpolação, quando o template os exige. */
  readonly amostra?: Readonly<Record<string, string | number>>;
  /** Forma plural a usar, quando a chave é um par `One`/`Other`. */
  readonly plural?: number;
  /** Obrigatório em `mantido-diferente`. */
  readonly motivo?: string;
}
```

### Regras

| Regra | Enunciado | Requisito |
| --- | --- | --- |
| I1 | Todo item tem `chave` (se `adotado`) ou `motivo` (se `mantido-diferente`); nenhum tem os dois ausentes | FR-030a |
| I2 | Todo item `adotado` resolve para uma chave **existente** em `t` | FR-030b |
| I3 | O template resolvido com `amostra` é **idêntico** à string `design` | FR-030b, SC-001 |
| I4 | O inventário cobre as quatorze telas do arquivo, não apenas as citadas no pedido | FR-030 |
| I5 | O inventário **não** cobre forma — composição, espaçamento, alinhamento ficam no checklist manual | Premissa da spec |

---

## 6. O que esta feature deliberadamente não modela

- **Nenhuma chave de armazenamento.** Nada novo é coletado nem persistido; o primeiro
  nome é recortado do mesmo `displayName` que o chip de conexão já exibe.
- **Nenhuma mudança em `src/domain/run/machine.ts`.** As fases, as transições e os
  invariantes do ciclo permanecem literalmente idênticos. A tabela de fases da §1 é uma
  **leitura** da fase corrente, nunca uma escrita.
- **Nenhuma mudança em `ProviderCapabilities`.** A cor de marca e o substrato tingido
  entram como mapas de literais indexados por `ProviderId` nas superfícies que os
  consomem, como `BRAND_INK` já faz — não como capacidade do provedor, porque não são
  diferença de comportamento.
