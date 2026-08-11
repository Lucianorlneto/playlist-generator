/**
 * Semeador de desenvolvimento — **ferramenta de conferência, não é produto**.
 *
 * Existe para a conferência manual de forma que a suíte não vê
 * (`specs/009-creating-loading-state/quickstart.md` §3): zoom de texto a 200%,
 * modo de cores forçadas e a leitura a olho do cartão de criação nos dois temas.
 * Aquelas três coisas exigem o seu navegador, não um navegador dirigido por
 * script — daí um estado montado à mão em vez de um teste.
 *
 * ## Como usar
 *
 * **Ele vem desligado.** O único ponto de chamada é o bloco comentado em
 * `src/app/App.tsx` — descomente-o (junto da importação de `useEffect` no topo
 * do arquivo) e o `npm run dev` passa a abrir direto no cartão de criação. Os
 * parâmetros de URL são variações a partir daí:
 *
 * ```
 * npm run dev
 * http://127.0.0.1:5173/                    → "Aguardando confirmação do Spotify…"
 * http://127.0.0.1:5173/?itens=7            → o rodapé em progresso (7 de 12)
 * http://127.0.0.1:5173/?espera=1           → com o aviso de limitação de taxa
 * http://127.0.0.1:5173/?servico=youtube    → o mesmo cartão no YouTube
 * http://127.0.0.1:5173/?mock=off           → a aplicação normal, do primeiro passo
 * ```
 *
 * Para semear **outra** tela, o molde é este arquivo: monte o `ServiceRun` na
 * fase que interessa e chame `useAppStore.setState` uma vez só.
 *
 * ## O que ele **não** faz
 *
 * Nenhuma requisição sai, e nada é escrito em conta nenhuma: o estado é montado
 * direto no store, na fase `creating`, e o executor de criação nunca é chamado.
 * A sessão e o Client ID são valores de fachada.
 *
 * ## Como sair
 *
 * O rascunho é gravado enquanto a tela está montada, como em qualquer trabalho
 * real. Para voltar ao estado limpo, abra a aplicação com `?mock=off` e use
 * "Recomeçar", ou rode `localStorage.clear()` no console.
 *
 * ## Por que ele não chega ao `dist/`
 *
 * O ponto de chamada está atrás de `import.meta.env.DEV` e usa importação
 * dinâmica: em produção o efeito retorna antes de pedir o módulo, e o bundler
 * nunca inclui `src/dev/`. Com o bloco comentado, nem isso — não há importação
 * alguma deste arquivo no grafo.
 */

import { capabilitiesOf, PROVIDER_ORDER, type ProviderId } from '@/domain/providers';
import type {
  Credential,
  CreationProgress,
  ExecutionQueue,
  InputLine,
  MatchItem,
  ProviderSession,
  ServiceRun,
  TrackCandidate,
} from '@/domain/types';
import { useAppStore } from '@/store';

/** Doze faixas: o bastante para o caminho efetivo quebrar linha no resultado. */
const LISTA = [
  'Bohemian Rhapsody - Queen',
  'Imagine - John Lennon',
  'Smells Like Teen Spirit - Nirvana',
  'Hey Jude - The Beatles',
  'Comfortably Numb - Pink Floyd',
  'Stairway to Heaven - Led Zeppelin',
  'Hotel California - Eagles',
  'Sultans of Swing - Dire Straits',
  'Wish You Were Here - Pink Floyd',
  'Como Nossos Pais - Elis Regina',
  'Construção - Chico Buarque',
  'Aquarela do Brasil - Ary Barroso',
];

function linhaDe(raw: string, index: number): InputLine {
  const [titulo = raw, artista = ''] = raw.split(' - ');
  return {
    id: `mock-l${String(index)}`,
    index,
    raw,
    title: titulo,
    artist: artista,
    featuredArtists: [],
    shape: 'explicit',
    parseStatus: 'parsed',
  };
}

/**
 * A candidata de fachada.
 *
 * **Nada aqui ramifica por `ProviderId`**, e o portão de `no-secrets.spec.ts`
 * recusaria se ramificasse — a diferença de comportamento entre serviços vem de
 * `ProviderCapabilities`, inclusive num semeador. Foi o que a primeira escrita
 * deste arquivo errou.
 *
 * As URLs ficam vazias pelo mesmo motivo constitucional: URL absoluta em `src/`
 * precisa ser host da lista fechada ou link exibido, e nenhuma das duas se
 * aplica a um valor de fachada. A tela de criação não usa nenhuma delas.
 */
function candidataDe(linha: InputLine, provider: ProviderId): TrackCandidate {
  const uri = `mock:${provider}:${String(linha.index)}`;
  return {
    uri,
    id: uri,
    title: linha.title,
    artists: [linha.artist],
    album: capabilitiesOf(provider).showsAlbum ? 'Álbum de Fachada' : '',
    durationMs: 210_000,
    coverUrl: null,
    externalUrl: '',
    score: 0.97,
  };
}

function itemDe(linha: InputLine, provider: ProviderId): MatchItem {
  const candidata = candidataDe(linha, provider);
  return {
    line: linha,
    status: 'confident',
    candidates: [candidata],
    selectedUri: candidata.uri,
    included: true,
    duplicateOf: null,
    error: null,
    previousStatus: null,
    attentionReason: null,
  };
}

function sessaoDe(provider: ProviderId): ProviderSession {
  return {
    provider,
    accessToken: 'mock-token',
    // `null` nos dois serviços: nada aqui renova sessão, e distinguir exigiria
    // ramificar por provedor — que é o que o Princípio II proíbe fora de
    // `services/providers/`.
    refreshToken: null,
    expiresAt: Date.now() + 3_600_000,
    scopes: [],
    user: { id: 'mock-user', displayName: 'Conta de Teste' },
  };
}

/**
 * Lê os parâmetros e devolve `null` quando o semeador não foi pedido.
 *
 * `servico` aceita qualquer `ProviderId` da ordem de execução — é o que permite
 * conferir o §3.3 do quickstart ("os dois serviços são a mesma tela") sem editar
 * este arquivo.
 */
function pedido(): { provider: ProviderId; confirmados: number; espera: boolean } | null {
  const params = new URLSearchParams(window.location.search);

  // Vale por padrão: o pedido é que a **primeira** tela seja a de criação. Só
  // `?mock=off` devolve a aplicação ao primeiro passo do assistente.
  if (params.get('mock') === 'off') return null;

  const pedido = params.get('servico');
  const provider = PROVIDER_ORDER.find((p) => p === pedido) ?? 'spotify';
  const confirmados = Math.max(0, Math.min(LISTA.length, Number(params.get('itens') ?? '0') || 0));

  return { provider, confirmados, espera: params.get('espera') === '1' };
}

export function semearCriacaoEmCurso(): void {
  const alvo = pedido();
  if (alvo === null) return;

  const { provider, confirmados, espera } = alvo;

  const linhas = LISTA.map(linhaDe);
  const itens = linhas.map((linha) => itemDe(linha, provider));

  const creation: CreationProgress = {
    playlistId: 'mock-playlist',
    playlistUrl: '',
    orderedUris: itens.map((item) => item.selectedUri ?? ''),
    batchSize: capabilitiesOf(provider).batchSize,
    committedItems: confirmados,
    failedAt: null,
    accountId: 'mock-user',
  };

  const run: ServiceRun = {
    provider,
    phase: 'creating',
    lineIds: linhas.map((linha) => linha.id),
    items: itens,
    frozenLines: null,
    estimate: null,
    creation,
    result: null,
    outcome: null,
    error: null,
    retriesUsed: 0,
    resumeFrom: null,
  };

  // A fila carrega **um** destino: a paridade entre serviços se confere trocando
  // `?servico=`, não empilhando os dois — o cartão é por serviço, um de cada vez.
  const runs = {} as Record<ProviderId, ServiceRun>;
  runs[provider] = run;
  const queue: ExecutionQueue = { order: [provider], currentIndex: 0, runs };

  const credenciais = {} as Record<ProviderId, Credential | null>;
  for (const p of PROVIDER_ORDER) credenciais[p] = p === provider ? { clientId: 'mock-client' } : null;

  const sessoes = {} as Record<ProviderId, ProviderSession | null>;
  for (const p of PROVIDER_ORDER) sessoes[p] = p === provider ? sessaoDe(p) : null;

  useAppStore.setState({
    step: 'service',
    credentials: credenciais,
    sessions: sessoes,
    lines: linhas,
    destinations: { selected: [provider], locked: true },
    playlistConfig: { name: 'Clássicos de Fachada', description: '', isPublic: false },
    creating: true,
    creationError: null,
    queue,
  });

  if (!espera) return;

  /*
    O aviso de limitação de taxa (§3.5 do quickstart).

    `waitAnnounced` é a via real — a mesma que um `429` usa —, e por isso o aviso
    aparece com o comportamento de verdade: sem ícone, com a contagem regressiva
    correndo de segundo em segundo e sem saída de cancelamento. A importação é
    dinâmica para que o módulo do limitador não entre no caminho de carga quando o
    semeador não é pedido.
  */
  void import('@/services/rate-limiter').then(({ waitAnnounced }) => {
    void waitAnnounced(45_000, 'retry_after');
  });
}
