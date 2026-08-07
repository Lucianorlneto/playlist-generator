/**
 * V1 — `isSessionLevel`, a regra que separa "esta linha falhou" de "a execução
 * perdeu autorização" (`004/E1` a `E3`,
 * [provider-contract §2](../../specs/004-youtube-reconnect/contracts/provider-contract.md)).
 *
 * A lista é **fechada e afirmativa**: só `reauth_required` e `session_expired`
 * derrubam a execução. Um `kind` desconhecido devolve `false` de propósito — erra
 * para "falha de linha", que é o comportamento de hoje e o menos destrutivo.
 * Errar para o outro lado transformaria qualquer falha nova em modal de
 * reconexão que o usuário não pode resolver.
 *
 * `quota_exhausted` fica de fora **por decisão estrutural**, não por esquecimento
 * (E2): a precedência de cota já encerra a execução por outro caminho, e
 * reconectar não devolve orçamento algum.
 */

import { describe, expect, it } from 'vitest';

import { AppError, isSessionLevel, type AppErrorKind } from '@/services/providers/errors';

const SESSAO: AppErrorKind[] = ['reauth_required', 'session_expired'];

const NAO_SESSAO: AppErrorKind[] = [
  'quota_exhausted',
  'forbidden',
  'not_found',
  'rate_limited',
  'server_error',
  'offline',
  'network',
  'search_line_failed',
  'add_items_failed',
  'create_playlist_failed',
  'playlist_list_failed',
  'auth_access_denied',
  'auth_invalid_client',
  'auth_redirect_uri_mismatch',
  'auth_state_mismatch',
  'auth_invalid_grant',
  'auth_not_verified',
  'auth_generic',
  'unexpected',
];

describe('V1/E1 — verdadeira exatamente para as duas falhas de sessão', () => {
  for (const kind of SESSAO) {
    it(`${kind} derruba a execução`, () => {
      expect(isSessionLevel(new AppError(kind, { provider: 'youtube' }))).toBe(true);
    });
  }

  for (const kind of NAO_SESSAO) {
    it(`${kind} continua sendo falha de linha`, () => {
      expect(isSessionLevel(new AppError(kind, { provider: 'youtube' }))).toBe(false);
    });
  }
});

describe('E2 — cota esgotada não é perda de sessão', () => {
  it('quota_exhausted é falsa mesmo sendo terminal', () => {
    const erro = new AppError('quota_exhausted', { provider: 'youtube' });
    expect(erro.terminal).toBe(true);
    expect(isSessionLevel(erro)).toBe(false);
  });
});

describe('E1 — `kind` desconhecido erra para falha de linha', () => {
  it('um kind fora do catálogo devolve false', () => {
    const erro = new AppError('unexpected', { provider: 'youtube' });
    // Simula um `kind` que ainda não existe: a regra é afirmativa, então
    // qualquer valor fora da lista fechada cai no lado seguro.
    Object.defineProperty(erro, 'kind', { value: 'kind_que_ainda_nao_existe' });
    expect(isSessionLevel(erro)).toBe(false);
  });
});

describe('E3 — a regra é uma só para os dois catálogos', () => {
  it('não depende do provedor', () => {
    for (const provider of ['spotify', 'youtube'] as const) {
      expect(isSessionLevel(new AppError('reauth_required', { provider }))).toBe(true);
      expect(isSessionLevel(new AppError('not_found', { provider }))).toBe(false);
    }
  });

  it('vale também sem provedor atribuído', () => {
    expect(isSessionLevel(new AppError('session_expired'))).toBe(true);
  });
});
