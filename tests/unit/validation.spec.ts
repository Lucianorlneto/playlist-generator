import { describe, expect, it } from 'vitest';

import { canCreate, normalizePlaylistName, validatePlaylistName } from '@/domain/validation';
import { emptyPlaylistConfig, type PlaylistConfig } from '@/domain/types';

import { makeCandidate, makeItem, makeLine } from '../fixtures/factories';

function config(overrides: Partial<PlaylistConfig> = {}): PlaylistConfig {
  return { ...emptyPlaylistConfig(), name: 'Clássicos', ...overrides };
}

const selecionado = () =>
  makeItem({
    line: makeLine({ id: 'l0', index: 0 }),
    candidates: [makeCandidate({ id: 'a' })],
    included: true,
  });

describe('validatePlaylistName (FR-028, FR-029)', () => {
  it('bloqueia nome vazio', () => {
    expect(validatePlaylistName('', [])).toMatchObject({ ok: false, reason: 'name_empty' });
  });

  it('trata nome só com espaços como vazio', () => {
    expect(validatePlaylistName('    ', [])).toMatchObject({ ok: false, reason: 'name_empty' });
  });

  it('aceita nome inédito', () => {
    expect(validatePlaylistName('Clássicos', ['Outra'])).toEqual({ ok: true });
  });

  it('bloqueia nome repetido ignorando caixa', () => {
    expect(validatePlaylistName('clássicos', ['CLÁSSICOS'])).toMatchObject({
      ok: false,
      reason: 'name_duplicate',
    });
  });

  it('bloqueia nome repetido ignorando espaços de borda', () => {
    expect(validatePlaylistName('  Clássicos  ', ['Clássicos'])).toMatchObject({
      ok: false,
      reason: 'name_duplicate',
    });
  });

  it('não ignora acento — são nomes diferentes para o usuário', () => {
    expect(validatePlaylistName('Classicos', ['Clássicos'])).toEqual({ ok: true });
  });

  it('bloqueia quando a consulta de nomes não concluiu', () => {
    expect(validatePlaylistName('Clássicos', null)).toMatchObject({
      ok: false,
      reason: 'name_check_incomplete',
    });
  });

  it('normalizePlaylistName aplica trim e caixa baixa', () => {
    expect(normalizePlaylistName('  Meus SONS  ')).toBe('meus sons');
  });
});

describe('canCreate — as quatro regras na ordem de data-model.md', () => {
  it('nome vazio vence qualquer outra falha', () => {
    expect(canCreate([], config({ name: '   ' }), null)).toMatchObject({ reason: 'name_empty' });
  });

  it('nome duplicado vem antes da checagem de seleção', () => {
    expect(canCreate([], config(), ['Clássicos'])).toMatchObject({ reason: 'name_duplicate' });
  });

  it('bloqueia quando nenhuma faixa está selecionada (FR-035)', () => {
    const itens = [makeItem({ line: makeLine({ id: 'l0', index: 0 }), included: false })];
    expect(canCreate(itens, config(), [])).toMatchObject({ reason: 'no_tracks_selected' });
  });

  it('bloqueia quando todas as linhas ficaram sem correspondência', () => {
    const itens = [
      makeItem({
        line: makeLine({ id: 'l0', index: 0 }),
        status: 'not_found',
        candidates: [],
        selectedUri: null,
        included: false,
      }),
    ];
    expect(canCreate(itens, config(), [])).toMatchObject({ reason: 'no_tracks_selected' });
  });

  it('bloqueia quando a consulta de nomes falhou, mesmo com tudo mais válido', () => {
    expect(canCreate([selecionado()], config(), null)).toMatchObject({
      reason: 'name_check_incomplete',
    });
  });

  it('libera quando as quatro regras passam', () => {
    expect(canCreate([selecionado()], config(), ['Outra'])).toEqual({ ok: true });
  });

  it('item marcado sem faixa escolhida não conta como seleção', () => {
    const itens = [
      makeItem({
        line: makeLine({ id: 'l0', index: 0 }),
        candidates: [],
        selectedUri: null,
        included: true,
      }),
    ];
    expect(canCreate(itens, config(), [])).toMatchObject({ reason: 'no_tracks_selected' });
  });
});
