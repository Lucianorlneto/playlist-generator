# Contrato: módulos de domínio (puros)

**Feature**: `001-text-to-playlist` | **Fase**: 1

Assinaturas dos módulos sem I/O. São puros, determinísticos e testáveis sem navegador nem rede — é onde vive a maior parte das regras da spec e, portanto, a maior parte dos testes.

---

## `domain/parser`

```ts
parseInput(rawText: string): InputLine[]
```

Divide, limpa e extrai título/artista. Descarta linhas vazias, remove prefixos de numeração, reconhece `-`, `–`, `—`, `by`, usa o **último** separador da linha, extrai `feat.`/`ft.`/`com` como artistas secundários.

- Determinística; `index` sequencial na ordem do texto (FR-019).
- Nunca lança: linha irreconhecível vira `parseStatus: 'unparsed'` (FR-015).
- Cobre FR-012 a FR-014 e os edge cases de numeração, hífen no título e múltiplos artistas.

```ts
parseLine(raw: string, index: number, id: string): InputLine
```

Mesma lógica para uma única linha — usada na re-busca por linha (FR-017).

---

## `domain/normalize`

```ts
normalizeText(input: string): string
stripPromoSuffixes(title: string): string
```

Pipeline de research §6: NFD + remoção de diacríticos, minúsculas pt-BR, remoção de sufixos promocionais, colapso de pontuação e espaços.

**Invariante testável**: `remix`, `live`/`ao vivo`, `acoustic`, `remaster` **não** são removidos — são variantes de gravação, não ruído.

---

## `domain/scoring`

```ts
scoreCandidate(line: InputLine, track: TrackCandidateRaw): number   // 0..1
classify(score: number): 'confident' | 'uncertain' | 'not_found'
```

`score = 0,6 × sim(título) + 0,4 × melhor sim(artista)`, com bônus de 0,05 para artista secundário confirmado. Limiares em **`domain/scoring/thresholds.ts`** — arquivo único, calibrável contra a fixture de referência sem tocar na lógica.

**Testes de contrato**: caso de acento, caso de caixa, caso de sufixo promocional, caso de artista errado com título idêntico (deve ficar abaixo de 0,82), e o dataset `tests/fixtures/reference-50.json` que verifica SC-002 (≥ 90% de Confiantes corretas).

---

## `domain/dedupe`

```ts
markDuplicates(items: MatchItem[]): MatchItem[]
```

Duas passagens (research §7): chave `{título}|{artista}` normalizados e, depois, `selectedUri` repetido. Primeira ocorrência intacta; seguintes com `duplicateOf` preenchido e `included = false` (FR-018). **Não reordena** (FR-019).

---

## `domain/batching`

```ts
buildOrderedUris(items: MatchItem[]): string[]
chunk<T>(items: T[], size: number): T[][]
remainingBatches(progress: CreationProgress): string[][]
```

`buildOrderedUris` filtra `included === true` preservando `line.index`. `remainingBatches` devolve apenas os lotes a partir de `committedBatches` — é a função que garante SC-009 (retomada sem duplicar nem faltar).

---

## `domain/validation`

```ts
validatePlaylistName(name: string, existing: string[]): ValidationResult
canCreate(items: MatchItem[], config: PlaylistConfig, existing: string[]): ValidationResult
```

Aplica, nesta ordem, as quatro regras de [data-model.md](../data-model.md#playlistconfig): nome não vazio após `trim` (FR-028), nome não duplicado ignorando caixa e espaços de borda (FR-029), ao menos uma faixa incluída (FR-035), verificação de nomes concluída com sucesso.

`ValidationResult` carrega a chave da mensagem em pt-BR e o próximo passo sugerido (FR-042).

---

## `services/rate-limiter` (sem rede, mas com relógio)

```ts
createLimiter(opts: { ratePerSecond: number; burst: number; concurrency: number }): Limiter
limiter.run<T>(fn: () => Promise<T>, signal: AbortSignal): Promise<T>
```

Token bucket (5 req/s, rajada 10) + pool de concorrência 4. Respeita `Retry-After` em 429. **`AbortSignal` interrompe inclusive durante a espera de backoff** — requisito direto de FR-026 e SC-011.

Testado com relógio falso do Vitest: vazão sustentada, respeito ao `Retry-After`, e cancelamento durante a espera.
