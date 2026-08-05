/**
 * Entidades de data-model.md como tipos discriminados.
 *
 * Este módulo é puro: sem rede, sem DOM, sem armazenamento. Tudo o que a
 * aplicação sabe sobre o formato dos dados começa aqui.
 */

/** Versão do esquema serializado em disco (contracts/storage.md). */
export const SCHEMA_VERSION = 1;

// ---------------------------------------------------------------------------
// Credencial e sessão
// ---------------------------------------------------------------------------

/**
 * Client ID informado pelo usuário. Note a ausência deliberada de qualquer campo
 * de segredo: o tipo é a primeira barreira contra FR-005.
 */
export interface Credential {
  clientId: string;
}

export interface SpotifyUser {
  id: string;
  /** Compõe o caminho efetivo (FR-036); cai para `id` quando vier vazio. */
  displayName: string;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms: `Date.now() + expires_in * 1000` no momento da resposta. */
  expiresAt: number;
  scopes: string[];
  user: SpotifyUser;
}

/** Registro efêmero do PKCE, vivo apenas entre a ida e a volta do consentimento. */
export interface PkceRecord {
  codeVerifier: string;
  state: string;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------

export type ParseStatus = 'parsed' | 'unparsed';

export interface InputLine {
  /** Estável durante toda a sessão de trabalho; sobrevive à edição da linha. */
  id: string;
  /** Base 0, na ordem do texto original. Nunca reordenado (FR-019). */
  index: number;
  /** Texto original, sem alterações — é o que se copia na lista de falhas (FR-040). */
  raw: string;
  title: string;
  artist: string;
  /** Extraídos de `feat.` / `ft.` / `com`; reforçam a pontuação (research §6). */
  featuredArtists: string[];
  parseStatus: ParseStatus;
}

// ---------------------------------------------------------------------------
// Correspondência
// ---------------------------------------------------------------------------

/** Faixa do catálogo antes de receber a pontuação local. */
export interface TrackCandidateRaw {
  uri: string;
  id: string;
  title: string;
  artists: string[];
  album: string;
  durationMs: number;
  /** Menor imagem disponível; `null` quando o álbum não tem capa. */
  coverUrl: string | null;
  externalUrl: string;
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
  /** Entra na playlist. Padrão `true` só para `confident` (FR-025). */
  included: boolean;
  /** `id` da primeira `InputLine` com a mesma chave; força `included = false` (FR-018). */
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
  /** Obrigatório após `trim()` (FR-028). Só espaços conta como vazio. */
  name: string;
  description: string;
  /** Padrão `false` — privada (FR-030). */
  isPublic: boolean;
}

export type WizardStep = 'credential' | 'input' | 'review' | 'result';

export const WIZARD_STEPS: readonly WizardStep[] = ['credential', 'input', 'review', 'result'];

/** Limite da plataforma para `POST /v1/playlists/{id}/tracks`. */
export const BATCH_SIZE = 100;

export interface CreationProgress {
  /** Playlist já criada — a retomada nunca cria outra. */
  playlistId: string;
  playlistUrl: string;
  /** Congelado no início; fonte da ordem e do particionamento. */
  orderedUris: string[];
  batchSize: number;
  /**
   * Lotes confirmados. Só incrementa após resposta de sucesso — é o que impede
   * duplicação na retomada (SC-009).
   */
  committedBatches: number;
  /** Índice do lote que falhou, ou `null` se nada falhou. */
  failedAt: number | null;
}

export interface CreationResult {
  playlistId: string;
  playlistUrl: string;
  playlistName: string;
  /** `Sua Biblioteca / {displayName} / {name}` (FR-036). */
  effectivePath: string;
  addedCount: number;
  /** Descartadas + duplicatas + não incluídas. */
  skippedCount: number;
  /** `line.raw` dos não encontrados, na ordem original (FR-039, FR-040). */
  failedLines: string[];
}

// ---------------------------------------------------------------------------
// Rascunho
// ---------------------------------------------------------------------------

/**
 * Estado de trabalho gravado no dispositivo (FR-043 a FR-045).
 * Nunca contém token nem Client ID — credencial e sessão têm chaves próprias.
 */
export interface WorkDraft {
  schemaVersion: number;
  savedAt: number;
  step: WizardStep;
  rawText: string;
  playlistConfig: PlaylistConfig;
  items: MatchItem[];
  creation: CreationProgress | null;
}

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------

/**
 * Resultado de validação de domínio. Carrega a chave da mensagem, nunca o texto:
 * o texto vive em `src/i18n/pt-BR.ts` (FR-048).
 */
export type ValidationResult =
  { ok: true } | { ok: false; reason: ValidationReason; messageKey: string };

export type ValidationReason =
  'name_empty' | 'name_duplicate' | 'no_tracks_selected' | 'name_check_incomplete';

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
