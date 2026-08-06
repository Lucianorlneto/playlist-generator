# Fase 1 — Modelo de Dados

**Feature**: 002-multi-service-playlists · **Data**: 2026-08-05

Entidades da spec traduzidas em tipos. Tudo aqui vive em `src/domain/` e é puro: sem rede, sem DOM, sem armazenamento, sem relógio ambiente (Princípio III). O que a 001 já definiu é reaproveitado; **as mudanças estão marcadas**.

---

## 1. Provedor

```ts
export type ProviderId = 'spotify' | 'youtube';

/** Ordem de execução e de exibição — fixa, definida pelo produto (FR-015). */
export const PROVIDER_ORDER: readonly ProviderId[] = ['spotify', 'youtube'];

export interface QuotaModel {
  /** Orçamento padrão do provedor. Nunca informado pelo usuário (FR-029). */
  dailyBudget: number;
  costs: {
    search: number;
    enrich: number;
    listPlaylists: number;
    createPlaylist: number;
    addItem: number;
  };
  /** Fuso em que o provedor vira o dia da cota (FR-030). */
  resetTimeZone: string;
  /** Folga sobre o custo nominal na estimativa (research §3). */
  safetyMargin: number;
}

export interface ProviderCapabilities {
  /** `false` obriga reautorização explícita (FR-035). YouTube: false. */
  canRefreshSilently: boolean;
  /** `null` quando o provedor não impõe orçamento diário. Spotify: null. */
  quota: QuotaModel | null;
  /** Itens por requisição de adição. Spotify: 100 · YouTube: 1 (research §9). */
  batchSize: number;
  /** `false` esconde o campo de álbum e mostra canal (FR-024). YouTube: false. */
  showsAlbum: boolean;
  /** Limiares de confiança calibrados por catálogo (FR-023). */
  thresholds: { confident: number; uncertain: number };
}
```

**Serviço de Destino** (entidade da spec) é a projeção de `ProviderId` + `ProviderCapabilities` + estado de credencial + estado de sessão. Não existe como registro persistido: é derivado.

**Invariante P1**: `PROVIDER_ORDER` é a única fonte de ordem, na fila e no seletor. Nenhuma tela ordena por conta própria (FR-015, Assumption da spec).

**Invariante P2**: todo provedor com `quota !== null` precisa aparecer **depois** de todos os de `quota === null` em `PROVIDER_ORDER` (FR-015, segunda frase). Verificado por teste.

---

## 2. Credencial de Serviço

```ts
export interface Credential {
  clientId: string;
}
```

**Sem mudança de forma** — muda o armazenamento: uma chave por provedor (`tp.v2.credential.{provider}`).

**Invariante C1**: nenhum campo de segredo, em nenhum provedor (FR-004, Princípio II). O tipo é a primeira barreira; o teste de `src/` é a segunda.

**Invariante C2**: "cadastrada" ≡ existe valor não vazio após `trim()`. Nenhuma validação remota (FR-007).

**Invariante C3**: remover a credencial de um provedor não alcança nenhuma chave de outro (FR-006). Garantido por construção: o repositório recebe o `ProviderId` e só conhece a chave daquele provedor.

---

## 3. Sessão por provedor

```ts
export interface ProviderUser {
  id: string;
  /** Compõe o caminho efetivo (FR-027); cai para `id` quando vier vazio. */
  displayName: string;
}

export interface ProviderSession {
  provider: ProviderId;
  accessToken: string;
  /** `null` quando o fluxo do provedor não emite refresh token (YouTube). */
  refreshToken: string | null;
  expiresAt: number;
  scopes: string[];
  user: ProviderUser;
}
```

**Mudança em relação à 001**: `Session` ganha `provider` e `refreshToken` passa a admitir `null`.

**Invariante S1**: `refreshToken === null` ⇒ expiração exige reautorização explícita; nunca é tratada como erro (FR-035, Princípio I).

**Invariante S2**: encerrar a sessão de um provedor apaga apenas a chave dele — credencial, rascunho e a sessão do outro sobrevivem (FR-036, Princípio de armazenamento).

**Registro de autorização em voo** (efêmero, `sessionStorage`):

```ts
export interface AuthRequest {
  provider: ProviderId;
  state: string;
  /** Presente só nos provedores que usam PKCE (Spotify). */
  codeVerifier?: string;
  createdAt: number;
}
```

---

## 4. Seleção de Destinos

```ts
export interface DestinationSelection {
  /** Subconjunto de PROVIDER_ORDER, sempre nessa ordem. */
  selected: ProviderId[];
  /** Trava após o início da primeira criação (FR-012). */
  locked: boolean;
}
```

**Invariante D1**: `selected ⊆ { p | credencial de p cadastrada }` (FR-009). Remover credencial remove o provedor da seleção no mesmo instante (FR-006).

**Invariante D2**: valor inicial = **exatamente** o conjunto de provedores com credencial cadastrada (FR-010, SC-003).

**Invariante D3**: `selected.length ≥ 1` para avançar (FR-011).

**Invariante D4**: `locked === true` ⇒ nenhuma alteração de `selected`; o único caminho é descartar o rascunho explicitamente (FR-012).

---

## 5. Linha de entrada — fonte única compartilhada

```ts
export interface InputLine {
  id: string;
  index: number;
  raw: string;
  title: string;
  artist: string;
  featuredArtists: string[];
  parseStatus: ParseStatus;
}
```

**Sem mudança de forma.** Muda o papel: `lines` é **uma só** para todos os serviços, e correções de texto na revisão de um serviço a reescrevem (FR-014).

**Invariante L1**: `id` é estável durante toda a sessão de trabalho e é a chave que liga a linha às execuções de cada serviço.

**Invariante L2**: correção de texto altera `title`/`artist`/`featuredArtists`; **nunca** `raw`, `id` nem `index` — a lista de não encontradas continua copiável no texto original (`001/FR-040`).

---

## 6. Candidata

```ts
export interface TrackCandidateRaw {
  uri: string;                 // Spotify: `spotify:track:…` · YouTube: videoId
  id: string;
  title: string;
  artists: string[];           // YouTube: [channelTitle]
  /** Vazio nos provedores com `showsAlbum: false` — nunca exibido (FR-024). */
  album: string;
  durationMs: number;
  coverUrl: string | null;     // capa (Spotify) ou miniatura (YouTube)
  externalUrl: string;
  /** Só em provedores de vídeo: nome do canal, exibido no lugar do álbum. */
  channel?: string;
  /** Indícios de versão diferente (FR-025). Vazio quando não há nenhum. */
  versionHints?: VersionHint[];
}

export type VersionHint =
  | 'live' | 'cover' | 'remix' | 'acoustic' | 'karaoke' | 'instrumental'
  | 'sped_up' | 'slowed' | 'nightcore' | 'mashup' | 'tribute' | 'remaster'
  | 'excerpt' | 'reaction' | 'duration_outlier';
```

**Mudança em relação à 001**: três campos opcionais (`channel`, `versionHints`) e a reinterpretação de `artists` para canal. `album` continua existindo no tipo, mas é **string vazia** no YouTube e nunca renderizado quando `showsAlbum === false`.

**Invariante K1**: nenhuma tela lê `album` sem consultar `capabilities.showsAlbum` (FR-024). Verificado por teste de componente.

**Invariante K2**: `versionHints.length > 0` ⇒ o item não pode ser classificado `confident` (research §7, FR-025).

---

## 7. Item de correspondência

```ts
export interface MatchItem {
  line: InputLine;
  status: MatchStatus;
  candidates: TrackCandidate[];   // no máximo 5
  selectedUri: string | null;
  included: boolean;              // padrão `true` só para `confident` (FR-023)
  duplicateOf: string | null;
  error: string | null;
  previousStatus: MatchStatus | null;
}
```

**Sem mudança de forma.** Muda a titularidade: `MatchItem[]` deixa de ser global e passa a pertencer a uma `ServiceRun`.

**Invariante M1**: seleção, inclusão, exclusão e escolha de candidata **não** atravessam serviços (FR-014, SC-013).

---

## 8. Execução por Serviço

```ts
export type RunPhase =
  | 'pending' | 'connect' | 'estimate' | 'search' | 'review'
  | 'creating' | 'done' | 'skipped' | 'failed';

export type RunOutcome = 'completed' | 'partial' | 'failed' | 'skipped';

export interface ServiceRun {
  provider: ProviderId;
  phase: RunPhase;
  /** Subconjunto ordenado dos ids da fonte única, efetivamente usado (FR-013). */
  lineIds: string[];
  items: MatchItem[];
  /** Cópia imutável das linhas no momento da conclusão (FR-037, SC-018). */
  frozenLines: InputLine[] | null;
  estimate: QuotaEstimate | null;
  creation: CreationProgress | null;
  result: CreationResult | null;
  outcome: RunOutcome | null;
  /** Causa provável + próximo passo, já resolvidos por i18n (FR-046). */
  error: AppErrorInfo | null;
}
```

**Invariante R1** (subconjunto): para índices `i < j` na fila, `runs[j].lineIds ⊆ runs[i].lineIds` (FR-013). Validado por função pura antes de qualquer redução.

**Invariante R2** (imutabilidade): `outcome !== null` ⇒ `lineIds`, `items`, `frozenLines` e `result` nunca mais mudam (FR-037, SC-018).

**Invariante R3** (desfecho, sem limiar percentual — FR-040):

| Condição | `outcome` |
| --- | --- |
| playlist criada **e** todos os itens confirmados entraram | `completed` |
| playlist criada **e** faltou item confirmado | `partial` |
| nenhuma playlist criada | `failed` |
| usuário encerrou antes de confirmar a criação | `skipped` |

**Invariante R4** (isolamento): nenhuma transição de uma `ServiceRun` altera outra (FR-021, SC-007).

**Invariante R5**: `lineIds.length === 0` ⇒ o serviço é apresentado como pulado, não iniciado (caso de borda "redução que deixa a lista vazia").

---

## 9. Fila de Execução

```ts
export interface ExecutionQueue {
  order: ProviderId[];           // derivada de PROVIDER_ORDER ∩ selected
  currentIndex: number;          // -1 antes de começar
  runs: Record<ProviderId, ServiceRun>;
}
```

**Invariante Q1**: no máximo uma `ServiceRun` com `phase` fora de `{pending, done, skipped, failed}` (FR-016).

**Invariante Q2**: `runs[i+1]` só sai de `pending` depois de `runs[i]` ter `outcome !== null` (FR-016).

**Invariante Q3**: nenhuma autorização é solicitada a um provedor cuja `phase` ainda é `pending` (FR-017, SC-005).

**Invariante Q4**: `order.length === 1` ⇒ nenhuma indicação de fila e nenhuma tela de resumo (FR-018, FR-040).

---

## 10. Estimativa de Orçamento e Registro de Consumo Diário

```ts
export interface QuotaEstimate {
  provider: ProviderId;
  lineCount: number;
  selectedCount: number;
  /** Custo nominal já com a margem de segurança aplicada. */
  estimatedUnits: number;
  /** dailyBudget − consumptionToday. */
  availableUnits: number;
  /** `true` bloqueia o início do destino (FR-029). */
  blocked: boolean;
  /** Quantas linhas caberiam no saldo — alimenta a saída "reduzir a lista". */
  maxLinesThatFit: number;
}

export interface DailyConsumption {
  provider: ProviderId;
  /** Dia civil no fuso do provedor, `YYYY-MM-DD` (FR-030). */
  ptDate: string;
  units: number;
}
```

**Invariante O1**: `availableUnits` **nunca** é consultado ao provedor — é sempre inferido de `dailyBudget − units` (FR-029, Assumption da spec).

**Invariante O2**: `ptDate` diferente do dia corrente no fuso do provedor ⇒ `units` vale 0 (FR-030). Registro ausente ou corrompido ⇒ também 0 (caso de borda explícito).

**Invariante O3**: `blocked === true` ⇒ **nenhuma** requisição de busca é emitida àquele provedor (SC-008, SC-011).

**Invariante O4**: a mensagem de bloqueio declara que o cálculo parte do orçamento padrão (FR-029). Ver a nota de conflito FR-029/FR-034 × SC-008 em [plan.md](./plan.md#divergências-internas-da-spec).

---

## 11. Progresso e resultado da criação

```ts
export interface CreationProgress {
  playlistId: string;
  playlistUrl: string;
  orderedUris: string[];
  /** Do provedor: 100 (Spotify) ou 1 (YouTube). */
  batchSize: number;
  /** Renomeado de `committedBatches` — agora conta **itens** (research §9). */
  committedItems: number;
  failedAt: number | null;
}

export interface CreationResult {
  provider: ProviderId;
  playlistId: string;
  playlistUrl: string;
  playlistName: string;
  effectivePath: string;
  addedCount: number;
  skippedCount: number;
  failedLines: string[];
  /** `true` quando a execução foi encerrada por esgotamento de cota (FR-032). */
  incompleteByQuota: boolean;
}
```

**Mudança em relação à 001**: `committedBatches` → `committedItems` (contagem em itens, com `batchSize` do provedor); `provider` e `incompleteByQuota` novos.

**Invariante N1**: `committedItems` só incrementa após resposta de sucesso, e é gravado de forma **síncrona** (SC-010, Princípio V).

**Invariante N2**: a retomada nunca cria uma segunda playlist — parte sempre de `playlistId` (SC-010).

**Invariante N3**: `incompleteByQuota === true` ⇒ o sistema **não** remove a playlist e o relato adverte sobre o bloqueio de nome duplicado numa nova tentativa (FR-032).

---

## 12. Rascunho de Trabalho (estendido)

```ts
export interface WorkDraft {
  schemaVersion: 2;
  savedAt: number;
  step: WizardStep;
  rawText: string;
  lines: InputLine[];
  playlistConfig: PlaylistConfig;
  destinations: DestinationSelection;
  queue: ExecutionQueue;
}

export type WizardStep =
  'credential' | 'destinations' | 'input' | 'service' | 'summary';
```

**Invariante W1**: o rascunho **não contém** token, Client ID nem qualquer segredo (Princípio V, `001/FR-043`). Garantido pela serialização campo a campo.

**Invariante W2** (apagamento): o rascunho é apagado **apenas** após sucesso ou por ação explícita de descarte (Princípio V, literal). Uma execução encerrada por esgotamento de cota **preserva** o rascunho. Ver a divergência com a redação atual de FR-038 em [plan.md](./plan.md#divergências-internas-da-spec).

**Invariante W3** (retomada): a restauração volta ao provedor e à etapa exatos (FR-039), com o resultado dos serviços já concluídos intacto (SC-014).

**Invariante W4** (legado): rascunho `schemaVersion: 1` é migrado para `destinations: { selected: ['spotify'], locked: … }` com uma única `ServiceRun` do Spotify na etapa gravada, sem aviso além do banner de recuperação (FR-042).

---

## 13. Resumo Consolidado

```ts
export interface ConsolidatedSummary {
  entries: {
    provider: ProviderId;
    outcome: RunOutcome;
    playlistUrl: string | null;
    accountLabel: string;      // em qual conta a playlist foi criada (FR-036)
    addedCount: number;
    skippedCount: number;
    failedLines: string[];
    lineCount: number;
  }[];
  /** `true` quando os destinos receberam listas diferentes (FR-040, SC-018). */
  listsDiverged: boolean;
  /** `raw` das linhas removidas para destinos posteriores. */
  removedForLater: string[];
}
```

**Invariante U1**: derivado **só** de `ExecutionQueue` — nenhum estado próprio, nenhuma persistência adicional.

**Invariante U2**: `listsDiverged === true` ⇒ o resumo declara a divergência e informa quantas linhas cada serviço recebeu (FR-040, SC-018).

**Invariante U3**: exibido apenas quando `order.length > 1` (FR-040).

---

## Rastreabilidade — entidade da spec → tipo

| Entidade (spec §Key Entities) | Tipo | Onde vive |
| --- | --- | --- |
| Serviço de Destino | `ProviderId` + `ProviderCapabilities` | `src/domain/providers.ts` |
| Credencial de Serviço | `Credential` (por provedor) | `src/domain/types.ts` |
| Seleção de Destinos | `DestinationSelection` | `src/domain/run/` |
| Fila de Execução | `ExecutionQueue` | `src/domain/run/` |
| Execução por Serviço | `ServiceRun` | `src/domain/run/` |
| Estimativa de Orçamento | `QuotaEstimate` | `src/domain/quota/` |
| Registro de Consumo Diário | `DailyConsumption` | `src/domain/quota/` |
| Rascunho de Trabalho (estendido) | `WorkDraft` v2 | `src/domain/types.ts` |
| Resumo Consolidado | `ConsolidatedSummary` | `src/domain/run/` |
