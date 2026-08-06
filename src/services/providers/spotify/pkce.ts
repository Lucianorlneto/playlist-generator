/**
 * Primitivos do PKCE (research §1).
 *
 * `code_challenge_method=S256`: o desafio é o SHA-256 do verifier, em base64url.
 * É o que permite provar posse do código sem nenhum segredo de cliente — a
 * condição que torna possível rodar tudo no navegador (FR-005, FR-006).
 */

/** 32 bytes ≈ 43 caracteres base64url, dentro da faixa exigida pela RFC 7636. */
export const VERIFIER_BYTES = 32;
export const STATE_BYTES = 32;

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function randomBase64Url(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export function createCodeVerifier(): string {
  return randomBase64Url(VERIFIER_BYTES);
}

export function createState(): string {
  return randomBase64Url(STATE_BYTES);
}

export async function createCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return toBase64Url(new Uint8Array(digest));
}
