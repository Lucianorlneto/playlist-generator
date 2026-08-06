import { PROVIDER_ORDER, type ProviderId } from '@/domain/providers';
import {
  SCHEMA_VERSION,
  type CreationProgress,
  type CreationResult,
  type DestinationSelection,
  type ExecutionQueue,
  type InputLine,
  type MatchItem,
  type MatchStatus,
  type ProviderSession,
  type ServiceRun,
  type TrackCandidate,
  type WorkDraft,
} from '@/domain/types';

let counter = 0;

export function resetFactoryCounter(): void {
  counter = 0;
}

export function makeLine(overrides: Partial<InputLine> = {}): InputLine {
  const index = overrides.index ?? counter++;
  return {
    id: `l${index}`,
    index,
    raw: 'Bohemian Rhapsody - Queen',
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    featuredArtists: [],
    parseStatus: 'parsed',
    ...overrides,
  };
}

export function makeCandidate(overrides: Partial<TrackCandidate> = {}): TrackCandidate {
  const id = overrides.id ?? `track${counter++}`;
  return {
    uri: `spotify:track:${id}`,
    id,
    title: 'Bohemian Rhapsody',
    artists: ['Queen'],
    album: 'A Night at the Opera',
    durationMs: 354_320,
    coverUrl: 'https://i.scdn.co/image/abc',
    externalUrl: `https://open.spotify.com/track/${id}`,
    score: 0.98,
    ...overrides,
  };
}

/** Candidata do catálogo de vídeo: sem álbum, com canal (FR-024). */
export function makeVideoCandidate(overrides: Partial<TrackCandidate> = {}): TrackCandidate {
  const id = overrides.id ?? `video${counter++}`;
  return {
    uri: id,
    id,
    title: 'Bohemian Rhapsody (Official Music Video)',
    artists: ['Queen'],
    album: '',
    durationMs: 354_320,
    coverUrl: `https://i.ytimg.com/vi/${id}/default.jpg`,
    externalUrl: `https://www.youtube.com/watch?v=${id}`,
    channel: 'QueenVEVO',
    score: 0.95,
    ...overrides,
  };
}

export function makeItem(overrides: Partial<MatchItem> = {}): MatchItem {
  const line = overrides.line ?? makeLine();
  const candidates = overrides.candidates ?? [makeCandidate()];
  const status: MatchStatus = overrides.status ?? 'confident';
  const selectedUri =
    overrides.selectedUri !== undefined ? overrides.selectedUri : (candidates[0]?.uri ?? null);

  return {
    line,
    status,
    candidates,
    selectedUri,
    included: overrides.included ?? (status === 'confident' && selectedUri !== null),
    duplicateOf: overrides.duplicateOf ?? null,
    error: overrides.error ?? null,
    previousStatus: overrides.previousStatus ?? null,
  };
}

export function makeCreation(overrides: Partial<CreationProgress> = {}): CreationProgress {
  return {
    playlistId: 'playlist-1',
    playlistUrl: 'https://open.spotify.com/playlist/playlist-1',
    orderedUris: ['spotify:track:a', 'spotify:track:b'],
    batchSize: 100,
    committedItems: 0,
    failedAt: null,
    ...overrides,
  };
}

export function makeResult(overrides: Partial<CreationResult> = {}): CreationResult {
  return {
    provider: 'spotify',
    playlistId: 'playlist-1',
    playlistUrl: 'https://open.spotify.com/playlist/playlist-1',
    playlistName: 'Clássicos',
    effectivePath: 'Sua Biblioteca / Fulano de Teste / Clássicos',
    addedCount: 2,
    skippedCount: 0,
    failedLines: [],
    incompleteByQuota: false,
    ...overrides,
  };
}

export function makeRun(provider: ProviderId, overrides: Partial<ServiceRun> = {}): ServiceRun {
  return {
    provider,
    phase: 'pending',
    lineIds: [],
    items: [],
    frozenLines: null,
    estimate: null,
    creation: null,
    result: null,
    outcome: null,
    error: null,
    ...overrides,
  };
}

/**
 * Fila pronta para `useAppStore.setState`.
 *
 * `overrides.runs` aceita um mapa **parcial**: informe só os provedores que o
 * teste precisa moldar, e os demais entram com uma execução `pending`. Sem isso
 * cada chamada precisaria de um cast, que é justamente o tipo de ruído que
 * esconde erro de tipo real.
 */
export function makeQueue(
  order: ProviderId[] = ['spotify'],
  overrides: Omit<Partial<ExecutionQueue>, 'runs'> & {
    runs?: Partial<Record<ProviderId, ServiceRun>>;
  } = {},
): ExecutionQueue {
  const { runs: runOverrides, ...rest } = overrides;

  const runs = {} as Record<ProviderId, ServiceRun>;
  for (const provider of order) {
    runs[provider] = runOverrides?.[provider] ?? makeRun(provider);
  }

  return { order, currentIndex: 0, runs, ...rest };
}

export function makeDestinations(
  overrides: Partial<DestinationSelection> = {},
): DestinationSelection {
  return { selected: ['spotify'], locked: false, ...overrides };
}

export function makeDraft(overrides: Partial<WorkDraft> = {}): WorkDraft {
  const line = makeLine({ index: 0 });
  return {
    schemaVersion: SCHEMA_VERSION,
    savedAt: 1_786_060_800_000,
    step: 'service',
    rawText: 'Bohemian Rhapsody - Queen',
    lines: [line],
    playlistConfig: { name: 'Clássicos', description: '', isPublic: false },
    destinations: makeDestinations(),
    queue: makeQueue(['spotify'], {
      runs: {
        spotify: makeRun('spotify', {
          phase: 'review',
          lineIds: [line.id],
          items: [makeItem({ line })],
        }),
      } as Record<ProviderId, ServiceRun>,
    }),
    ...overrides,
  };
}

export function makeSession(
  provider: ProviderId = 'spotify',
  overrides: Partial<ProviderSession> = {},
): ProviderSession {
  const base: ProviderSession =
    provider === 'spotify'
      ? {
          provider: 'spotify',
          accessToken: 'access-token-1',
          refreshToken: 'refresh-token-1',
          expiresAt: Date.now() + 3_600_000,
          scopes: ['playlist-modify-private', 'playlist-modify-public', 'playlist-read-private'],
          user: { id: 'usuario_teste', displayName: 'Fulano de Teste' },
        }
      : {
          provider: 'youtube',
          accessToken: 'ya29.token-1',
          // Implicit flow não emite refresh token (invariante S1, FR-035).
          refreshToken: null,
          expiresAt: Date.now() + 3_600_000,
          scopes: ['https://www.googleapis.com/auth/youtube'],
          user: { id: 'UC_teste', displayName: 'Canal de Teste' },
        };
  return { ...base, ...overrides };
}

/** Mapa de sessões pronto para `useAppStore.setState`. */
export function makeSessions(
  present: Partial<Record<ProviderId, ProviderSession>> = {},
): Record<ProviderId, ProviderSession | null> {
  const record = {} as Record<ProviderId, ProviderSession | null>;
  for (const provider of PROVIDER_ORDER) record[provider] = present[provider] ?? null;
  return record;
}

export function makeCredentials(
  present: Partial<Record<ProviderId, string>> = {},
): Record<ProviderId, { clientId: string } | null> {
  const record = {} as Record<ProviderId, { clientId: string } | null>;
  for (const provider of PROVIDER_ORDER) {
    const clientId = present[provider];
    record[provider] = clientId === undefined ? null : { clientId };
  }
  return record;
}
