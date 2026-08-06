import { describe, expect, it } from 'vitest';

import {
  createCodeChallenge,
  createCodeVerifier,
  createState,
  randomBase64Url,
  STATE_BYTES,
} from '@/services/providers/spotify/pkce';

const BASE64URL = /^[A-Za-z0-9_-]+$/;

describe('PKCE (research §1)', () => {
  it('gera code_verifier aleatório em base64url', () => {
    const first = createCodeVerifier();
    const second = createCodeVerifier();

    expect(first).toMatch(BASE64URL);
    expect(first).not.toBe(second);
    // 32 bytes em base64 sem preenchimento = 43 caracteres.
    expect(first).toHaveLength(43);
  });

  it('o code_challenge é base64url(SHA-256(verifier))', async () => {
    const verifier = 'verificador-de-teste';
    const challenge = await createCodeChallenge(verifier);

    // Valor calculado de forma independente a partir do mesmo verifier.
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    const expected = btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    expect(challenge).toBe(expected);
    expect(challenge).toMatch(BASE64URL);
    expect(challenge).not.toContain('=');
  });

  it('o mesmo verifier sempre produz o mesmo desafio', async () => {
    const verifier = createCodeVerifier();
    expect(await createCodeChallenge(verifier)).toBe(await createCodeChallenge(verifier));
  });

  it('o state tem 32 bytes de aleatoriedade', () => {
    const state = createState();
    expect(state).toMatch(BASE64URL);
    expect(state).toHaveLength(43);
    expect(STATE_BYTES).toBe(32);
  });

  it('não repete valores em uma amostra grande', () => {
    const amostra = new Set(Array.from({ length: 200 }, () => randomBase64Url(32)));
    expect(amostra.size).toBe(200);
  });
});
