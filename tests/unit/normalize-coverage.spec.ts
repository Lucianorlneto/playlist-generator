import { describe, expect, it } from 'vitest';

import { coverage, tokenSet, tokensMatch, TOKEN_MATCH_RATIO } from '@/domain/normalize';

/**
 * Primitivas de comparação por conjunto (`003/contracts/domain-api.md §2`,
 * research §3). São a base das duas coberturas que a forma livre combina — se
 * a assimetria daqui se perder, FR-013 deixa de valer sem que nada mais quebre.
 */
describe('tokenSet — termos normalizados e sem repetição', () => {
  it('normaliza acento, caixa e pontuação', () => {
    expect(tokenSet('Não Sei Viver, Sem Ter Você!')).toEqual([
      'nao',
      'sei',
      'viver',
      'sem',
      'ter',
      'voce',
    ]);
  });

  it('elimina repetição preservando a ordem de primeira aparição', () => {
    expect(tokenSet('amor amor perfeito amor')).toEqual(['amor', 'perfeito']);
  });

  it('texto sem conteúdo alfanumérico vira conjunto vazio', () => {
    expect(tokenSet('---')).toEqual([]);
    expect(tokenSet('🎵')).toEqual([]);
    expect(tokenSet('')).toEqual([]);
  });
});

describe('tokensMatch — igualdade tolerante a erro de digitação', () => {
  it('aceita erro de uma letra em termo longo', () => {
    expect(tokensMatch('bohemian', 'bohemiam')).toBe(true);
    expect(tokensMatch('californication', 'californcation')).toBe(true);
  });

  /**
   * O limiar é de **razão**, não de contagem: duas edições em oito letras
   * (`bohemian` → `bohemain`, uma transposição) passam de 0,15 e são recusadas.
   * Aceitá-las exigiria baixar `TOKEN_MATCH_RATIO` para todo o resto junto.
   */
  it('duas edições em termo de oito letras já é demais', () => {
    expect(tokensMatch('bohemian', 'bohemain')).toBe(false);
  });

  it('recusa termos distintos', () => {
    expect(tokensMatch('queen', 'green')).toBe(false);
    expect(tokensMatch('imagine', 'woman')).toBe(false);
  });

  /**
   * `de` e `da` distam 1 de 2 caracteres. Sem o piso de comprimento, toda
   * preposição casaria com toda preposição e a cobertura de qualquer linha em
   * português subiria por ruído gramatical.
   */
  it('não tolera erro em termo curto', () => {
    expect(tokensMatch('de', 'da')).toBe(false);
    expect(tokensMatch('sem', 'ser')).toBe(false);
    expect(tokensMatch('de', 'de')).toBe(true);
  });

  it('o limiar declarado é o de contrato', () => {
    expect(TOKEN_MATCH_RATIO).toBe(0.85);
  });
});

describe('coverage — assimétrica por construção (FR-013)', () => {
  it('coverage(A, B) ≠ coverage(B, A)', () => {
    const linha = tokenSet('amor');
    const titulo = tokenSet('Amor Perfeito');

    expect(coverage(linha, titulo)).toBe(1);
    expect(coverage(titulo, linha)).toBe(0.5);
  });

  /**
   * O caso que FR-013 existe para proteger: a linha não escreveu o artista, e
   * essa ausência **não** pode contar contra ela.
   */
  it('termo que a linha não escreveu não entra na conta dela', () => {
    const linha = tokenSet('Não sei viver sem ter você');
    const tituloMaisArtista = tokenSet('Não sei viver sem ter você CPM 22');

    expect(coverage(linha, tituloMaisArtista)).toBe(1);
  });

  it('tolera erro de digitação dentro de um termo', () => {
    expect(coverage(tokenSet('bohemiam rhapsody'), tokenSet('Bohemian Rhapsody'))).toBe(1);
  });

  it('conjunto vazio cobre zero — nunca tudo', () => {
    expect(coverage([], tokenSet('qualquer coisa'))).toBe(0);
    expect(coverage([], [])).toBe(0);
  });

  it('nada em comum cobre zero', () => {
    expect(coverage(tokenSet('imagine'), tokenSet('Bohemian Rhapsody'))).toBe(0);
  });
});
