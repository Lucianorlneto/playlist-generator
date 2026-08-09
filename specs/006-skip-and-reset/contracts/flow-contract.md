# Contrato — saída de fluxo e descarte

**Feature**: 006-skip-and-reset

Este contrato é sobre transições de estado. O contrato de apresentação está em
[ui-contract.md](./ui-contract.md).

---

## §1 — `exitAfterSkip(queue, provider) → FlowExit`

**Assinatura**

```ts
function exitAfterSkip(queue: ExecutionQueue, provider: ProviderId): FlowExit;
```

**Pré-condições**: `provider` pertence a `queue.order`. A fila é a de **antes**
do pulo.

**Pós-condições**: exatamente um dos três construtores, sempre (E1). Nenhum
efeito colateral (E2).

**Tabela de verdade completa** — é o contrato, e V0 a percorre inteira.

| Fila (`order`) | Índice do pulado | Desfechos dos demais | Resultado |
| --- | --- | --- | --- |
| `[spotify]` | 0 | — | `discard` |
| `[spotify, youtube]` | 0 | youtube `pending` | `next: youtube` |
| `[spotify, youtube]` | 1 | spotify `skipped` | `discard` |
| `[spotify, youtube]` | 1 | spotify `completed` | `summary` |
| `[spotify, youtube]` | 1 | spotify `partial` | `summary` |
| `[spotify, youtube]` | 1 | spotify `failed` | `summary` |

**Casos que a tabela deixa explícitos de propósito**:

- pular o **primeiro** de dois nunca devolve `summary` nem `discard`, mesmo que
  nada tenha rodado — a posição vence o desfecho (regra 1 antes da 2);
- `partial` e `failed` contam como "rodou". A fronteira de FR-003 é
  `outcome !== 'skipped'`, não "deu certo".

## §2 — `hasWork(work, options?) → boolean`

**Assinatura**

```ts
function hasWork(work: WorkShape, options?: { queueCounts?: boolean }): boolean;
```

| Estado | `hasWork(w)` | `hasWork(w, { queueCounts: true })` |
| --- | --- | --- |
| tudo vazio, fila vazia | `false` | `false` |
| tudo vazio, `order: ['spotify']` | `false` | `true` |
| `rawText: 'a - b'`, fila vazia | `true` | `true` |
| `lines: [1 linha]` | `true` | `true` |
| execução com `items.length > 0` | `true` | `true` |
| execução com `creation !== null` | `true` | `true` |

**Compatibilidade obrigatória**: `restoreDraft` passa a chamar `hasWork(draft)`
**sem** `queueCounts`. O comportamento observável da restauração não pode mudar
— `draft-recovery.spec.ts` e `draft-after-quota.spec.ts` passam sem edição.

## §3 — `skipService(provider)`

**Sequência contratada**, nesta ordem (S1, S2):

| # | Passo | Observável |
| --- | --- | --- |
| 1 | `cancelSearch()` | `AbortController.signal.aborted === true` se havia busca |
| 2 | `exit = exitAfterSkip(queue, provider)` | nenhum |
| 3 | `dispatchRun({ type: 'skipped' }, provider)` | `outcome === 'skipped'` |
| 4 | `advance()` | `currentIndex` avança; `stepToken` incrementa |
| 5 | aplica `exit` | etapa final |

**Garantias**

- **G1 — nenhuma escrita**: `skipService` não emite requisição a provedor
  algum. Verificado por V7, que conta requisições no MSW.
- **G2 — destino encerrado é imutável**: `dispatchRun` sobre execução já
  encerrada é identidade (R2, já garantido por `reduceRun`). Pular duas vezes
  em sequência não avança a fila duas vezes, porque o segundo `advance` encontra
  a execução seguinte ainda aberta e não anda (Q2).
- **G3 — o relato anterior sobrevive**: nada em `skipService` toca `frozenLines`,
  `result` ou `outcome` de execução encerrada (FR-010).
- **G4 — sem confirmação embutida**: a ação nunca abre diálogo (S3).

**Estado final por `exit`**

| `exit.kind` | `step` | `queue.currentIndex` | Trabalho |
| --- | --- | --- | --- |
| `next` | `service` | `+1` | preservado |
| `summary` | `summary` | `order.length` | preservado |
| `discard` | `destinations` | `-1` (fila zerada) | descartado, rascunho apagado |

## §4 — Descarte

O descarte de `exit.kind === 'discard'` **é** `resetWork()`. Não é um caminho
paralelo. Consequências herdadas, todas já verificadas por testes existentes:

| Herdado de `resetWork`/`blankWork` | Requisito |
| --- | --- |
| zera `rawText`, `lines`, `playlistConfig`, `queue`, `destinations` | FR-016 |
| **não** toca `credentials` nem `sessions` | FR-018 |
| `clearDraft()` **depois** do `set()` | FR-017 |
| `reconcileDestinations()` restaura o padrão derivado das credenciais | invariante D2 |
| leva a `step: 'destinations'` | FR-004, FR-016 |

**Acréscimo desta feature**: `cancelSearch()` antes do `set()` (FR-022).

## §5 — Rede

**Zero hosts novos.** A lista fechada permanece nos 6 da constituição v1.1.0.
Nenhum escopo novo, nenhum parâmetro de requisição novo. `no-secrets.spec.ts`
passa **sem edição**.

Esta feature só **reduz** tráfego: cancela buscas que hoje seguem até o fim
depois de o usuário ter desistido ([research §5](./research.md), §6).

## §6 — Persistência

`SCHEMA_VERSION` inalterado. Nenhum campo novo. Nenhuma migração. `WorkDraft`
idêntico ao da 004.

Um rascunho gravado antes desta feature restaura sem qualquer tratamento
especial — inclusive um gravado com a fila esgotada (`currentIndex ===
order.length`), que hoje restaura para a tela em branco de
[research §2](./research.md). Depois desta feature esse estado deixa de ser
produzível, mas o já gravado continua restaurando para a etapa `service` com
`ServiceStep` devolvendo `null`.

**Decisão**: não tratar. Alcançar aquele estado exigia clicar no botão do beco
sem saída e fechar a aba na tela em branco, sem nada digitado depois. O botão de
recomeço, que passa a existir no cabeçalho, é a saída — e é justamente o caso
que FR-013 cobre. Criar migração para um estado transitório de uma versão que
nunca foi publicada seria complexidade sem beneficiário.
