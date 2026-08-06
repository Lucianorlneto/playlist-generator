/**
 * Entidades de data-model.md como tipos discriminados.
 *
 * Este módulo é puro: sem rede, sem DOM, sem armazenamento. Tudo o que a
 * aplicação sabe sobre o **formato** dos dados começa aqui — inclusive as
 * entidades cuja lógica vive em `src/domain/run/` e `src/domain/quota/`. A
 * separação é deliberada e já era a da 001 (`CreationProgress` mora aqui,
 * `batching/` opera sobre ele): um único lugar declara as formas, e cada módulo
 * declara as funções que as manipulam. Sem isso, `WorkDraft` — que referencia
 * quase todas — criaria um ciclo entre `types.ts`, `run/` e `quota/`.
 */

import type { ProviderId } from './providers';

/** Versão do esquema serializado em disco (002/contracts/storage.md). */
export const SCHEMA_VERSION = 2;

// ---------------------------------------------------------------------------
// Credencial e sessão
// ---------------------------------------------------------------------------

/**
 * Client ID informado pelo usuário. Note a ausência deliberada de qualquer campo
 * de segredo: o tipo é a primeira barreira contra o Princípio II (invariante C1).
 */
export interface Credential {
  clientId: string;
}

export interface ProviderUser {
  id: string;
  /** Compõe o caminho efetivo (FR-027); cai para `id` quando vier vazio. */
  displayName: string;
}

export interface ProviderSession {
  provider: ProviderId;
  accessToken: string;
  /**
   * `null` quando o fluxo do provedor não emite refresh token (YouTube). A
   * ausência é **dado**, não erro: expirar exige reautorização explícita e isso
   * é comportamento previsto da interface (FR-035, invariante S1).
   */
  refreshToken: string | null;
  /** Epoch ms: `Date.now() + expires_in * 1000` no momento da resposta. */
  expiresAt: number;
  scopes: string[];
  user: ProviderUser;
}

/**
 * Registro de autorização em voo, vivo apenas entre a ida e a volta do
 * consentimento. `codeVerifier` só existe nos provedores que usam PKCE.
 */
export interface AuthRequest {
  provider: ProviderId;
  state: string;
  codeVerifier?: string;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------

export type ParseStatus = 'parsed' | 'unparsed';

export interface InputLine {
  /** Estável durante toda a sessão de trabalho; liga a linha às execuções. */
  id: string;
  /** Base 0, na ordem do texto original. Nunca reordenado. */
  index: number;
  /** Texto original, sem alterações — é o que se copia na lista de falhas (FR-041). */
  raw: string;
  title: string;
  artist: string;
  /** Extraídos de `feat.` / `ft.` / `com`; reforçam a pontuação. */
  featuredArtists: string[];
  parseStatus: ParseStatus;
}

// ---------------------------------------------------------------------------
// Correspondência
// ---------------------------------------------------------------------------

/** Indícios de que a candidata é outra versão da faixa (FR-025, research §8). */
export type VersionHint =
  | 'live'
  | 'cover'
  | 'remix'
  | 'acoustic'
  | 'karaoke'
  | 'instrumental'
  | 'sped_up'
  | 'slowed'
  | 'nightcore'
  | 'mashup'
  | 'tribute'
  | 'remaster'
  | 'excerpt'
  | 'reaction'
  | 'duration_outlier';

/** Faixa (ou vídeo) do catálogo antes de receber a pontuação local. */
export interface TrackCandidateRaw {
  /** Spotify: `spotify:track:…` · YouTube: o `videoId`. */
  uri: string;
  id: string;
  title: string;
  /** YouTube: `[channelTitle]` — não há artista no catálogo de vídeo. */
  artists: string[];
  /** Vazio nos provedores com `showsAlbum: false`; nunca exibido (FR-024). */
  album: string;
  durationMs: number;
  /** Capa (Spotify) ou miniatura (YouTube); `null` quando não há. */
  coverUrl: string | null;
  externalUrl: string;
  /** Só em provedores de vídeo: exibido no lugar do álbum (FR-024). */
  channel?: string;
  /** Vazio quando não há indício algum (FR-025). */
  versionHints?: VersionHint[];
}

export interface TrackCandidate extends TrackCandidateRaw {
  /** 0 a 1, sempre calculado localmente — a ordem da plataforma não é verdade. */
  score: number;
}

export type MatchStatus =
  'pending' | 'searching' | 'confident' | 'uncertain' | 'not_found' | 'unparsed' | 'discarded';

/** Os três status que a pontuação pode produzir (contracts/domain-api.md). */
export type ScoredStatus = Extract<MatchStatus, 'confident' | 'uncertain' | 'not_found'>;

export interface MatchItem {
  line: InputLine;
  status: MatchStatus;
  /** No máximo 5, ordenadas por `score` decrescente (FR-023). */
  candidates: TrackCandidate[];
  /** Deve constar em `candidates`; `null` quando nada foi escolhido. */
  selectedUri: string | null;
  /** Entra na playlist. Padrão `true` só para `confident` (FR-023). */
  included: boolean;
  /** `id` da primeira `InputLine` com a mesma chave; força `included = false`. */
  duplicateOf: string | null;
  /** Falha de busca daquela linha; não aborta as demais. */
  error: string | null;
  /** Estado anterior a `discarded`, para permitir a reinclusão. */
  previousStatus: MatchStatus | null;
}

// ---------------------------------------------------------------------------
// Playlist
// ---------------------------------------------------------------------------

export interface PlaylistConfig {
  /** Obrigatório após `trim()`. Só espaços conta como vazio. */
  name: string;
  description: string;
  /** Padrão `false` — privada (FR-026). */
  isPublic: boolean;
}

export type WizardStep = 'credential' | 'destinations' | 'input' | 'service' | 'summary';

export const WIZARD_STEPS: readonly WizardStep[] = [
  'credential',
  'destinations',
  'input',
  'service',
  'summary',
];

export interface CreationProgress {
  /** Playlist já criada — a retomada nunca cria outra (invariante N2). */
  playlistId: string;
  playlistUrl: string;
  /** Congelado no início; fonte da ordem e do particionamento. */
  orderedUris: string[];
  /** Do provedor: 100 (Spotify) ou 1 (YouTube). */
  batchSize: number;
  /**
   * **Itens** confirmados — não lotes. Só incrementa após resposta de sucesso e
   * é gravado de forma síncrona: é o que impede duplicação na retomada com
   * qualquer `batchSize` (SC-010, invariante N1, research §9).
   */
  committedItems: number;
  /** Índice do **item** em que a adição parou, ou `null` se nada falhou. */
  failedAt: number | null;
}

export interface CreationResult {
  provider: ProviderId;
  playlistId: string;
  playlistUrl: string;
  playlistName: string;
  /** Texto real do provedor, nunca inventado (FR-027). */
  effectivePath: string;
  addedCount: number;
  /** Descartadas + duplicatas + não incluídas. */
  skippedCount: number;
  /** `line.raw` dos não encontrados, na ordem original (FR-041). */
  failedLines: string[];
  /** `true` quando a execução foi encerrada por esgotamento de cota (FR-032). */
  incompleteByQuota: boolean;
}

// ---------------------------------------------------------------------------
// Erro já resolvido para exibição (FR-046)
// ---------------------------------------------------------------------------

/**
 * Causa provável e próximo passo, já resolvidos por i18n, mais o serviço a que
 * pertencem. Vive no domínio como forma serializável para poder entrar no
 * rascunho sem arrastar a camada de textos (invariante E1).
 */
export interface AppErrorInfo {
  provider: ProviderId;
  kind: string;
  title: string;
  cause: string;
  nextStep: string;
}

// ---------------------------------------------------------------------------
// Seleção de destinos (data-model §4)
// ---------------------------------------------------------------------------

export interface DestinationSelection {
  /** Subconjunto de `PROVIDER_ORDER`, sempre nessa ordem (invariante D1). */
  selected: ProviderId[];
  /** Trava após o início da primeira criação (FR-012, invariante D4). */
  locked: boolean;
}

// ---------------------------------------------------------------------------
// Cota (data-model §10)
// ---------------------------------------------------------------------------

export interface QuotaEstimate {
  provider: ProviderId;
  lineCount: number;
  selectedCount: number;
  /** Custo nominal já com a margem de segurança aplicada. */
  estimatedUnits: number;
  /** `dailyBudget − consumptionToday`; nunca consultado ao provedor (O1). */
  availableUnits: number;
  /** `true` bloqueia o início do destino — e nenhuma busca é emitida (O3). */
  blocked: boolean;
  /** Quantas linhas caberiam no saldo — alimenta "reduzir a lista" (FR-013). */
  maxLinesThatFit: number;
}

export interface DailyConsumption {
  provider: ProviderId;
  /** Dia civil no fuso do provedor, `YYYY-MM-DD` (FR-030). */
  ptDate: string;
  units: number;
}

// ---------------------------------------------------------------------------
// Execução por serviço e fila (data-model §8 e §9)
// ---------------------------------------------------------------------------

export type RunPhase =
  | 'pending'
  | 'connect'
  | 'estimate'
  | 'search'
  | 'review'
  | 'creating'
  | 'done'
  | 'skipped'
  | 'failed';

export type RunOutcome = 'completed' | 'partial' | 'failed' | 'skipped';

export interface ServiceRun {
  provider: ProviderId;
  phase: RunPhase;
  /** Subconjunto ordenado dos ids da fonte única (FR-013, invariante R1). */
  lineIds: string[];
  items: MatchItem[];
  /** Cópia imutável das linhas no momento da conclusão (FR-037, SC-018). */
  frozenLines: InputLine[] | null;
  estimate: QuotaEstimate | null;
  creation: CreationProgress | null;
  result: CreationResult | null;
  /** `null` enquanto a execução não encerrou. Não-nulo congela tudo (R2). */
  outcome: RunOutcome | null;
  error: AppErrorInfo | null;
}

export interface ExecutionQueue {
  /** Derivada de `PROVIDER_ORDER ∩ selected` (FR-015). */
  order: ProviderId[];
  /** `-1` antes de começar. */
  currentIndex: number;
  runs: Record<ProviderId, ServiceRun>;
}

// ---------------------------------------------------------------------------
// Resumo consolidado (data-model §13)
// ---------------------------------------------------------------------------

export interface SummaryEntry {
  provider: ProviderId;
  outcome: RunOutcome;
  playlistUrl: string | null;
  /** Em qual conta a playlist foi criada (FR-036). */
  accountLabel: string;
  addedCount: number;
  skippedCount: number;
  failedLines: string[];
  lineCount: number;
  incompleteByQuota: boolean;
}

export interface ConsolidatedSummary {
  entries: SummaryEntry[];
  /** `true` quando os destinos receberam listas diferentes (FR-040, SC-018). */
  listsDiverged: boolean;
  /** `raw` das linhas removidas para destinos posteriores. */
  removedForLater: string[];
}

// ---------------------------------------------------------------------------
// Rascunho
// ---------------------------------------------------------------------------

/**
 * Estado de trabalho gravado no dispositivo (FR-037 a FR-039).
 * Nunca contém token nem Client ID — credencial e sessão têm chaves próprias
 * (invariante W1).
 */
export interface WorkDraft {
  schemaVersion: number;
  savedAt: number;
  step: WizardStep;
  rawText: string;
  /** Fonte **única** de linhas, compartilhada por todos os serviços (FR-014). */
  lines: InputLine[];
  playlistConfig: PlaylistConfig;
  destinations: DestinationSelection;
  queue: ExecutionQueue;
}

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------

/**
 * Resultado de validação de domínio. Carrega a chave da mensagem, nunca o texto:
 * o texto vive em `src/i18n/pt-BR.ts`.
 */
export type ValidationResult =
  { ok: true } | { ok: false; reason: ValidationReason; messageKey: string };

export type ValidationReason =
  | 'name_empty'
  | 'name_duplicate'
  | 'no_tracks_selected'
  | 'name_check_incomplete'
  | 'no_credential'
  | 'no_destination'
  | 'selection_locked'
  | 'not_a_subset'
  | 'quota_blocked';

// ---------------------------------------------------------------------------
// Fábricas de valores padrão
// ---------------------------------------------------------------------------

export function emptyPlaylistConfig(): PlaylistConfig {
  return { name: '', description: '', isPublic: false };
}

export function pendingItem(line: InputLine): MatchItem {
  const unparsed = line.parseStatus === 'unparsed';
  return {
    line,
    status: unparsed ? 'unparsed' : 'pending',
    candidates: [],
    selectedUri: null,
    included: false,
    duplicateOf: null,
    error: null,
    previousStatus: null,
  };
}
