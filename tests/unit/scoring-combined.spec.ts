import { describe, expect, it } from 'vitest';

import { parseLine } from '@/domain/parser';
import { artistClaimed, scoreCandidate, scoreCombined, scoreForShape } from '@/domain/scoring';
import { UNCERTAIN_THRESHOLD } from '@/domain/scoring/thresholds';
import type { InputLine, TrackCandidateRaw } from '@/domain/types';

function candidate(title: string, artists: string[]): TrackCandidateRaw {
  return {
    uri: 'spotify:track:x',
    id: 'x',
    title,
    artists,
    album: 'Album',
    durationMs: 200_000,
    coverUrl: null,
    externalUrl: 'https://open.spotify.com/track/x',
  };
}

function line(raw: string): InputLine {
  return parseLine(raw, 0, 'l0');
}

const NAO_SEI_VIVER = candidate('Não Sei Viver Sem Ter Você', ['CPM 22']);

// ---------------------------------------------------------------------------
// §3 — cobertura combinada
// ---------------------------------------------------------------------------

describe('003/§3 — cobertura combinada por média harmônica (FR-013)', () => {
  /** A tabela verificada de research §3, número a número. */
  const tabela: { linha: string; candidata: TrackCandidateRaw; esperado: number }[] = [
    { linha: 'nao sei viver sem ter voce cpm 22', candidata: NAO_SEI_VIVER, esperado: 1 },
    { linha: 'Não sei viver sem ter voce', candidata: NAO_SEI_VIVER, esperado: 1 },
    { linha: 'amor', candidata: candidate('Amor Perfeito', ['Alguém']), esperado: 2 / 3 },
    { linha: 'cpm 22', candidata: NAO_SEI_VIVER, esperado: 0 },
  ];

  it.each(tabela)('$linha → $esperado', ({ linha, candidata, esperado }) => {
    expect(scoreCombined(line(linha), candidata)).toBeCloseTo(esperado, 4);
  });

  /**
   * Os dois exemplos do pedido original, que hoje nem chegam a ser buscados.
   * Ambos em 1,00: a linha inteira é explicada e o título inteiro reivindicado.
   */
  it('os dois exemplos do pedido pontuam no máximo', () => {
    expect(scoreCombined(line('nao sei viver sem ter voce cpm 22'), NAO_SEI_VIVER)).toBe(1);
    expect(scoreCombined(line('Não sei viver sem ter voce'), NAO_SEI_VIVER)).toBe(1);
  });

  /**
   * O que FR-013 proíbe, verificado diretamente: escrever o artista não pode
   * **piorar** a pontuação, e omiti-lo não pode piorá-la tampouco. Uma medida
   * simétrica daria 6/8 para a segunda linha, punindo-a pela ausência.
   */
  it('a ausência do artista não conta contra a linha', () => {
    const comArtista = scoreCombined(line('nao sei viver sem ter voce cpm 22'), NAO_SEI_VIVER);
    const semArtista = scoreCombined(line('Não sei viver sem ter voce'), NAO_SEI_VIVER);
    expect(semArtista).toBe(comArtista);
  });

  /**
   * O caso de borda "linha que é só o nome do artista": a média harmônica zera
   * quando qualquer cobertura zera, sem precisar de regra especial.
   */
  it('linha que é só o artista é descartada, sem regra especial', () => {
    expect(scoreCombined(line('cpm 22'), NAO_SEI_VIVER)).toBe(0);
    expect(scoreCombined(line('queen'), candidate('Bohemian Rhapsody', ['Queen']))).toBe(0);
  });

  it('título genérico não casa por conter a linha', () => {
    // `amor` está inteiro no título, mas reivindica só metade dele.
    expect(scoreCombined(line('amor'), candidate('Amor Perfeito', ['X']))).toBeLessThan(0.7);
  });

  it('nada em comum pontua zero', () => {
    expect(scoreCombined(line('Imagine John Lennon'), NAO_SEI_VIVER)).toBe(0);
  });

  it('linha sem conteúdo alfanumérico pontua zero', () => {
    expect(scoreCombined(line('---'), NAO_SEI_VIVER)).toBe(0);
  });

  it('SC-006 — a forma acentuada e a sem acento em caixa baixa são equivalentes', () => {
    const acentuada = scoreCombined(line('Não Sei Viver Sem Ter Você CPM 22'), NAO_SEI_VIVER);
    const plana = scoreCombined(line('nao sei viver sem ter voce cpm 22'), NAO_SEI_VIVER);
    expect(plana).toBe(acentuada);
  });
});

// ---------------------------------------------------------------------------
// §4 — artista reivindicado
// ---------------------------------------------------------------------------

describe('003/§4 — artista reivindicado decide se a margem se aplica', () => {
  const charlieBrown = candidate('Zoio de Lula', ['Charlie Brown Jr']);

  it('artista parcialmente escrito ainda reivindica (2/3 ≥ 0,6)', () => {
    expect(artistClaimed(line('zoio de lula charlie brown'), charlieBrown)).toBe(true);
  });

  it('artista inteiro reivindica', () => {
    expect(artistClaimed(line('zoio de lula charlie brown jr'), charlieBrown)).toBe(true);
  });

  it('coincidência de uma palavra em nome longo NÃO reivindica', () => {
    const orquestra = candidate('Bohemian Rhapsody', ['The Royal Philharmonic Tribute Orchestra']);
    // Só `orchestra` aparece: 1/5 = 0,2.
    expect(artistClaimed(line('bohemian rhapsody orchestra'), orquestra)).toBe(false);
  });

  it('linha sem nenhum termo do artista não reivindica', () => {
    expect(artistClaimed(line('Não sei viver sem ter voce'), NAO_SEI_VIVER)).toBe(false);
  });

  it('candidata sem artista algum nunca é reivindicada', () => {
    expect(artistClaimed(line('qualquer coisa'), candidate('Título', []))).toBe(false);
  });

  it('a linha explícita reivindica pelo artista que declarou', () => {
    expect(artistClaimed(line('Zoio de Lula - Charlie Brown Jr'), charlieBrown)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// §7 — reparo de falso corte
// ---------------------------------------------------------------------------

describe('003/§7 — falso corte é resolvido na pontuação, não na consulta', () => {
  /**
   * `Marília Mendonça - Ao Vivo` é cortada em título `Marília Mendonça` e
   * artista `Ao Vivo`. Pela via declarada a candidata certa pontua mal — o
   * "título" comparado é o nome da artista. A comparação combinada sobre a linha
   * inteira reconhece a candidata, e o reparo custa zero em rede.
   */
  it('Marília Mendonça - Ao Vivo é recuperada pela comparação combinada', () => {
    const falsoCorte = line('Marília Mendonça - Ao Vivo');
    const correta = candidate('Infiel (Ao Vivo)', ['Marília Mendonça']);

    expect(falsoCorte.shape).toBe('explicit');
    expect(scoreCandidate(falsoCorte, correta)).toBeLessThan(UNCERTAIN_THRESHOLD);

    const reparada = scoreForShape(falsoCorte, correta, UNCERTAIN_THRESHOLD);
    expect(reparada).toBeGreaterThanOrEqual(UNCERTAIN_THRESHOLD);
    expect(reparada).toBe(scoreCombined(falsoCorte, correta));
  });

  /**
   * SC-011 depende disto: o reparo só alcança a faixa **abaixo do piso**. Uma
   * linha explícita que já pontua bem não é reavaliada, e por isso nenhuma linha
   * hoje corretamente classificada pode mudar de classe.
   */
  it('linha explícita acima do piso NÃO é reavaliada', () => {
    const boa = line('Bohemian Rhapsody - Queen');
    const correta = candidate('Bohemian Rhapsody', ['Queen']);

    const declarada = scoreCandidate(boa, correta);
    expect(declarada).toBeGreaterThanOrEqual(UNCERTAIN_THRESHOLD);
    expect(scoreForShape(boa, correta, UNCERTAIN_THRESHOLD)).toBe(declarada);
  });

  it('o reparo nunca reduz a pontuação — prevalece a maior das duas', () => {
    const linhaExplicita = line('Faixa Estranha - Artista Estranho');
    const qualquer = candidate('Outra Coisa', ['Ninguém']);

    const declarada = scoreCandidate(linhaExplicita, qualquer);
    expect(scoreForShape(linhaExplicita, qualquer, UNCERTAIN_THRESHOLD)).toBeGreaterThanOrEqual(
      declarada,
    );
  });

  it('a forma livre nunca passa pela via declarada', () => {
    const livre = line('nao sei viver sem ter voce cpm 22');
    expect(scoreForShape(livre, NAO_SEI_VIVER, UNCERTAIN_THRESHOLD)).toBe(
      scoreCombined(livre, NAO_SEI_VIVER),
    );
  });
});
