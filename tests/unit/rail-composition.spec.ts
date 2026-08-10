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
  servicesFinished: 0,
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

  it('nenhum degrau sem valor decidido produz linha derivada', () => {
    // A guarda que impede a afirmação falsa **não é o estado do degrau**: é a
    // ausência de valor. Estes instantâneos exercem os quatro casos em que um
    // dado ainda não existe, com o degrau em estados diferentes.
    const instantaneos: RailSnapshot[] = [
      snapshot({ current: 'credential' }),
      snapshot({ current: 'credential', destinations: [], lineCount: 0 }),
      snapshot({ current: 'destinations', lineCount: 0 }),
      snapshot({ current: 'input', destinations: ['spotify'], lineCount: 0 }),
    ];

    for (const instantaneo of instantaneos) {
      const rail = composeRail(instantaneo);
      expect(degrau(rail, 'input')?.support.kind).toBe('neutral');
      expect(degrau(rail, 'service')?.support.kind).toBe('neutral');
      expect(degrau(rail, 'summary')?.support.kind ?? 'neutral').toBe('neutral');
    }
  });
});

/**
 * 008/FR-028 — a regra de derivação passou a ser **uma só**.
 *
 * A 007 tinha duas: "deriva quando há valor" e "só degrau concluído deriva". A
 * segunda produzia um efeito que o arquivo de design contradiz — na etapa
 * Destinos corrente, com os dois serviços já marcados, a linha continuava
 * dizendo "Escolha onde criar as playlists" em vez de nomear o que foi
 * escolhido. FR-028 revoga a segunda regra e mantém a primeira.
 *
 * **Isto não afrouxa FR-066**: a proibição de afirmar uma escolha que o usuário
 * não fez nunca dependeu do estado do degrau, e sim da ausência de valor. Os
 * casos do bloco anterior continuam valendo, palavra por palavra.
 */
describe('008/FR-028 · deriva quando há valor, em qualquer estado do degrau', () => {
  it('Configuração em curso **deriva**, com credencial já salva', () => {
    // Era o caso oposto na 007. O que mudou é a regra, e o motivo está escrito:
    // se o valor existe, a linha o diz — não importa se o degrau é o corrente.
    const rail = composeRail(snapshot({ current: 'credential', credentialsReady: true }));
    expect(degrau(rail, 'credential')?.state).toBe('current');
    expect(degrau(rail, 'credential')?.support).toEqual({
      kind: 'derived',
      value: t.rail.derived.credential,
    });
  });

  it('AC-4 · a etapa Destinos deriva **com ela própria como corrente**', () => {
    /*
      O caso que o defeito da fonte esconderia. Enquanto a etapa Destinos é a
      corrente, `queue.order` está vazia — a `ExecutionQueue` só é construída ao
      sair da etapa Entrada. Se o instantâneo continuasse sendo montado a partir
      dela, esta linha derivaria de uma lista vazia e ficaria neutra para
      sempre, sem que nada falhasse.
    */
    const rail = composeRail(
      snapshot({ current: 'destinations', destinations: ['spotify', 'youtube'] }),
    );

    const destinos = degrau(rail, 'destinations');
    expect(destinos?.state).toBe('current');
    expect(destinos?.support.kind).toBe('derived');
    const valor = destinos?.support.kind === 'derived' ? destinos.support.value : '';
    expect(valor).toContain(t.providers.spotify.name);
    expect(valor).toContain(t.providers.youtube.name);
  });

  it('AC-5 · a etapa Destinos continua derivada ao voltar para Configuração', () => {
    // O degrau passa de `current` para `pending` — **à frente** da etapa
    // corrente — e a linha não pode desaparecer: a escolha continua feita.
    const rail = composeRail(
      snapshot({ current: 'credential', destinations: ['spotify', 'youtube'] }),
    );

    const destinos = degrau(rail, 'destinations');
    expect(destinos?.state).toBe('pending');
    expect(destinos?.support.kind).toBe('derived');
  });

  it('a derivação vale igualmente em degrau concluído, corrente e à frente', () => {
    // A mesma etapa, o mesmo valor, os três estados. Se a linha mudasse com o
    // estado, a regra teria voltado a ser duas.
    const linhaDe = (current: RailSnapshot['current']) =>
      degrau(composeRail(snapshot({ current, lineCount: 40 })), 'input')?.support;

    const concluido = linhaDe('service');
    const corrente = linhaDe('input');
    const aFrente = linhaDe('credential');

    expect(corrente).toEqual(concluido);
    expect(aFrente).toEqual(concluido);
    expect(concluido?.kind).toBe('derived');
  });

  it('FR-029 · a etapa Destinos não afirma escolha nenhuma antes da escolha', () => {
    // A borda que a regra única **não** cruza. Sem destino marcado, a linha é
    // neutra em qualquer estado do degrau — inclusive corrente.
    for (const current of ['credential', 'destinations', 'input'] as const) {
      const rail = composeRail(snapshot({ current, destinations: [] }));
      expect(
        degrau(rail, 'destinations')?.support,
        `com a etapa ${current} corrente, Destinos afirmou uma escolha inexistente`,
      ).toEqual({ kind: 'neutral' });
    }
  });

  it('etapa concluída sem valor real volta a ser neutra, em vez de afirmar um vazio', () => {
    const rail = composeRail(snapshot({ current: 'destinations', credentialsReady: false }));
    expect(degrau(rail, 'credential')?.state).toBe('done');
    expect(degrau(rail, 'credential')?.support).toEqual({ kind: 'neutral' });
  });
});

/**
 * 008/research §R7 — a etapa Serviço deriva de execuções **encerradas**.
 *
 * O ponto que a Fase 1 do planejamento descobriu e que a avaliação inicial não
 * tinha: com a guarda de estado removida, derivar de `destinations.length` faria
 * a trilha dizer "2 serviços concluídos" no instante em que o segundo destino é
 * marcado — muito antes de qualquer serviço concluir. A correção é do **valor**,
 * não da regra.
 */
describe('008/FR-028 e FR-029 · a etapa Serviço conta o que terminou', () => {
  it('com dois destinos e nada executado, a linha é neutra', () => {
    const rail = composeRail(
      snapshot({
        current: 'destinations',
        destinations: ['spotify', 'youtube'],
        servicesFinished: 0,
      }),
    );
    expect(degrau(rail, 'service')?.support).toEqual({ kind: 'neutral' });
  });

  it('com um serviço encerrado, a linha conta um — não dois', () => {
    const rail = composeRail(
      snapshot({
        current: 'service',
        destinations: ['spotify', 'youtube'],
        servicesFinished: 1,
      }),
    );

    const valor =
      degrau(rail, 'service')?.support.kind === 'derived'
        ? (degrau(rail, 'service')?.support as { value: string }).value
        : '';
    expect(valor).toContain('1');
    expect(valor).not.toContain('2');
  });

  it('a contagem não acompanha o número de destinos', () => {
    // A asserção que trava a regressão: mais destinos, mesma linha.
    const umDestino = composeRail(
      snapshot({ current: 'service', destinations: ['spotify'], servicesFinished: 1 }),
    );
    const doisDestinos = composeRail(
      snapshot({
        current: 'service',
        destinations: ['spotify', 'youtube'],
        servicesFinished: 1,
      }),
    );

    expect(degrau(doisDestinos, 'service')?.support).toEqual(
      degrau(umDestino, 'service')?.support,
    );
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
