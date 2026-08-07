# Data Model — Busca Sem Separador e por Título Isolado

**Feature**: `003-flexible-search` · **Data**: 2026-08-06 · **Fase**: 1

Só o que **muda**. Entidades da 001 e 002 não citadas aqui permanecem exatamente como estão em `specs/002-multi-service-playlists/data-model.md`.

---

## 1. `InputLine` — ganha a forma declarada

```ts
export type LineShape = 'explicit' | 'free';

export interface InputLine {
  id: string;
  index: number;
  raw: string;
  /** `explicit`: lado esquerdo do corte. `free`: a linha inteira normalizável. */
  title: string;
  /** Sempre `''` quando `shape === 'free'` — a forma livre não declara artista. */
  artist: string;
  featuredArtists: string[];
  /** Nova. Determina como a linha é consultada (§6) e pontuada (§2, §3). */
  shape: LineShape;
  parseStatus: ParseStatus;
}
```

**Regras de derivação** (`src/domain/parser/`, puro):

| Entrada                          | `shape`    | `title`             | `artist`   | `parseStatus` |
| -------------------------------- | ---------- | ------------------- | ---------- | ------------- |
| `Zoio de Lula - Charlie Brown Jr` | `explicit` | `Zoio de Lula`      | `Charlie Brown Jr` | `parsed` |
| `nao sei viver sem ter voce cpm 22` | `free`  | linha inteira       | `''`       | `parsed`      |
| `Não sei viver sem ter voce`     | `free`     | linha inteira       | `''`       | `parsed`      |
| `- Artista` (lado esquerdo vazio) | `free`    | `Artista`           | `''`       | `parsed`      |
| `---`, `3.`, `🎵`                 | `free`     | `''`                | `''`       | `unparsed`    |

**Invariante L1**: `shape === 'free' ⟹ artist === '' && featuredArtists.length === 0`. A forma livre não extrai nada — extrair exigiria o corte que §1 recusa a adivinhar.

**Invariante L2**: `parseStatus === 'unparsed' ⟺ normalizeText(raw) === ''`. É o **único** gatilho de invalidez restante (FR-004). Substitui a regra de `001/FR-015`.

**Invariante L3**: `raw` continua byte a byte o texto original, em todas as formas (`001/FR-041`).

---

## 2. `MatchItem` — ganha o motivo de atenção

```ts
export type AttentionReason =
  | 'no_artist_ambiguous'   // sem artista confirmado e sem candidata dominante (§5)
  | 'version_hint'          // indício de versão diferente (002/FR-025)
  | 'not_found'             // busca não trouxe nada utilizável
  | 'retry_skipped_quota';  // retentativa não feita: reserva esgotada (§8)

export interface MatchItem {
  // … campos existentes inalterados …
  /** `null` quando o item não exige atenção (`confident` limpo). */
  attentionReason: AttentionReason | null;
}
```

**Invariante M1**: `status === 'confident' ⟹ attentionReason === null`. Um item confiante por definição não pede olhar humano.

**Invariante M2**: `attentionReason === 'retry_skipped_quota' ⟹ status === 'not_found'`, mas a recíproca é falsa. É a distinção que FR-017 exige: o `status` diz o desfecho, o motivo diz a causa — e a causa muda o que o usuário deve fazer.

**Invariante M3**: a precedência é fixa e determinística quando mais de um motivo caberia: `retry_skipped_quota` > `not_found` > `version_hint` > `no_artist_ambiguous`. Sem ordem fixa, o motivo exibido dependeria da ordem de avaliação, e o teste seria frágil.

---

## 3. `ProviderCapabilities` — ganha a margem solo

```ts
thresholds: {
  confident: number;
  uncertain: number;
  /** Nova. Distância mínima da 2ª candidata p/ linha sem artista (§5). */
  soloMargin: number;
}
```

| Provedor | `confident` | `uncertain` | `soloMargin` (semente) |
| -------- | ----------- | ----------- | ---------------------- |
| Spotify  | 0,82        | 0,55        | **0,10**               |
| YouTube  | 0,88        | 0,55        | **0,12**               |

`soloMargin` é valor de calibração, fixado contra a lista de referência estendida. Piso: `SC-010`. Teto: `SC-004`. Ver research §5.

---

## 4. `QuotaEstimate` — ganha a reserva de retentativa

```ts
export interface QuotaEstimate {
  // … campos existentes inalterados …
  /** Linhas elegíveis a retentativa (§6). É o teto de execução de FR-010a. */
  retryReserve: number;
}
```

**Invariante O4** (nova, junta-se às O1–O3 da 002): o número de retentativas emitidas em uma execução **nunca** excede `retryReserve`. É o que torna `SC-007` verdadeiro por construção, e não por folga de margem.

**Invariante O5**: `retryReserve` é função apenas do texto das linhas — determinística, calculável antes de qualquer requisição, e idêntica se recalculada.

---

## 5. `ServiceRun` — ganha o consumo da reserva

```ts
export interface ServiceRun {
  // … campos existentes inalterados …
  /** Retentativas já emitidas nesta execução. Nunca > estimate.retryReserve. */
  retriesUsed: number;
}
```

Persistido no rascunho: uma execução retomada após recarga não pode reiniciar o contador e gastar a reserva duas vezes.

---

## 6. `WorkDraft` — esquema v3

`SCHEMA_VERSION: 2 → 3`. Nada além da versão muda na forma do rascunho; o que muda é a forma de `InputLine`, `MatchItem` e `ServiceRun` **dentro** dele.

**Migração v2→v3** (`src/services/storage/migrations.ts`, ver [contracts/storage.md](./contracts/storage.md)):

| Campo             | Regra                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| `line.shape`      | `parseStatus === 'parsed'` → `'explicit'`. `'unparsed'` → **reanalisar `raw`** sob as novas regras.      |
| `line.parseStatus` | Recalculado por L2. Linhas antes inválidas por falta de separador voltam **válidas**.                   |
| `item.attentionReason` | Derivado do `status` gravado: `not_found` → `'not_found'`; `uncertain` com `versionHints` → `'version_hint'`; `uncertain` sem → `'no_artist_ambiguous'`; `confident` → `null`. |
| `run.retriesUsed` | `0`. A execução retomada não sabe quantas retentativas gastou; zerar é conservador na direção errada — ver nota. |
| `estimate.retryReserve` | Recalculado a partir das linhas, nunca lido do v2 (O5 garante que dá o mesmo valor).             |

**Nota sobre `retriesUsed = 0` na migração**: um rascunho v2 pode ter gastado cota com o fallback antigo, e zerar o contador permite que a execução retomada gaste a reserva inteira de novo. O consumo real fica registrado no Registro de Consumo Diário (`quotaRepo`), que **não** é migrado e continua correto — então o saldo do dia já reflete o gasto anterior, e a estimativa da retomada parte dele. O risco é de superestimar o que ainda cabe, nunca de estourar o orçamento sem aviso.

**Invariante W3** (junta-se a W1/W2 da 002): o rascunho continua sem token e sem Client ID. Nenhum campo novo desta feature carrega credencial.

---

## 7. Rastreabilidade

| Requisito | Entidade / invariante                                       |
| --------- | ------------------------------------------------------------ |
| FR-001    | L2 — invalidez restrita a texto sem conteúdo alfanumérico     |
| FR-002    | `LineShape`, L1                                               |
| FR-004    | L2                                                            |
| FR-007    | `shape === 'explicit'` → consulta por campos                  |
| FR-008    | `shape === 'free'` → texto livre                              |
| FR-009    | O5 — elegibilidade determinística                             |
| FR-010    | `QuotaEstimate.retryReserve`                                  |
| FR-010a   | O4, `ServiceRun.retriesUsed`                                  |
| FR-012    | research §2 — renormalização                                  |
| FR-013    | research §3 — cobertura combinada                             |
| FR-014    | `thresholds.soloMargin`                                       |
| FR-014b   | §5 — candidata única → `uncertain`                            |
| FR-016    | M1                                                            |
| FR-017    | `AttentionReason`, M2, M3                                     |
| FR-020    | research §9 — chave unificada                                 |
| FR-021    | `shape === 'explicit'` mantém a fórmula atual (SC-011)        |
| SC-007    | O4                                                            |
