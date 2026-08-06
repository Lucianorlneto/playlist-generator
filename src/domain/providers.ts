/**
 * Provedores como **dados** (data-model §1, research §10).
 *
 * A regra que este módulo existe para tornar possível: nenhum arquivo fora de
 * `src/services/providers/{provider}/` ramifica por `ProviderId`. O que difere
 * entre um catálogo de faixas e um catálogo de vídeos vira campo de
 * {@link ProviderCapabilities}, não `if` espalhado pelas telas.
 *
 * Puro: sem rede, sem DOM, sem armazenamento, sem relógio ambiente.
 */

export type ProviderId = 'spotify' | 'youtube';

/**
 * Ordem de execução e de exibição — fixa, definida pelo produto (FR-015). É a
 * **única** fonte de ordem: nem a fila nem o seletor ordenam por conta própria
 * (invariante P1).
 */
export const PROVIDER_ORDER: readonly ProviderId[] = ['spotify', 'youtube'];

/** Operações que consomem orçamento diário (contracts/youtube-api.md §9). */
export type QuotaOperation =
  | 'search'
  | 'enrich'
  | 'listPlaylists'
  | 'createPlaylist'
  | 'addItem'
  | 'identify';

export interface QuotaModel {
  /** Orçamento padrão do provedor. Nunca informado pelo usuário (FR-029). */
  dailyBudget: number;
  costs: Record<QuotaOperation, number>;
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
  /** Limiares de confiança calibrados por catálogo (FR-023, research §7). */
  thresholds: { confident: number; uncertain: number };
}

/**
 * Orçamento da YouTube Data API v3 (contracts/youtube-api.md §9).
 *
 * Os custos são fatos da plataforma, não escolhas: `search.list` custa 100 e
 * `playlistItems.insert` custa 50 por vídeo, e é essa assimetria que torna
 * FR-029 necessário.
 */
export const YOUTUBE_QUOTA: QuotaModel = {
  dailyBudget: 10_000,
  costs: {
    search: 100,
    enrich: 1,
    listPlaylists: 1,
    createPlaylist: 50,
    addItem: 50,
    identify: 1,
  },
  resetTimeZone: 'America/Los_Angeles',
  safetyMargin: 0.1,
};

const CAPABILITIES: Record<ProviderId, ProviderCapabilities> = {
  spotify: {
    canRefreshSilently: true,
    quota: null,
    batchSize: 100,
    showsAlbum: true,
    thresholds: { confident: 0.82, uncertain: 0.55 },
  },
  youtube: {
    // O implicit flow do Google não emite refresh token (research §1). A
    // ausência é dado, não erro: vira estado previsto da interface.
    canRefreshSilently: false,
    quota: YOUTUBE_QUOTA,
    batchSize: 1,
    showsAlbum: false,
    // Mais exigente que o Spotify porque o erro caro no catálogo de vídeo não é
    // "não achou", é "achou o cover" (research §7).
    thresholds: { confident: 0.88, uncertain: 0.55 },
  },
};

export function capabilitiesOf(id: ProviderId): ProviderCapabilities {
  return CAPABILITIES[id];
}

/** Interseção com {@link PROVIDER_ORDER}, preservando a ordem fixa (FR-015). */
export function orderSelection(selected: readonly ProviderId[]): ProviderId[] {
  return PROVIDER_ORDER.filter((id) => selected.includes(id));
}

export function isProviderId(value: unknown): value is ProviderId {
  return value === 'spotify' || value === 'youtube';
}
