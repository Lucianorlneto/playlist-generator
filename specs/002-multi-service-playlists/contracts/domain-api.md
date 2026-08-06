# Contrato — API dos módulos de domínio (puros)

**Feature**: 002-multi-service-playlists · **Estende**: `001/contracts/domain-api.md`

Tudo aqui é função determinística de entrada para saída: sem rede, sem DOM, sem armazenamento, sem relógio ambiente (Princípio III). Onde o tempo importa, `now: number` é parâmetro.

---

## 1. `src/domain/providers.ts` — capacidades como dados

```ts
export type ProviderId = 'spotify' | 'youtube';
export const PROVIDER_ORDER: readonly ProviderId[];
export function capabilitiesOf(id: ProviderId): ProviderCapabilities;
/** Interseção com PROVIDER_ORDER, preservando a ordem fixa (FR-015). */
export function orderSelection(selected: ProviderId[]): ProviderId[];
```

---

## 2. `src/domain/quota/` — estimativa e saldo

```ts
/** Dia civil no fuso do provedor, `YYYY-MM-DD` (FR-030). */
export function providerDay(now: number, timeZone: string): string;

/** Consumo válido hoje; 0 quando o registro é de outro dia, ausente ou corrompido. */
export function consumptionToday(
  record: DailyConsumption | null, now: number, timeZone: string,
): number;

/** Custo nominal em unidades, sem margem (research §3). */
export function nominalCost(
  model: QuotaModel, lineCount: number, selectedCount: number,
): number;

/** Estimativa completa, já com margem, saldo e decisão de bloqueio (FR-029). */
export function estimateQuota(input: {
  model: QuotaModel; lineCount: number; selectedCount: number;
  record: DailyConsumption | null; now: number;
}): QuotaEstimate;

/** Maior N que cabe no saldo — alimenta a saída "reduzir a lista". */
export function maxLinesThatFit(model: QuotaModel, availableUnits: number): number;

/** Soma o custo de uma operação ao registro, virando o dia quando preciso. */
export function addConsumption(
  record: DailyConsumption | null, units: number, now: number, timeZone: string,
): DailyConsumption;
```

**Propriedades verificadas**: `estimateQuota` é monotônica em `lineCount`; `blocked === true` ⟺ `estimatedUnits > availableUnits`; `providerDay` cruza corretamente a virada do horário de verão nos dois sentidos.

---

## 3. `src/domain/versionHints/` — indícios de versão diferente (FR-025)

```ts
export function lexicalHints(title: string): VersionHint[];

/** `['duration_outlier']` quando o desvio passa de 25% da mediana. */
export function durationHint(durationMs: number, medianMs: number): VersionHint[];

export function versionHints(
  title: string, durationMs: number, candidateDurations: number[],
): VersionHint[];

/** Limpa decorações de título antes de pontuar (research §7). */
export function stripDecorations(title: string): string;
```

**Propriedades**: `stripDecorations` é idempotente; `lexicalHints` respeita fronteira de palavra (não marca "Livermore" como `live`) e ignora acentuação e caixa.

---

## 4. `src/domain/scoring/` — pontuação por provedor

```ts
/** Mantida da 001, agora com o candidato já normalizado pelo adaptador. */
export function scoreCandidate(line: InputLine, track: TrackCandidateRaw): number;

/** Bônus de canal canônico (` - Topic`, `VEVO`) — research §7. */
export function channelBonus(channelTitle: string): number;

/** Classificação com os limiares do provedor; rebaixa por indício de versão. */
export function classifyFor(
  score: number,
  thresholds: { confident: number; uncertain: number },
  hints: VersionHint[],
): ScoredStatus;
```

**Invariante**: `hints.length > 0` ⇒ `classifyFor` nunca devolve `'confident'` (FR-025, research §7).

---

## 5. `src/domain/run/` — fila, ciclo e resumo

```ts
export function buildQueue(selected: ProviderId[], lineIds: string[]): ExecutionQueue;

export type RunEvent =
  | { type: 'authorized' }        | { type: 'estimate_ok' }
  | { type: 'estimate_blocked' }  | { type: 'search_done' }
  | { type: 'review_confirmed' }  | { type: 'created'; result: CreationResult }
  | { type: 'quota_exhausted' }   | { type: 'skipped' }
  | { type: 'failed'; error: AppErrorInfo };

/** Redutor puro do ciclo de um serviço. */
export function reduceRun(run: ServiceRun, event: RunEvent): ServiceRun;

/** Avança a fila; congela a execução encerrada (`frozenLines`) — FR-037. */
export function advanceQueue(queue: ExecutionQueue, lines: InputLine[]): ExecutionQueue;

/** Desfecho pelos critérios de FR-040, sem limiar percentual. */
export function outcomeOf(run: ServiceRun): RunOutcome;

/** Validação de FR-013: só remoção, nunca acréscimo nem alteração. */
export function isSubsetOf(previous: string[], next: string[]): boolean;

/** Aplica correção de texto à fonte única, sem tocar em execuções concluídas (FR-014). */
export function applyTextCorrection(
  lines: InputLine[], lineId: string, patch: { title?: string; artist?: string },
): InputLine[];

export function buildSummary(queue: ExecutionQueue): ConsolidatedSummary;
```

**Propriedades verificadas**:

- `reduceRun` nunca produz dois serviços fora de `pending` simultaneamente (Q1).
- `advanceQueue` só libera o próximo quando o anterior tem `outcome !== null` (Q2).
- `reduceRun` sobre uma execução com `outcome !== null` é **identidade** (R2).
- `buildSummary(q).listsDiverged` ⟺ existem duas execuções com `lineIds` de tamanhos diferentes (SC-018).
- `applyTextCorrection` não altera `raw`, `id` nem `index` (L2).

---

## 6. `src/domain/batching/` — generalizado

```ts
/** `batchSize` passa a vir do provedor: 100 (Spotify) ou 1 (YouTube). */
export function partition(uris: string[], batchSize: number): string[][];

/** Itens ainda não confirmados, a partir de `committedItems`. */
export function remainingItems(progress: CreationProgress): string[][];
```

**Mudança em relação à 001**: a contagem passa de lotes para **itens** (`committedItems`), o que mantém a retomada exata com qualquer `batchSize` (research §9).

---

## 7. `src/domain/validation/` — acréscimos

```ts
/** FR-002: ao menos uma credencial cadastrada para sair da configuração. */
export function validateAtLeastOneCredential(
  credentials: Record<ProviderId, Credential | null>,
): ValidationResult;

/** FR-011: ao menos um destino selecionado. */
export function validateSelection(selection: DestinationSelection): ValidationResult;

/** FR-013: redução válida (subconjunto) para um destino posterior. */
export function validateReduction(previous: string[], next: string[]): ValidationResult;
```

`ValidationReason` ganha: `'no_credential'`, `'no_destination'`, `'selection_locked'`, `'not_a_subset'`, `'quota_blocked'`.

Toda `ValidationResult` continua carregando **chave de mensagem**, nunca texto (Princípio de idioma).
