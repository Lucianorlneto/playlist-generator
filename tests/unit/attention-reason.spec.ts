import { describe, expect, it } from 'vitest';

import { capabilitiesOf } from '@/domain/providers';
import { parseLine } from '@/domain/parser';
import { classifyLine } from '@/domain/scoring';
import type { AttentionReason, InputLine, VersionHint } from '@/domain/types';

/**
 * Motivo de atenção como **dado** (`003/FR-017`, research §10,
 * `data-model §2`).
 *
 * O domínio decide o motivo, a interface decide a frase. É o que torna FR-017
 * verificável sem renderizar componente — o motivo é uma asserção sobre um
 * valor — e o que respeita o Princípio III.
 */
const T = capabilitiesOf('spotify').thresholds;

function explicita(): InputLine {
  return parseLine('Zoio de Lula - Charlie Brown Jr', 0, 'l0');
}

function soloTitulo(): InputLine {
  return parseLine('Não Sei Viver Sem Ter Você', 0, 'l0');
}

function cand(score: number, artists: string[] = ['Outro'], versionHints?: VersionHint[]) {
  return { score, artists, ...(versionHints === undefined ? {} : { versionHints }) };
}

describe('os quatro motivos de FR-017', () => {
  it('no_artist_ambiguous — sem artista confirmado e sem candidata dominante', () => {
    const { status, attentionReason } = classifyLine(soloTitulo(), [cand(1), cand(0.99)], T);
    expect(status).toBe('uncertain');
    expect(attentionReason).toBe('no_artist_ambiguous');
  });

  it('version_hint — indício de que a candidata é outra versão', () => {
    const { attentionReason } = classifyLine(
      explicita(),
      [cand(0.99, ['Charlie Brown Jr'], ['live'])],
      T,
    );
    expect(attentionReason).toBe('version_hint');
  });

  it('not_found — a busca não trouxe nada utilizável', () => {
    expect(classifyLine(explicita(), [], T).attentionReason).toBe('not_found');
    expect(classifyLine(explicita(), [cand(0.1)], T).attentionReason).toBe('not_found');
  });

  /**
   * `retry_skipped_quota` precisa existir separado de `not_found` porque a ação
   * do usuário é diferente: aqui a linha pode estar certa e o app é que
   * desistiu; ali o texto provavelmente precisa de correção. Apresentar um como
   * o outro faria o usuário reescrever uma linha correta (research §10).
   */
  it('retry_skipped_quota — havia retentativa a fazer e a reserva acabou', () => {
    const { status, attentionReason } = classifyLine(explicita(), [], T, true);
    expect(status).toBe('not_found');
    expect(attentionReason).toBe('retry_skipped_quota');
  });
});

describe('invariante M1 — confiante não pede olhar humano', () => {
  it('status confident sempre traz motivo nulo', () => {
    const casos: { linha: InputLine; candidatas: ReturnType<typeof cand>[] }[] = [
      { linha: explicita(), candidatas: [cand(0.99, ['Charlie Brown Jr'])] },
      { linha: soloTitulo(), candidatas: [cand(1), cand(0.1)] },
      { linha: parseLine('zoio de lula charlie brown jr', 0, 'l0'), candidatas: [cand(0.95, ['Charlie Brown Jr'])] },
    ];

    for (const { linha, candidatas } of casos) {
      const resultado = classifyLine(linha, candidatas, T);
      expect(resultado.status, linha.raw).toBe('confident');
      expect(resultado.attentionReason, linha.raw).toBeNull();
    }
  });
});

describe('invariante M2 — retry_skipped_quota implica not_found', () => {
  it('a recíproca é falsa: nem todo not_found é reserva esgotada', () => {
    const semReserva = classifyLine(explicita(), [], T, true);
    const semResultado = classifyLine(explicita(), [], T, false);

    expect(semReserva.status).toBe('not_found');
    expect(semReserva.attentionReason).toBe('retry_skipped_quota');
    expect(semResultado.status).toBe('not_found');
    expect(semResultado.attentionReason).toBe('not_found');
  });

  /**
   * A linha que retentaria mas não pôde, e ainda assim trouxe algo abaixo do
   * limiar: o `status` diz o desfecho, o motivo diz a causa.
   */
  it('a reserva esgotada prevalece mesmo havendo candidatas fracas', () => {
    const { status, attentionReason } = classifyLine(explicita(), [cand(0.1)], T, true);
    expect(status).toBe('not_found');
    expect(attentionReason).toBe('retry_skipped_quota');
  });
});

/**
 * Invariante M3. Sem ordem fixa, o motivo exibido dependeria da ordem de
 * avaliação e o teste seria frágil.
 */
describe('invariante M3 — precedência fixa e determinística', () => {
  const ordem: AttentionReason[] = [
    'retry_skipped_quota',
    'not_found',
    'version_hint',
    'no_artist_ambiguous',
  ];

  it('retry_skipped_quota vence not_found', () => {
    expect(classifyLine(soloTitulo(), [], T, true).attentionReason).toBe(ordem[0]);
  });

  it('not_found vence version_hint', () => {
    // Abaixo do piso **e** com indício: o desfecho é não encontrada.
    const { attentionReason } = classifyLine(soloTitulo(), [cand(0.1, ['X'], ['cover'])], T);
    expect(attentionReason).toBe('not_found');
  });

  it('version_hint vence no_artist_ambiguous', () => {
    // Linha sem artista declarado **e** com indício na melhor candidata.
    const { attentionReason } = classifyLine(
      soloTitulo(),
      [cand(0.9, ['CPM 22'], ['live']), cand(0.89)],
      T,
    );
    expect(attentionReason).toBe('version_hint');
  });

  it('a precedência é total: com os quatro cabendo, vence o primeiro', () => {
    const { attentionReason } = classifyLine(
      soloTitulo(),
      [cand(0.1, ['X'], ['karaoke'])],
      T,
      true,
    );
    expect(attentionReason).toBe('retry_skipped_quota');
  });

  it('o mesmo cenário avaliado duas vezes dá o mesmo motivo', () => {
    const cenario = () => classifyLine(soloTitulo(), [cand(0.9, ['CPM 22'], ['live']), cand(0.89)], T);
    expect(cenario().attentionReason).toBe(cenario().attentionReason);
  });
});
