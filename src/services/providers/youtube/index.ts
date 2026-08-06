/**
 * Adaptador do YouTube — a implementação de `PlaylistProvider` para o catálogo
 * de vídeos.
 *
 * Três diferenças em relação ao Spotify, todas declaradas em `capabilities` em
 * vez de espalhadas em ramificações:
 *
 * - **sem `refresh`**: `canRefreshSilently: false`, então a expiração vira
 *   reautorização explícita (FR-035);
 * - **com `estimate` e `recordConsumption`**: há orçamento diário, e a
 *   estimativa é gate de primeira classe antes de qualquer busca (FR-029);
 * - **`showsAlbum: false`**: a revisão mostra canal e duração, nunca álbum
 *   (FR-024).
 */

import { capabilitiesOf } from '@/domain/providers';
import { channelBonus } from '@/domain/scoring';
import { stripDecorations, versionHints } from '@/domain/versionHints';
import { scoreCandidate } from '@/domain/scoring';
import type { InputLine, MatchItem, ProviderSession, TrackCandidateRaw } from '@/domain/types';
import { runProviderSearch } from '@/services/providers/searchRunner';
import type { CallbackParams, CreateParams, PlaylistProvider } from '@/services/providers/types';

import { buildAuthorizeUrl, completeAuthorization } from './auth';
import { addItems, createPlaylist, effectivePath, listPlaylistNames } from './playlists';
import { estimate, recordConsumption } from './quota';
import { searchVideo } from './search';
import { enrichCandidates } from './videos';

const PROVIDER = 'youtube' as const;

/**
 * Pontua contra o título **limpo** de decorações editoriais, sem alterar o
 * título exibido. Sem isso, "Bohemian Rhapsody (Official Music Video)" perderia
 * pontos por ruído que não diz nada sobre a gravação (research §7).
 */
function scoreOf(line: InputLine, candidate: TrackCandidateRaw): number {
  return scoreCandidate(line, { ...candidate, title: stripDecorations(candidate.title) });
}

function bonusOf(candidate: TrackCandidateRaw): number {
  return candidate.channel === undefined ? 0 : channelBonus(candidate.channel);
}

function hintsOf(candidate: TrackCandidateRaw, siblings: TrackCandidateRaw[]) {
  return versionHints(
    candidate.title,
    candidate.durationMs,
    siblings.map((sibling) => sibling.durationMs),
  );
}

export const youtubeProvider: PlaylistProvider = {
  id: PROVIDER,
  capabilities: capabilitiesOf(PROVIDER),

  setup: {
    // Link **exibido** ao usuário, nunca destino de requisição (research §14).
    consoleUrl: 'https://console.cloud.google.com/apis/credentials',
    instructionsKey: 'providers.youtube',
    // O Google recusa a autorização sem a origem JavaScript cadastrada.
    needsJavaScriptOrigin: true,
  },

  buildAuthorizeUrl,

  completeAuthorization: (params: CallbackParams): Promise<ProviderSession> =>
    completeAuthorization(params.params),

  // Sem `refresh`: a ausência é a capacidade declarada, não um esquecimento.

  search: (lines: InputLine[], ctx): Promise<MatchItem[]> =>
    runProviderSearch(lines, ctx, {
      provider: PROVIDER,
      searchLine: searchVideo,
      enrich: enrichCandidates,
      scoreOf,
      bonusOf,
      hintsOf,
    }),

  listPlaylistNames: (_session, signal) => listPlaylistNames(signal),

  createPlaylist: (params: CreateParams) =>
    createPlaylist({
      name: params.name,
      description: params.description,
      isPublic: params.isPublic,
      ...(params.signal === undefined ? {} : { signal: params.signal }),
    }),

  addItems,
  effectivePath,
  estimate,
  recordConsumption,
};
