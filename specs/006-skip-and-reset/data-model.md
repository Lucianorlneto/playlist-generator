# Fase 1 — Modelo de dados

**Feature**: 006-skip-and-reset

**Resumo em uma linha**: nenhuma entidade nova, nenhum campo persistido novo,
`SCHEMA_VERSION` inalterado. Esta feature acrescenta **duas funções puras** e
uma **ação de store**, e conserta a ordem de duas ações existentes.

---

## §1 — `FlowExit` — valor derivado, não estado

```ts
export type FlowExit =
  | { kind: 'next'; provider: ProviderId }
  | { kind: 'summary' }
  | { kind: 'discard' };
```

Vive em `src/domain/run/exit.ts`. **Não é armazenado em lugar nenhum** — nem no
store, nem no rascunho. É calculado sob demanda a partir da fila, que já é a
fonte da verdade de tudo que ele precisa saber.

**Invariante E1 — totalidade**: para qualquer fila com pelo menos um destino,
`exitAfterSkip` devolve exatamente um dos três. Não há `null`, não há quarto
caso. É o que garante que nenhum pulo termina em tela indefinida — o defeito de
[research §2](./research.md).

**Invariante E2 — pureza**: a função não lê relógio, rede, DOM nem
armazenamento. Duas chamadas sobre a mesma fila devolvem o mesmo valor, que é o
que permite à interface consultá-la para decidir se confirma e à ação
consultá-la de novo para navegar, sem risco de divergirem.

### Regra de decisão

```ts
export function exitAfterSkip(queue: ExecutionQueue, provider: ProviderId): FlowExit
```

`provider` é o destino que **está sendo** pulado; a fila passada é a de **antes**
do pulo.

| Ordem | Condição | Resultado |
| --- | --- | --- |
| 1 | existe destino em `order[indexOf(provider) + 1]` | `{ kind: 'next', provider: aquele }` |
| 2 | algum destino da fila tem `outcome !== null && outcome !== 'skipped'` | `{ kind: 'summary' }` |
| 3 | caso contrário | `{ kind: 'discard' }` |

A ordem importa: a regra 1 é sobre **posição**, as regras 2 e 3 sobre
**desfecho**. Um destino anterior concluído não impede que o pulo do primeiro de
dois vá para o segundo.

**Por que `outcome` e não `phase`**: `phase` de execução encerrada é derivada e
não separa "falhou depois de criar a playlist" de "falhou antes". `outcome`
separa — `partial` contra `failed` —, e FR-003 se apoia exatamente na fronteira
"chegou a rodar". A fronteira é `outcome !== 'skipped'`, com `null` (nunca
iniciado) contando como não-rodado.

**Invariante E3 — coerência com Q2**: no momento em que o último destino é
pulado, todos os anteriores já têm `outcome !== null`, porque a fila só anda
quando a execução corrente encerra (invariante Q2 de `queue.ts`). A regra 2 não
precisa tratar destino anterior em andamento — ele não existe.

## §2 — `hasWork` — o predicado único de "há o que descartar"

```ts
export interface WorkShape {
  rawText: string;
  lines: readonly InputLine[];
  queue: ExecutionQueue;
}

export function hasWork(work: WorkShape, options?: { queueCounts?: boolean }): boolean
```

Vive em `src/domain/work.ts`. Extraído do predicado embutido em
`restoreDraft.ts:26`, que passa a chamá-lo ([research §9](./research.md)).

| Termo | Conta como trabalho |
| --- | --- |
| `rawText.trim() !== ''` | sempre |
| `lines.length > 0` | sempre |
| execução com `items.length > 0` ou `creation !== null` | sempre |
| `queue.order.length > 0` | **só** com `queueCounts: true` |

**Por que o parâmetro**: a restauração e o botão fazem a mesma pergunta com
fronteiras diferentes, e essa diferença é real, não um detalhe de chamada. Um
rascunho gravado com fila montada e nada mais não vale restaurar — não há nada
a devolver ao usuário. Mas um usuário que escolheu destinos e avançou **tem**
algo a descartar, e esconder o botão dele seria o oposto de FR-013.

Uma alternativa seria duas funções. Recusada: duas definições de "há trabalho"
que discordassem em silêncio produziriam exatamente o defeito que a extração
existe para evitar. Um parâmetro com nome explícito mantém a diferença visível
no ponto de chamada.

## §3 — `skipService` — a ação única

```ts
skipService: (provider: ProviderId) => void
```

Nova ação do `runSlice`. Substitui as seis sequências espalhadas hoje
([research §4](./research.md)). Faz, nesta ordem:

1. `cancelSearch()` — aborta o que estiver em voo (FR-011);
2. calcula `exit = exitAfterSkip(queue, provider)`;
3. `dispatchRun({ type: 'skipped' }, provider)`;
4. `advance()`;
5. aplica o `exit`:
   - `next` → nada além do que `advance` já fez; a etapa continua `service` e o
     `stepToken` incrementado por `advance` move o foco;
   - `summary` → `goToStep('summary')`;
   - `discard` → `resetWork()`, que já leva a `destinations`.

**Invariante S1 — a ordem 1→3 não é negociável**: cancelar depois de despachar
deixaria uma janela em que a busca ainda escreve progresso sobre uma execução
encerrada. Cancelar é a primeira coisa.

**Invariante S2 — o cálculo antes do despacho**: `exitAfterSkip` precisa da fila
**antes** do pulo, porque a regra 2 pergunta se algum destino rodou e o próprio
destino pulado passaria a contar como `skipped` no meio do caminho. Calcular
depois daria a mesma resposta por acidente na maioria dos casos — e a errada na
fila de um destino.

**Invariante S3 — `skipService` não confirma**: a confirmação de FR-005 é da
interface, não da ação. A ação executa. Quem chama consulta `exitAfterSkip`
antes e decide se abre o diálogo. Pôr `window.confirm` dentro de uma ação de
store a tornaria não testável sem forjar global e misturaria decisão de
apresentação com transição de estado.

## §4 — Ações existentes que mudam de comportamento

| Ação | Mudança | Motivo |
| --- | --- | --- |
| `advance()` | incrementa `stepToken` | FR-024; o foco não se movia entre serviços ([research §7](./research.md)) |
| `resetWork()` | aborta a busca antes de zerar | FR-022; o controlador era largado sem abortar ([research §6](./research.md)) |
| `discardDraft()` | idem | mesmo defeito, mesmo conserto |

Em `resetWork` e `discardDraft` o aborto entra **antes** do `set()`, e o
`clearDraft()` continua **depois** — a ordem existente está correta e o
comentário que a justifica permanece válido ([research §10](./research.md)).

## §5 — O que **não** muda

| Item | Estado |
| --- | --- |
| `SCHEMA_VERSION` | inalterado |
| Forma de `WorkDraft` | inalterada — nenhum campo novo persistido |
| `ServiceRun`, `ExecutionQueue`, `RunPhase`, `RunOutcome` | inalterados |
| `RunEvent` | inalterado — nenhum evento novo; `skipped` já existe e basta |
| `reduceRun` | **intocado** |
| `advanceQueue`, `buildQueue`, `reduceUpcoming` | intocados |
| `buildSummary` | intocado |
| Hosts, escopos, parâmetros de requisição | inalterados |

`reduceRun` ficar intocado é o resultado que mais importa: o defeito nunca
esteve no redutor. Ele já encerrava a execução corretamente. O que faltava era
alguém agir sobre esse encerramento — e `run-machine.spec.ts` deve passar sem
edição.

## §6 — Fluxo de estado, ponta a ponta

```text
usuário aciona "Pular o {serviço}"
        │
        ├─ exitAfterSkip(queue, provider)
        │        │
        │        ├─ kind === 'discard' ──► abre diálogo de confirmação
        │        │                              │
        │        │                              ├─ recusa ──► fim, nada muda
        │        │                              └─ confirma ─┐
        │        └─ demais ──────────────────────────────────┤
        │                                                    ▼
        └──────────────────────────────────────────► skipService(provider)
                                                             │
                        cancelSearch → skipped → advance ────┤
                                                             ▼
                            next ──► etapa `service`, foco no cabeçalho
                            summary ► goToStep('summary')
                            discard ► resetWork() ──► etapa `destinations`
```

```text
usuário aciona "Recomeçar"  (cabeçalho, visível se hasWork(..., queueCounts))
        │
        └─ abre diálogo ──┬─ recusa ──► fim, nada muda
                          └─ confirma ─► resetWork()
                                          │
                                cancelSearch → blankWork → clearDraft
                                          ▼
                                   etapa `destinations`
```
