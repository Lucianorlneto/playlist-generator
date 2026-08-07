# Contrato — Módulos puros novos e alterados

**Feature**: `003-flexible-search` · **Fase**: 1

Assinaturas do domínio afetado. Tudo aqui é puro: sem rede, sem DOM, sem armazenamento, sem relógio ambiente (Princípio III).

---

## 1. `src/domain/parser/` — alterado

```ts
export function parseLine(raw: string, index: number, id: string): InputLine;
export function parseInput(rawText: string): InputLine[];
```

Assinaturas **inalteradas**. Muda o contrato de saída:

- devolve `shape: 'explicit'` quando há corte pelo último separador com os dois lados não vazios;
- devolve `shape: 'free'` em qualquer outro caso, com `title` = linha inteira (após prefixo de numeração e espaços de borda), `artist: ''`, `featuredArtists: []`;
- `parseStatus: 'unparsed'` **apenas** quando `normalizeText(raw) === ''`.

**Nunca lança** — garantia preservada de `001/FR-015`.

---

## 2. `src/domain/normalize/` — acrescido

```ts
/** Termos da linha e do candidato, já normalizados. Reexporta `tokenize`. */
export function tokenSet(input: string): string[];

/** Igualdade tolerante a erro de digitação: `levenshteinRatio ≥ 0,85`. */
export function tokensMatch(a: string, b: string): boolean;

/** |A ∩ B| / |A| com igualdade tolerante. `0` quando `A` é vazio. */
export function coverage(subject: string[], against: string[]): number;
```

`coverage` é **assimétrica** de propósito (research §3): `coverage(L, T)` mede quanto de `L` está em `T`, não o contrário.

---

## 3. `src/domain/scoring/` — acrescido e alterado

```ts
/** Fórmula da 001, para `shape === 'explicit'`. Inalterada (SC-011). */
export function scoreCandidate(line: InputLine, track: TrackCandidateRaw): number;

/** Cobertura combinada por média harmônica, para `shape === 'free'` (§3). */
export function scoreCombined(line: InputLine, track: TrackCandidateRaw): number;

/** `|A ∩ L| / |A| ≥ 0,6` — a linha reivindicou o artista da candidata? (§4) */
export function artistClaimed(line: InputLine, track: TrackCandidateRaw): boolean;

/**
 * Pontuação final por forma, incluindo o reparo de falso corte (§7):
 * `explicit` abaixo do piso é reavaliada por `scoreCombined`, prevalecendo a maior.
 */
export function scoreForShape(
  line: InputLine,
  track: TrackCandidateRaw,
  uncertainThreshold: number,
): number;
```

### Classificação com margem

```ts
export interface SoloThresholds {
  confident: number;
  uncertain: number;
  soloMargin: number;
}

/**
 * Classificação de uma linha **inteira**, a partir das candidatas já ordenadas.
 *
 * Substitui `classifyFor` como ponto de entrada do runner: a margem exige
 * conhecer a segunda candidata, o que uma função de pontuação isolada não vê.
 */
export function classifyLine(
  line: InputLine,
  candidates: readonly TrackCandidate[],
  thresholds: SoloThresholds,
): { status: ScoredStatus; attentionReason: AttentionReason | null };
```

**Regras que `classifyLine` materializa**:

1. Sem candidata → `not_found`.
2. `hasDeclaredArtist` = `shape === 'explicit' && artist !== ''`, **ou** `shape === 'free' && artistClaimed(line, melhor)`.
3. Se `hasDeclaredArtist`: comportamento idêntico ao de hoje (`classifyFor`), incluindo o rebaixamento por indício de versão.
4. Se não: `confident` exige `melhor.score ≥ confident` **e** `melhor.score − segunda.score ≥ soloMargin`. Candidata única → `uncertain` (FR-014b).
5. **Em ambos os ramos**, o rebaixamento por indício de versão da invariante K2 se aplica: qualquer indício rebaixa `confident` → `uncertain`, independentemente da pontuação e da margem (FR-015, `002/FR-025`). A regra vale para as **três formas de linha** — não só para a explícita. Um indício de versão em linha sem artista declarado é, se algo, mais grave: não há artista para desempatar entre a gravação oficial e o cover.
6. `attentionReason` segue a precedência M3 do data-model.

`classifyFor` e `classify` permanecem exportadas e inalteradas — os testes de referência da 001 e 002 dependem delas.

---

## 4. `src/domain/retry/` — novo

```ts
/** Consulta emitida a um catálogo, já na forma que o adaptador enviará. */
export interface QueryPlan {
  /** Consulta primária. Fielded no Spotify, texto livre no YouTube. */
  primary: string;
  /** Consulta de retentativa, ou `null` quando não haveria uma diferente. */
  retry: string | null;
}

/**
 * `retry === null` quando a alternativa normalizada é igual à primária (§6).
 * É o que impede que a retentativa custe cota sem poder trazer resultado novo.
 */
export function planQueries(
  line: InputLine,
  buildPrimary: (line: InputLine) => string,
  buildRetry: (line: InputLine) => string,
  fieldedPrimary: boolean,
): QueryPlan;

/** Quantas linhas da lista são elegíveis a retentativa. Alimenta O4/O5. */
export function retryReserveFor(
  lines: readonly InputLine[],
  buildPrimary: (line: InputLine) => string,
  buildRetry: (line: InputLine) => string,
  fieldedPrimary: boolean,
): number;
```

`fieldedPrimary: true` (Spotify) marca a primária como estruturalmente diferente do texto livre — sempre elegível, sem comparar strings. `false` (YouTube) compara `normalizeText(primary)` com `normalizeText(retry)`.

---

## 5. `src/domain/quota/` — alterado

```ts
export function nominalCost(
  model: QuotaModel,
  lineCount: number,
  selectedCount: number,
  retryReserve?: number,   // novo, padrão 0
): number;

export function estimateQuota(input: EstimateInput & { retryReserve: number }): QuotaEstimate;
```

Fórmula atualizada (research §8):

```text
100·N + 100·R + ceil(5·N / 50)·1 + 1 + 50 + 50·S
```

`maxLinesThatFit` continua usando a **mesma** medida do bloqueio, agora com `R` estimado proporcionalmente a `N` na busca binária — senão a tela diria "cabem 60 linhas" e o bloqueio reapareceria ao reduzir para 60, que é o laço que `002/FR-029` existe para evitar.

`retryReserve` omitido ou `0` reproduz **exatamente** a fórmula atual — é o que mantém `tests/unit/quota.spec.ts` válido para os casos existentes.

---

## 6. `src/domain/dedupe/` — alterado

```ts
/** `normalizeText(textoPesquisável)`. Unifica as formas (§9, FR-020). */
export function inputKey(item: MatchItem): string;
```

Assinatura inalterada; muda a chave produzida. `markDuplicates` permanece idêntica, inclusive a segunda passagem por `uri`.

**Ponto de atenção**: a guarda atual `key !== '|'` some junto com o separador da chave. A guarda passa a ser `key !== ''`, alinhada a L2.

---

## 7. `src/services/providers/searchRunner.ts` — alterado (I/O, não domínio)

```ts
export interface ProviderSearchDeps {
  // … campos existentes …
  /** Consulta alternativa da linha. Ausente = provedor não retenta. */
  retryLine?: (line: InputLine, signal?: AbortSignal) => Promise<TrackCandidateRaw[]>;
  /** Teto de retentativas da execução (O4). Ausente = ilimitado (Spotify). */
  retryBudget?: number;
}
```

Responsabilidades acrescidas ao runner:

- decidir a retentativa **só** quando a primeira não trouxe candidata acima do piso `uncertain` **e** a linha é elegível (§6) **e** há orçamento;
- decrementar o orçamento de forma sequencialmente consistente — a decisão não pode ser tomada em paralelo por várias linhas e estourar o teto;
- marcar `attentionReason: 'retry_skipped_quota'` na linha que teria retentado e não pôde;
- delegar a classificação a `classifyLine` em vez de `classifyFor`.

A garantia de que a falha de uma linha não aborta as demais, e a de cancelamento a qualquer momento, permanecem inalteradas.
