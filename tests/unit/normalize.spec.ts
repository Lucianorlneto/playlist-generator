import { describe, expect, it } from 'vitest';

import {
  normalizeText,
  removeDiacritics,
  removeNumberingPrefix,
  stripPromoSuffixes,
  tokenize,
} from '@/domain/normalize';

describe('Normalização (research §6)', () => {
  it('remove acentos', () => {
    expect(removeDiacritics('Águas de Março')).toBe('Aguas de Marco');
    expect(normalizeText('Garota de Ipanema')).toBe(normalizeText('Garôta de Ipanemá'));
  });

  it('ignora diferenças de caixa', () => {
    expect(normalizeText('BOHEMIAN RHAPSODY')).toBe(normalizeText('bohemian rhapsody'));
  });

  it('remove prefixos de numeração', () => {
    expect(removeNumberingPrefix('1. Bohemian Rhapsody')).toBe('Bohemian Rhapsody');
    expect(removeNumberingPrefix('12) Imagine')).toBe('Imagine');
    expect(removeNumberingPrefix('- Hey Jude')).toBe('Hey Jude');
    expect(removeNumberingPrefix('• Wonderwall')).toBe('Wonderwall');
    expect(removeNumberingPrefix('* Yesterday')).toBe('Yesterday');
  });

  it('não confunde numeração com título que começa com número', () => {
    expect(removeNumberingPrefix('99 Problems')).toBe('99 Problems');
    expect(normalizeText('7 Rings')).toBe('7 rings');
  });

  it('remove sufixos promocionais', () => {
    expect(stripPromoSuffixes('Águas de Março (Official Video)')).toBe('Águas de Março');
    expect(stripPromoSuffixes('Imagine [Lyrics]')).toBe('Imagine');
    expect(stripPromoSuffixes('Evidências (Clipe Oficial)')).toBe('Evidências');
    expect(stripPromoSuffixes('Numb (Official Music Video)')).toBe('Numb');
    expect(stripPromoSuffixes('Faded (Audio)')).toBe('Faded');
    expect(stripPromoSuffixes('Believer HD')).toBe('Believer');
  });

  it('preserva variantes de gravação — elas mudam a faixa', () => {
    expect(stripPromoSuffixes('Song (Remix)')).toBe('Song (Remix)');
    expect(stripPromoSuffixes('Song (Live)')).toBe('Song (Live)');
    expect(stripPromoSuffixes('Canção (Ao Vivo)')).toBe('Canção (Ao Vivo)');
    expect(stripPromoSuffixes('Song (Acoustic)')).toBe('Song (Acoustic)');
    expect(stripPromoSuffixes('Song (2011 Remaster)')).toBe('Song (2011 Remaster)');
  });

  it('preserva o grupo de feat. — quem o consome é o parser', () => {
    expect(stripPromoSuffixes('Song (feat. Alguém)')).toBe('Song (feat. Alguém)');
  });

  it('colapsa pontuação e espaços', () => {
    expect(normalizeText("  Don't   Stop!!  Me,  Now  ")).toBe('don t stop me now');
  });

  it('tokeniza sobre o texto já normalizado', () => {
    expect(tokenize('Águas de Março (Official Video)')).toEqual(['aguas', 'de', 'marco']);
    expect(tokenize('   ')).toEqual([]);
  });

  it('é idempotente', () => {
    const once = normalizeText('1. Águas de Março (Official Video)');
    expect(normalizeText(once)).toBe(once);
  });
});
