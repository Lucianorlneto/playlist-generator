import { describe, expect, it } from 'vitest';

import { capabilitiesOf } from '@/domain/providers';
import { parseLine } from '@/domain/parser';
import { classifyLine, type SoloThresholds } from '@/domain/scoring';
import type { InputLine, VersionHint } from '@/domain/types';

/**
 * Regra de margem para linha sem artista confirmado (`003/FR-014`, research §5).
 *
 * A propriedade que a margem mede — "esta candidata se destaca?" — é a que a
 * pontuação absoluta **não** mede. Com a renormalização de §2, um título isolado
 * com correspondência exata pontua 1,0 mesmo quando existem cinco gravações do
 * mesmo título por artistas diferentes, todas em 1,0. Sem margem, o sistema
 * escolheria uma delas em silêncio.
 */
const SPOTIFY: SoloThresholds = capabilitiesOf('spotify').thresholds;

function line(raw: string): InputLine {
  return parseLine(raw, 0, 'l0');
}

interface Cand {
  score: number;
  artists: string[];
  versionHints?: VersionHint[];
}

function cand(score: number, artists: string[] = ['Outro Artista'], hints?: VersionHint[]): Cand {
  return { score, artists, ...(hints === undefined ? {} : { versionHints: hints }) };
}

describe('FR-014a — sem artista confirmado, confiante exige limiar E margem', () => {
  const soloTitulo = line('Não Sei Viver Sem Ter Você');

  it('margem larga sobre a segunda: resolve sozinha', () => {
    const { status, attentionReason } = classifyLine(
      soloTitulo,
      [cand(1), cand(0.3)],
      SPOTIFY,
    );

    expect(status).toBe('confident');
    expect(attentionReason).toBeNull();
  });

  it('empate técnico entre a 1ª e a 2ª vira incerta', () => {
    const { status, attentionReason } = classifyLine(
      soloTitulo,
      [cand(1), cand(0.99)],
      SPOTIFY,
    );

    expect(status).toBe('uncertain');
    expect(attentionReason).toBe('no_artist_ambiguous');
  });

  /**
   * A fronteira é a margem declarada, e a decisão é monotônica em torno dela.
   *
   * O último bit **não** é comportamento especificado: `1 − 0,9` dá
   * `0,09999999999999998` em ponto flutuante, e um par que nominalmente empata
   * com a margem pode cair de qualquer lado. Fixar isso exigiria um epsilon
   * arbitrário na regra; o que importa e é verificável é que afastar a segunda
   * candidata só pode ajudar, e aproximá-la só pode atrapalhar.
   */
  it('a decisão é monotônica em torno da margem declarada', () => {
    const margem = SPOTIFY.soloMargin;

    const confortavelmenteAcima = classifyLine(soloTitulo, [cand(1), cand(1 - margem * 2)], SPOTIFY);
    const confortavelmenteAbaixo = classifyLine(soloTitulo, [cand(1), cand(1 - margem / 2)], SPOTIFY);

    expect(confortavelmenteAcima.status).toBe('confident');
    expect(confortavelmenteAbaixo.status).toBe('uncertain');
  });

  it('afastar a segunda candidata nunca piora a classificação', () => {
    let viuConfiante = false;
    for (const segunda of [0.99, 0.95, 0.9, 0.8, 0.5, 0.1]) {
      const { status } = classifyLine(soloTitulo, [cand(1), cand(segunda)], SPOTIFY);
      if (status === 'confident') viuConfiante = true;
      // Uma vez confiante, nenhuma segunda **mais distante** pode voltar a duvidar.
      else expect(viuConfiante, `segunda em ${segunda}`).toBe(false);
    }
    expect(viuConfiante).toBe(true);
  });

  /** FR-014b: não há segunda contra a qual medir. */
  it('candidata única vira incerta, por mais alta que pontue', () => {
    const { status, attentionReason } = classifyLine(soloTitulo, [cand(1)], SPOTIFY);

    expect(status).toBe('uncertain');
    expect(attentionReason).toBe('no_artist_ambiguous');
  });

  it('passar a margem sem passar o limiar continua incerta', () => {
    const { status } = classifyLine(soloTitulo, [cand(0.7), cand(0.1)], SPOTIFY);
    expect(status).toBe('uncertain');
  });

  it('abaixo do piso é não encontrada, com margem ou sem', () => {
    const { status, attentionReason } = classifyLine(soloTitulo, [cand(0.2), cand(0.01)], SPOTIFY);
    expect(status).toBe('not_found');
    expect(attentionReason).toBe('not_found');
  });
});

describe('FR-014a — com artista declarado, a margem NÃO se aplica', () => {
  it('linha explícita com artista ignora a margem', () => {
    const explicita = line('Zoio de Lula - Charlie Brown Jr');
    const { status, attentionReason } = classifyLine(
      explicita,
      [cand(0.95), cand(0.94)],
      SPOTIFY,
    );

    expect(status).toBe('confident');
    expect(attentionReason).toBeNull();
  });

  it('linha explícita com artista e candidata única também resolve sozinha', () => {
    const explicita = line('Zoio de Lula - Charlie Brown Jr');
    expect(classifyLine(explicita, [cand(0.95)], SPOTIFY).status).toBe('confident');
  });

  /**
   * `003/research §4`: a reivindicação é decidida **pelos dados**. A linha livre
   * que confirma o artista da melhor candidata é tratada como se o tivesse
   * declarado — é o que separa os dois exemplos do pedido.
   */
  it('linha livre que reivindica o artista da melhor candidata ignora a margem', () => {
    const livre = line('zoio de lula charlie brown jr');
    const { status } = classifyLine(
      livre,
      [cand(0.95, ['Charlie Brown Jr']), cand(0.94, ['Outra Banda'])],
      SPOTIFY,
    );

    expect(status).toBe('confident');
  });

  it('linha livre que NÃO reivindica o artista cai na margem', () => {
    const livre = line('Não Sei Viver Sem Ter Você');
    const { status, attentionReason } = classifyLine(
      livre,
      [cand(0.95, ['CPM 22']), cand(0.94, ['Banda Cover'])],
      SPOTIFY,
    );

    expect(status).toBe('uncertain');
    expect(attentionReason).toBe('no_artist_ambiguous');
  });
});

/**
 * Regra 5 do contrato, e a extensão que a 003 acrescenta: o rebaixamento por
 * indício de versão vale nos **dois** ramos. Um indício em linha sem artista
 * declarado é, se algo, mais grave — não há artista para desempatar entre a
 * gravação oficial e o cover.
 */
describe('FR-015 — indício de versão rebaixa nas três formas de linha', () => {
  it('linha explícita com artista: indício rebaixa (invariante K2, 002/FR-025)', () => {
    const { status, attentionReason } = classifyLine(
      line('Zoio de Lula - Charlie Brown Jr'),
      [cand(0.99, ['Charlie Brown Jr'], ['live'])],
      SPOTIFY,
    );

    expect(status).toBe('uncertain');
    expect(attentionReason).toBe('version_hint');
  });

  it('linha SEM artista declarado: indício rebaixa mesmo com margem larga', () => {
    const { status, attentionReason } = classifyLine(
      line('Não Sei Viver Sem Ter Você'),
      [cand(1, ['CPM 22'], ['cover']), cand(0.2)],
      SPOTIFY,
    );

    expect(status).toBe('uncertain');
    expect(attentionReason).toBe('version_hint');
  });

  it('linha livre com artista reivindicado: indício rebaixa também', () => {
    const { status, attentionReason } = classifyLine(
      line('zoio de lula charlie brown jr'),
      [cand(0.99, ['Charlie Brown Jr'], ['karaoke'])],
      SPOTIFY,
    );

    expect(status).toBe('uncertain');
    expect(attentionReason).toBe('version_hint');
  });
});

describe('a via do YouTube é mais exigente, e isso é dado', () => {
  const YOUTUBE = capabilitiesOf('youtube').thresholds;

  it('a margem do catálogo de vídeo é maior que a do musical', () => {
    expect(YOUTUBE.soloMargin).toBeGreaterThan(SPOTIFY.soloMargin);
  });

  it('a mesma dupla de candidatas passa no Spotify e não passa no YouTube', () => {
    const soloTitulo = line('Não Sei Viver Sem Ter Você');
    const candidatas = [cand(1), cand(0.89)];

    expect(classifyLine(soloTitulo, candidatas, SPOTIFY).status).toBe('confident');
    expect(classifyLine(soloTitulo, candidatas, YOUTUBE).status).toBe('uncertain');
  });
});
