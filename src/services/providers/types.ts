/**
 * Contrato interno entre a orquestração (fila, ciclo, telas) e os adaptadores de
 * provedor — `contracts/provider-contract.md`.
 *
 * É o que permite escrever o ciclo de FR-016 uma única vez. A regra que este
 * contrato existe para impor: **nenhum arquivo fora de
 * `src/services/providers/{provider}/` ramifica por `ProviderId`**. Diferença de
 * comportamento é dado em `capabilities`, não `if`. A exceção deliberada é a
 * camada de i18n, que precisa de texto específico por serviço.
 */

import type { ProviderCapabilities, ProviderId, QuotaOperation } from '@/domain/providers';
import type {
  InputLine,
  MatchItem,
  ProviderSession,
  QuotaEstimate,
} from '@/domain/types';

/** Retorno do consentimento: query (Spotify) ou fragmento (YouTube). */
export interface CallbackParams {
  provider: ProviderId;
  clientId: string;
  redirectUri: string;
  /** Pares já extraídos da query ou do fragmento pela camada de roteamento. */
  params: URLSearchParams;
}

export interface SearchContext {
  signal?: AbortSignal;
  /** Chamado a cada linha concluída — alimenta o progresso visível da busca. */
  onProgress?: (done: number, total: number) => void;
  /**
   * Retentativas ainda disponíveis nesta execução (`003/FR-010a`, invariante
   * O4). Vem de `estimate.retryReserve − run.retriesUsed`, e é o que torna
   * "consumo real nunca acima do estimado" verdadeiro por construção.
   *
   * Ausente = sem teto. É o caso do Spotify, que não tem orçamento diário.
   */
  retryBudget?: number;
  /** Chamado quando uma retentativa é de fato emitida — persiste `retriesUsed`. */
  onRetry?: (total: number) => void;
}

export interface CreateParams {
  session: ProviderSession;
  name: string;
  description: string;
  isPublic: boolean;
  signal?: AbortSignal;
}

export interface PlaylistProvider {
  readonly id: ProviderId;
  readonly capabilities: ProviderCapabilities;

  /** Instruções e endereços a exibir na configuração (FR-005). */
  readonly setup: {
    /** Link **exibido** ao usuário, nunca destino de requisição. */
    consoleUrl: string;
    /** Chave de i18n — o adaptador nunca devolve frase. */
    instructionsKey: string;
    /** YouTube: `true` — o cadastro exige também a origem JavaScript. */
    needsJavaScriptOrigin: boolean;
  };

  // --- Autorização ---------------------------------------------------------

  /** Monta a URL de consentimento e persiste o registro de autorização. */
  buildAuthorizeUrl(clientId: string, redirectUri: string): Promise<string>;

  /** Interpreta o retorno e devolve a sessão daquele provedor. */
  completeAuthorization(params: CallbackParams): Promise<ProviderSession>;

  /** Existe **apenas** quando `capabilities.canRefreshSilently === true`. */
  refresh?(session: ProviderSession, clientId: string): Promise<ProviderSession>;

  // --- Catálogo ------------------------------------------------------------

  /** Candidatas já pontuadas e ordenadas, no máximo 5 por linha (FR-023). */
  search(lines: InputLine[], ctx: SearchContext): Promise<MatchItem[]>;

  // --- Playlists -----------------------------------------------------------

  listPlaylistNames(session: ProviderSession, signal?: AbortSignal): Promise<string[]>;
  createPlaylist(params: CreateParams): Promise<{ id: string; url: string }>;
  /** Adiciona **um lote** de até `capabilities.batchSize` itens. */
  addItems(playlistId: string, uris: string[], signal?: AbortSignal): Promise<void>;
  /** Caminho real do provedor, nunca inventado (FR-027). */
  effectivePath(displayName: string, playlistName: string): string;

  // --- Cota (só quando `capabilities.quota !== null`) -----------------------

  estimate?(
    lineCount: number,
    selectedCount: number,
    now: number,
    /** Linhas elegíveis a retentativa naquele catálogo (`003/FR-010`). */
    retryReserve?: number,
  ): QuotaEstimate;
  /** Registra consumo após cada resposta, de forma síncrona (research §5). */
  recordConsumption?(operation: QuotaOperation, count?: number): void;
}

export type { QuotaOperation };
