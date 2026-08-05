import {
  SCHEMA_VERSION,
  type CreationProgress,
  type InputLine,
  type MatchItem,
  type MatchStatus,
  type Session,
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
    committedBatches: 0,
    failedAt: null,
    ...overrides,
  };
}

export function makeDraft(overrides: Partial<WorkDraft> = {}): WorkDraft {
  return {
    schemaVersion: SCHEMA_VERSION,
    savedAt: 1_786_060_800_000,
    step: 'review',
    rawText: 'Bohemian Rhapsody - Queen',
    playlistConfig: { name: 'Clássicos', description: '', isPublic: false },
    items: [makeItem()],
    creation: null,
    ...overrides,
  };
}

export function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    accessToken: 'access-token-1',
    refreshToken: 'refresh-token-1',
    expiresAt: Date.now() + 3_600_000,
    scopes: ['playlist-modify-private', 'playlist-modify-public', 'playlist-read-private'],
    user: { id: 'usuario_teste', displayName: 'Fulano de Teste' },
    ...overrides,
  };
}
