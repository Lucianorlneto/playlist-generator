# Contrato — Busca, Erros de Sessão e Cota

**Feature**: `specs/004-youtube-reconnect` · **Fase 1**

Delta sobre `002/contracts/provider-contract.md`. O que não está aqui não muda.

---

## §1. `PlaylistProvider.search` devolve `SearchOutcome`

**Antes**

```ts
search(lines: InputLine[], ctx: SearchContext): Promise<MatchItem[]>;
```

**Depois**

```ts
search(lines: InputLine[], ctx: SearchContext): Promise<SearchOutcome>;

interface SearchOutcome {
  items: MatchItem[];          // um por linha, ordem original, sempre completo
  interruption: AppError | null; // não-nulo ⟹ execução interrompida por falha de sessão
}
```

### Obrigações do implementador

| # | Obrigação |
| --- | --- |
| P1 | `items.length === lines.length`, **sempre**, interrompida ou não |
| P2 | `items[i]` corresponde a `lines[i]` — a concorrência está na execução, não no resultado |
| P3 | linha não buscada sai `pending`; nunca `not_found` |
| P4 | `interruption !== null` ⟹ nenhuma requisição nova foi emitida após a detecção |
| P5 | `interruption` é sempre um `AppError` com `isSessionLevel(e) === true` |
| P6 | cancelamento externo (`ctx.signal`) ⟹ `interruption === null` — cancelar não é perder sessão |

P6 é a tradução literal de FR-008. Sem ela, cancelar durante uma sessão já morta abriria modal de reconexão para quem pediu para parar.

### Propagação

`runProviderSearch` é a única implementação real; ambos os adaptadores a chamam. Os chamadores mudam assim:

- `matchRunner.runMatching` → devolve `SearchOutcome`, aplicando `markDuplicates` sobre `items`;
- `matchRunner.matchLine` → continua devolvendo `MatchItem`, lendo `outcome.items[0]`; se `interruption !== null`, **lança** — a re-busca de uma linha na revisão é uma ação pontual do usuário, e propagar o erro é o que faz o `LineEditor` mostrar falha em vez de "não encontrada" silenciosa;
- `ServiceStep` → ver §3.

---

## §2. `isSessionLevel`

```ts
// src/services/providers/errors.ts
export function isSessionLevel(error: AppError): boolean;
```

Verdadeira **exatamente** para `kind ∈ { 'reauth_required', 'session_expired' }`.

| Obrigação | |
| --- | --- |
| E1 | Lista fechada e afirmativa. `kind` novo desconhecido ⟹ `false` (erra para "falha de linha", o comportamento de hoje) |
| E2 | `quota_exhausted` ⟹ `false`. A precedência de cota é estrutural, não desempate ([research §12](../research.md)) |
| E3 | Genérica, sem `ProviderId` — a regra é uma só para os dois catálogos |

`youtube/errors.ts:isItemLevel` permanece como está (código morto desde a 002) e **não** é usada por esta feature: misturar remoção de código morto com mudança de comportamento tornaria a regressão mais difícil de localizar.

---

## §3. Isolamento de falha no `searchRunner`

A regra que muda, e é o coração da feature:

> **Falha de linha vira item. Falha de sessão derruba a execução.**

```text
searchOne captura erro
  ├─ isAbortError      → relança (inalterado)
  ├─ isSessionLevel    → relança  ◄── NOVO
  └─ qualquer outro    → vira LineOutcome.error (inalterado)
```

| # | Obrigação |
| --- | --- |
| S1 | A primeira falha de sessão registra a interrupção e aborta um `AbortController` **interno**, encadeado a `ctx.signal` |
| S2 | Linhas ainda não emitidas nunca viram requisição (FR-006, SC-007) |
| S3 | Linhas em voo caem no caminho de cancelamento existente e voltam `pending` |
| S4 | Uma interrupção por execução, mesmo com N linhas falhando juntas (FR-007) |
| S5 | Se `ctx.signal.aborted` no momento de consolidar, o desfecho é cancelamento e `interruption` fica `null` (FR-008) |
| S6 | `enrich` roda apenas sobre candidatas de linhas resolvidas; interrupção não o dispara |

---

## §4. Cota: `401` não consome

`http.ts` registra consumo assim que a resposta chega, antes de olhar o status. A premissa ("a resposta chegou, logo o provedor contabilizou") é **falsa para `401`**: requisição rejeitada por credencial inválida não é cobrada.

| # | Obrigação |
| --- | --- |
| Q1 | `response.status === 401` ⟹ `recordConsumption` **não** é chamado |
| Q2 | Todos os demais status continuam registrando, inclusive `403` e `5xx` |
| Q3 | Verificado por teste que mede o registro após N linhas com `401` — hoje grava `100·N` unidades fantasma |

Sem Q1, o usuário reconecta e pode ser barrado por esgotamento de um orçamento que não gastou — o conserto viraria uma segunda parede, e SC-008 seria falso.

---

## §5. Custo da retomada

Uma fonte única alimenta o que é **dito** e o que é **feito**:

```ts
remainingLineIds(run) // src/domain/run/lines.ts, pura
```

- **Dito** (FR-013): custo = `nominalCost` sobre `N = |remainingLineIds(run)|` e `R = retryReserveOf(provider, essas linhas)`, sem componente de criação;
- **Feito** (FR-013b): a retomada busca exatamente `linesFor(lines, remainingLineIds(run))`.

| # | Obrigação |
| --- | --- |
| C1 | Nenhuma fórmula nova — `nominalCost` aplicada ao subconjunto |
| C2 | Consumo total (interrompida + retomada) ≤ consumo de uma execução ininterrupta (FR-013c) |
| C3 | `run.retriesUsed` continua descontado da reserva, como hoje |
| C4 | Provedor sem orçamento diário não exibe custo algum — não há o que dizer |

---

## §6. Nada muda na superfície de rede

| # | Obrigação |
| --- | --- |
| N1 | **Zero hosts novos.** A lista fechada do Princípio II permanece em 6 |
| N2 | **Zero escopos novos.** Reconectar pede o mesmo que conectar |
| N3 | **Zero parâmetros novos** em qualquer requisição |
| N4 | `tests/unit/no-secrets.spec.ts` deve passar **sem edição** — se quebrar, a implementação saiu do contrato |
