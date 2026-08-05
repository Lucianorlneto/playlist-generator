import { describe, expect, it } from 'vitest';

import { computeRedirectUri, usesRejectedLocalhost } from '@/features/credential/redirectUri';

describe('Redirect URI calculado em tempo de execução (research §2)', () => {
  it('na raiz devolve origem mais barra', () => {
    const uri = computeRedirectUri({ origin: 'http://127.0.0.1:5173', pathname: '/' }, './');
    expect(uri).toBe('http://127.0.0.1:5173/');
  });

  it('em subdiretório preserva o diretório e a barra final', () => {
    const uri = computeRedirectUri(
      { origin: 'https://exemplo.com', pathname: '/apps/playlist/' },
      './',
    );
    expect(uri).toBe('https://exemplo.com/apps/playlist/');
  });

  it('remove o nome do arquivo quando a URL aponta para index.html', () => {
    const uri = computeRedirectUri(
      { origin: 'https://exemplo.com', pathname: '/apps/playlist/index.html' },
      './',
    );
    expect(uri).toBe('https://exemplo.com/apps/playlist/');
  });

  it('usa BASE_URL quando ele é absoluto', () => {
    const uri = computeRedirectUri(
      { origin: 'https://exemplo.com', pathname: '/qualquer/coisa' },
      '/base-fixa/',
    );
    expect(uri).toBe('https://exemplo.com/base-fixa/');
  });

  it('acrescenta a barra final ausente em BASE_URL absoluto', () => {
    const uri = computeRedirectUri({ origin: 'https://exemplo.com', pathname: '/' }, '/base');
    expect(uri).toBe('https://exemplo.com/base/');
  });

  it('sempre termina com barra — a correspondência da plataforma é exata', () => {
    const casos = [
      computeRedirectUri({ origin: 'http://127.0.0.1:5173', pathname: '/' }, './'),
      computeRedirectUri({ origin: 'https://exemplo.com', pathname: '/a/b/' }, './'),
      computeRedirectUri({ origin: 'https://exemplo.com', pathname: '/a/b/c.html' }, './'),
    ];
    for (const uri of casos) expect(uri.endsWith('/')).toBe(true);
  });

  it('reconhece o localhost que a plataforma rejeita', () => {
    expect(usesRejectedLocalhost('http://localhost:5173/')).toBe(true);
    expect(usesRejectedLocalhost('http://127.0.0.1:5173/')).toBe(false);
    expect(usesRejectedLocalhost('não é uma url')).toBe(false);
  });
});
