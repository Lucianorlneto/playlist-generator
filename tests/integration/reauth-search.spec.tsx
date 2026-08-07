/**
 * V0, V2, V11, V12, V13, V16a, V30, V31, V36 — a perda de autorização durante a
 * busca (`004/US1`, FR-001 a FR-008, FR-015 a FR-017).
 *
 * **Este é o arquivo que refuta o diagnóstico original.** A spec supunha que a
 * perda de sessão encerrava a execução com desfecho "falhou". Medido contra o
 * código, era falso: `searchOne` capturava o erro **linha por linha** e o
 * transformava em "Não encontrada". A mensagem certa era escrita cem vezes,
 * enterrada no detalhe de cada fileira, enquanto o cabeçalho seguia mostrando a
 * conta como conectada.
 *
 * Antes do conserto, o primeiro caso abaixo falha mostrando todas as linhas em
 * `status: 'not_found'` com `error` preenchido e `interruption` inexistente.
 */

import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { handleSessionLoss } from '@/features/connect/reconnect';
import { runMatching } from '@/features/input/matchRunner';
import { ServiceStep } from '@/features/service/ServiceStep';
import { loadDraft } from '@/services/storage/draftRepo';
import { loadCredential, saveCredential } from '@/services/storage/credentialRepo';
import { loadSession, saveSession } from '@/services/storage/sessionRepo';
import { useAppStore } from '@/store';
import { attachDraftPersistence } from '@/store/draftPersistence';

import {
  makeCredentials,
  makeItem,
  makeLine,
  makeQueue,
  makeRun,
  makeSession,
  makeSessions,
} from '../fixtures/factories';
import {
  alwaysUnauthorized,
  requestsTo,
  setCatalog,
  setYouTubeCatalog,
} from '../msw/handlers';
import { countRequestsFrom, useFastLimiters, wireBoth, wireYouTube } from './support/clients';

const CLIENT_ID = '123-abc.apps.googleusercontent.com';

function linhas(total: number) {
  return Array.from({ length: total }, (_, index) =>
    makeLine({ id: `l${index}`, index, raw: `Faixa ${index} - Artista` }),
  );
}

function semear(total: number, phase: 'search' | 'review' = 'search') {
  const lines = linhas(total);
  useAppStore.setState({
    step: 'service',
    lines,
    rawText: lines.map((linha) => linha.raw).join('\n'),
    credentials: makeCredentials({ youtube: CLIENT_ID }),
    sessions: makeSessions({ youtube: makeSession('youtube') }),
    destinations: { selected: ['youtube'], locked: false },
    playlistConfig: { name: 'Lista', description: '', isPublic: false },
    queue: makeQueue(['youtube'], {
      currentIndex: 0,
      runs: {
        youtube: makeRun('youtube', { phase, lineIds: lines.map((linha) => linha.id) }),
      },
    }),
  });
  return lines;
}

function runYouTube() {
  return useAppStore.getState().runFor('youtube');
}

/** Deixa o efeito da etapa rodar e a busca assentar. */
async function assentar(): Promise<void> {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
}

beforeEach(() => {
  useFastLimiters();
  wireYouTube();
  setYouTubeCatalog([]);
});

describe('V0/V2 — `401` não vira "Não encontrada"', () => {
  it('a busca interrompida devolve interrupção, e nenhuma linha sai not_found', async () => {
    alwaysUnauthorized('ytSearch');

    const { items, interruption } = await runMatching('youtube', linhas(3), {
      signal: new AbortController().signal,
    });

    expect(interruption).not.toBeNull();
    expect(interruption?.kind).toBe('reauth_required');
    // O ponto exato do defeito original.
    expect(items.every((item) => item.status !== 'not_found')).toBe(true);
    expect(items.every((item) => item.error === null)).toBe(true);
    // A lista nunca encurta: A5.
    expect(items).toHaveLength(3);
  });

  it('as linhas não buscadas voltam `pending`, não "não encontrada" (A3)', async () => {
    alwaysUnauthorized('ytSearch');

    const { items } = await runMatching('youtube', linhas(5), {
      signal: new AbortController().signal,
    });

    expect(items.every((item) => item.status === 'pending')).toBe(true);
  });
});

describe('V11/V12 — uma interrupção, e nada é emitido depois dela', () => {
  it('cem linhas falhando juntas produzem **uma** interrupção (FR-007)', async () => {
    alwaysUnauthorized('ytSearch');

    const { interruption } = await runMatching('youtube', linhas(100), {
      signal: new AbortController().signal,
    });

    expect(interruption).not.toBeNull();
    // FR-006, SC-007: o abort encadeado impede que as demais linhas saiam. O
    // número exato depende da concorrência do limitador; o que a feature promete
    // é que ele fica **muito** abaixo do total, não que seja exatamente um.
    expect(requestsTo('ytSearch').length).toBeLessThan(100);
  });

  it('nenhuma requisição é emitida após a detecção (SC-007)', async () => {
    alwaysUnauthorized('ytSearch');

    await runMatching('youtube', linhas(20), { signal: new AbortController().signal });

    const depois = countRequestsFrom('youtube');
    await assentar();

    expect(depois()).toBe(0);
  });

  it('o enriquecimento **não** roda após a interrupção (S6, P4)', async () => {
    alwaysUnauthorized('ytSearch');

    await runMatching('youtube', linhas(5), { signal: new AbortController().signal });

    expect(requestsTo('ytVideos')).toHaveLength(0);
  });
});

describe('V13 — cancelar não é perder sessão (FR-008, P6)', () => {
  it('cancelamento explícito do usuário não vira pedido de reautorização', async () => {
    alwaysUnauthorized('ytSearch');
    const controller = new AbortController();
    controller.abort();

    const { items, interruption } = await runMatching('youtube', linhas(3), {
      signal: controller.signal,
    });

    expect(interruption).toBeNull();
    expect(items.every((item) => item.status === 'pending')).toBe(true);
    expect(requestsTo('ytSearch')).toHaveLength(0);
  });
});

describe('FR-002 — a execução para, não encerra', () => {
  it('a etapa leva a execução a awaiting_reauth com outcome ainda nulo', async () => {
    semear(3);
    alwaysUnauthorized('ytSearch');

    render(<ServiceStep />);
    await assentar();

    const run = runYouTube();
    expect(run?.phase).toBe('awaiting_reauth');
    expect(run?.resumeFrom).toBe('search');
    expect(run?.outcome).toBeNull();
    expect(run?.result).toBeNull();
  });
});

describe('FR-003 — o rascunho é gravado antes de qualquer mudança de estado', () => {
  it('o pedido sobrevive à recarga pelo caminho de restauração existente (A6)', async () => {
    const desligar = attachDraftPersistence();
    try {
      semear(3);
      alwaysUnauthorized('ytSearch');

      render(<ServiceStep />);
      await assentar();

      const draft = loadDraft();
      expect(draft?.queue.runs.youtube?.phase).toBe('awaiting_reauth');
      expect(draft?.queue.runs.youtube?.resumeFrom).toBe('search');
      // O texto digitado e o nome da playlist continuam íntegros.
      expect(draft?.rawText).toContain('Faixa 0 - Artista');
      expect(draft?.playlistConfig.name).toBe('Lista');
    } finally {
      desligar();
    }
  });
});

describe('V16a/FR-016a — credencial removida com o pedido aberto', () => {
  it('a perda de sessão não descarta a credencial nem o trabalho preservado', async () => {
    saveCredential('youtube', CLIENT_ID);
    const lines = semear(3);
    useAppStore.setState({
      queue: makeQueue(['youtube'], {
        currentIndex: 0,
        runs: {
          youtube: makeRun('youtube', {
            phase: 'search',
            lineIds: lines.map((linha) => linha.id),
            items: [makeItem({ line: lines[0]! })],
          }),
        },
      }),
    });

    handleSessionLoss('youtube');

    expect(loadCredential('youtube')?.clientId).toBe(CLIENT_ID);
    expect(runYouTube()?.items).toHaveLength(1);
  });
});

describe('V30/FR-016 — a reconexão que falha', () => {
  it('nenhuma retomada dispara sem sessão válida, e o trabalho segue intacto (R4)', async () => {
    const lines = semear(3);
    useAppStore.setState({
      sessions: makeSessions({}),
      queue: makeQueue(['youtube'], {
        currentIndex: 0,
        runs: {
          youtube: makeRun('youtube', {
            phase: 'awaiting_reauth',
            resumeFrom: 'search',
            lineIds: lines.map((linha) => linha.id),
            items: [makeItem({ line: lines[0]! })],
          }),
        },
      }),
    });

    const depois = countRequestsFrom('youtube');
    render(<ServiceStep />);
    await assentar();

    // Sem sessão, a etapa exibe o pedido e **não** volta a buscar sozinha.
    expect(depois()).toBe(0);
    expect(runYouTube()?.phase).toBe('awaiting_reauth');
    expect(runYouTube()?.items).toHaveLength(1);
    expect(runYouTube()?.outcome).toBeNull();
  });

  it('a causa exibível do erro de autorização é registrada (FR-046)', async () => {
    semear(3);
    alwaysUnauthorized('ytSearch');

    render(<ServiceStep />);
    await assentar();

    const authError = useAppStore.getState().authError;
    expect(authError).not.toBeNull();
    expect(authError?.provider).toBe('youtube');
    expect(authError?.info.cause).toBeTruthy();
    expect(authError?.info.nextStep).toBeTruthy();
  });
});

describe('V31/FR-017 — a fila não é reordenada pela interrupção', () => {
  it('o destino seguinte não começa antes da vez enquanto o primeiro espera', async () => {
    wireBoth();
    setCatalog([]);
    const lines = linhas(3);

    useAppStore.setState({
      step: 'service',
      lines,
      credentials: makeCredentials({ spotify: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6', youtube: CLIENT_ID }),
      sessions: makeSessions({ spotify: makeSession('spotify'), youtube: makeSession('youtube') }),
      destinations: { selected: ['spotify', 'youtube'], locked: false },
      queue: makeQueue(['spotify', 'youtube'], {
        currentIndex: 0,
        runs: {
          spotify: makeRun('spotify', { phase: 'search', lineIds: lines.map((l) => l.id) }),
          youtube: makeRun('youtube', { phase: 'pending', lineIds: lines.map((l) => l.id) }),
        },
      }),
    });

    alwaysUnauthorized('search');
    const doYouTube = countRequestsFrom('youtube');

    render(<ServiceStep />);
    await assentar();

    expect(useAppStore.getState().runFor('spotify')?.phase).toBe('awaiting_reauth');
    // O segundo destino nem começou: a fila não avança sobre execução aberta.
    expect(useAppStore.getState().queue.currentIndex).toBe(0);
    expect(useAppStore.getState().runFor('youtube')?.phase).toBe('pending');
    expect(doYouTube()).toBe(0);
  });

  it('a perda de sessão em um provedor não toca a sessão nem a credencial do outro', () => {
    saveSession(makeSession('spotify'));
    saveSession(makeSession('youtube'));
    saveCredential('spotify', 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6');
    saveCredential('youtube', CLIENT_ID);
    useAppStore.setState({
      sessions: makeSessions({ spotify: makeSession('spotify'), youtube: makeSession('youtube') }),
      credentials: makeCredentials({
        spotify: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
        youtube: CLIENT_ID,
      }),
    });

    handleSessionLoss('youtube');

    // FR-004, FR-005, SC-005: isolamento por provedor, invariante S2 da 002.
    expect(useAppStore.getState().sessions.spotify).not.toBeNull();
    expect(loadSession('spotify')).not.toBeNull();
    expect(loadCredential('spotify')?.clientId).toBe('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6');
    expect(useAppStore.getState().sessions.youtube).toBeNull();
    expect(loadSession('youtube')).toBeNull();
  });
});

describe('V36/FR-015 — a checagem de nome contra a conta atual', () => {
  it('a lista de nomes da conta antiga é invalidada na perda de sessão', () => {
    useAppStore.setState({
      sessions: makeSessions({ youtube: makeSession('youtube') }),
      existingNames: ['Lista da conta antiga'],
    });

    handleSessionLoss('youtube');

    // Sem isto, reconectar a outra conta deixaria a lista velha legível e um
    // consumidor poderia lê-la antes de a nova checagem terminar.
    expect(useAppStore.getState().existingNames).toBeNull();
  });
});

describe('US4 cenário 2 — pular a partir do pedido', () => {
  it('encerra aquele destino como skipped e preserva o que já foi feito', async () => {
    const lines = semear(3);
    useAppStore.setState({
      queue: makeQueue(['youtube'], {
        currentIndex: 0,
        runs: {
          youtube: makeRun('youtube', {
            phase: 'awaiting_reauth',
            resumeFrom: 'search',
            lineIds: lines.map((linha) => linha.id),
            items: [makeItem({ line: lines[0]! })],
          }),
        },
      }),
    });

    useAppStore.getState().dispatchRun({ type: 'skipped' }, 'youtube');

    const run = runYouTube();
    expect(run?.outcome).toBe('skipped');
    expect(run?.items).toHaveLength(1);
    expect(run?.resumeFrom).toBeNull();
  });
});
