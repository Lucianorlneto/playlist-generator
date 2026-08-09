import { describe, expect, it } from 'vitest';

import { composeRail, type RailSnapshot } from '@/domain/rail';
import { t } from '@/i18n/pt-BR';

/**
 * O domínio da trilha — FR-012, FR-013, FR-014, FR-066, FR-067.
 *
 * Função pura, sem DOM: é o que o Princípio III compra. A composição da trilha é
 * regra de negócio — quais etapas existem, como se numeram, o que cada uma
 * declara — e regra de negócio precisa ser testável sem renderizar nada.
 *
 * Os seis cenários abaixo são a tabela de `quickstart.md` §4, um a um.
 */

const BASE: RailSnapshot = {
  current: 'credential',
  destinations: [],
  lineCount: 0,
  credentialsReady: false,
};

function snapshot(patch: Partial<RailSnapshot>): RailSnapshot {
  return { ...BASE, ...patch };
}

/** Atalho de leitura: o degrau de uma etapa, ou `undefined` se não existir. */
function degrau(rail: ReturnType<typeof composeRail>, step: RailSnapshot['current']) {
  return rail.find((s) => s.step === step);
}

describe('FR-013 · a etapa Resumo é condicional, e a numeração é contígua', () => {
  it('com um destino, o Resumo não existe e a numeração vai de 1 a 4', () => {
    const rail = composeRail(snapshot({ destinations: ['spotify'], current: 'input' }));

    expect(degrau(rail, 'summary')).toBeUndefined();
    expect(rail.map((s) => s.ordinal)).toEqual([1, 2, 3, 4]);
    expect(rail.map((s) => s.step)).toEqual(['credential', 'destinations', 'input', 'service']);
  });

  it('com dois destinos, o Resumo existe e a numeração vai de 1 a 5', () => {
    const rail = composeRail(snapshot({ destinations: ['spotify', 'youtube'], current: 'input' }));

    expect(degrau(rail, 'summary')?.ordinal).toBe(5);
    expect(rail.map((s) => s.ordinal)).toEqual([1, 2, 3, 4, 5]);
  });

  it('a numeração é atribuída depois da filtragem, nunca 1-2-3-5', () => {
    // O modo de falha que este teste existe para pegar: numerar sobre a lista
    // completa e só então esconder o Resumo deixaria o buraco no meio da
    // sequência — visível, inexplicável e sem erro em lugar nenhum.
    const rail = composeRail(snapshot({ destinations: ['youtube'], current: 'service' }));
    const ordinais = rail.map((s) => s.ordinal);
    expect(ordinais).toEqual(ordinais.map((_, i) => i + 1));
  });
});

describe('FR-012 e FR-066 · a trilha nunca afirma uma escolha que não aconteceu', () => {
  it('na Configuração, sem destino escolhido, a linha de Destinos é neutra', () => {
    // **O caso que separa esta implementação do mockup.** O arquivo de design
    // mostra "Spotify e YouTube" sob Destinos já na tela de Configuração.
    // Reproduzi-lo seria a trilha declarando uma decisão que o usuário ainda
    // não tomou.
    const rail = composeRail(snapshot({ current: 'credential' }));
    const destinos = degrau(rail, 'destinations');

    expect(destinos?.state).toBe('pending');
    expect(destinos?.support).toEqual({ kind: 'neutral' });
  });

  it('a linha neutra não nomeia provedor nenhum', () => {
    const rail = composeRail(snapshot({ current: 'credential' }));
    const serializado = JSON.stringify(rail);

    expect(serializado).not.toContain(t.providers.spotify.name);
    expect(serializado).not.toContain(t.providers.youtube.name);
  });

  it('na Entrada, com dois destinos escolhidos, a linha nomeia os destinos reais', () => {
    const rail = composeRail(
      snapshot({ current: 'input', destinations: ['spotify', 'youtube'] }),
    );
    const destinos = degrau(rail, 'destinations');

    expect(destinos?.state).toBe('done');
    expect(destinos?.support.kind).toBe('derived');
    const valor = destinos?.support.kind === 'derived' ? destinos.support.value : '';
    expect(valor).toContain(t.providers.spotify.name);
    expect(valor).toContain(t.providers.youtube.name);
  });

  it('nenhum degrau pendente produz linha derivada, em nenhum instantâneo', () => {
    const instantaneos: RailSnapshot[] = [
      snapshot({ current: 'credential', credentialsReady: true }),
      snapshot({ current: 'credential', destinations: ['spotify', 'youtube'], lineCount: 40 }),
      snapshot({ current: 'destinations', lineCount: 40, credentialsReady: true }),
      snapshot({ current: 'input', destinations: ['spotify'], lineCount: 0 }),
    ];

    for (const instantaneo of instantaneos) {
      const pendentes = composeRail(instantaneo).filter((s) => s.state === 'pending');
      for (const degrauPendente of pendentes) {
        expect(
          degrauPendente.support.kind,
          `${degrauPendente.step} está pendente e derivou uma linha de apoio`,
        ).toBe('neutral');
      }
    }
  });
});

describe('FR-067 · a etapa atual declara uma linha, a concluída declara outra', () => {
  it('Configuração em curso é neutra, mesmo com credencial já salva', () => {
    // Enquanto a etapa é a atual, a linha diz **o que fazer**. Só depois de
    // concluída ela diz **o que foi decidido**.
    const rail = composeRail(snapshot({ current: 'credential', credentialsReady: true }));
    expect(degrau(rail, 'credential')?.state).toBe('current');
    expect(degrau(rail, 'credential')?.support).toEqual({ kind: 'neutral' });
  });

  it('Configuração concluída deriva, e a linha difere da que ela tinha enquanto atual', () => {
    const atual = composeRail(snapshot({ current: 'credential', credentialsReady: true }));
    const concluida = composeRail(
      snapshot({ current: 'destinations', credentialsReady: true }),
    );

    expect(degrau(concluida, 'credential')?.state).toBe('done');
    expect(degrau(concluida, 'credential')?.support).toEqual({
      kind: 'derived',
      value: t.rail.derived.credential,
    });
    expect(degrau(concluida, 'credential')?.support).not.toEqual(
      degrau(atual, 'credential')?.support,
    );
  });

  it('etapa concluída sem valor real volta a ser neutra, em vez de afirmar um vazio', () => {
    const rail = composeRail(snapshot({ current: 'destinations', credentialsReady: false }));
    expect(degrau(rail, 'credential')?.state).toBe('done');
    expect(degrau(rail, 'credential')?.support).toEqual({ kind: 'neutral' });
  });
});

describe('FR-014 · nenhuma fase do ciclo de serviço vira degrau', () => {
  it('a trilha tem no máximo os cinco degraus do fluxo, qualquer que seja o instantâneo', () => {
    // Seis fases por serviço × dois serviços seriam doze linhas a mais. A fase
    // corrente é informação de apoio da tela de Serviço, não da trilha.
    const rail = composeRail(
      snapshot({ current: 'service', destinations: ['spotify', 'youtube'], lineCount: 40 }),
    );

    expect(rail).toHaveLength(5);
    expect(rail.map((s) => s.step)).toEqual([
      'credential',
      'destinations',
      'input',
      'service',
      'summary',
    ]);
  });
});

describe('estados dos degraus', () => {
  it('exatamente um degrau é "current" em cada etapa do fluxo', () => {
    const etapas = ['credential', 'destinations', 'input', 'service', 'summary'] as const;
    for (const etapa of etapas) {
      const rail = composeRail(
        snapshot({ current: etapa, destinations: ['spotify', 'youtube'] }),
      );
      expect(
        rail.filter((s) => s.state === 'current'),
        `a etapa ${etapa} não produziu exatamente um degrau atual`,
      ).toHaveLength(1);
    }
  });

  it('tudo antes da atual é "done" e tudo depois é "pending"', () => {
    const rail = composeRail(
      snapshot({ current: 'input', destinations: ['spotify', 'youtube'] }),
    );
    expect(rail.map((s) => s.state)).toEqual(['done', 'done', 'current', 'pending', 'pending']);
  });
});
