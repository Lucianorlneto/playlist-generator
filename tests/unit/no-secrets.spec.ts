import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ALLOWED_ORIGINS, isAllowedUrl } from '@/services/spotify/hosts';

// O Vitest roda com a raiz do projeto como diretório de trabalho.
const SRC = join(process.cwd(), 'src');

function allSourceFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) {
      found.push(...allSourceFiles(full));
      continue;
    }
    if (/\.(ts|tsx|css)$/u.test(entry)) found.push(full);
  }
  return found;
}

const files = allSourceFiles(SRC).map((path) => ({ path, text: readFileSync(path, 'utf8') }));

describe('FR-005 — nenhum segredo de cliente no código', () => {
  it('encontrou arquivos para inspecionar', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('nenhum arquivo de src/ menciona client_secret ou clientSecret', () => {
    const ofensores = files
      .filter((file) => /client_secret|clientSecret/u.test(file.text))
      .map((file) => file.path);

    expect(ofensores).toEqual([]);
  });

  it('nenhum arquivo lê credencial de variável de ambiente (FR-001)', () => {
    const ofensores = files
      .filter((file) => /import\.meta\.env\.VITE_[A-Z_]*(?:CLIENT|SECRET|TOKEN)/u.test(file.text))
      .map((file) => file.path);

    expect(ofensores).toEqual([]);
  });
});

describe('FR-010 — nenhum destino de rede fora da lista autorizada', () => {
  it('a lista autorizada é exatamente a de contracts/spotify-api.md', () => {
    expect(ALLOWED_ORIGINS).toEqual([
      'https://accounts.spotify.com',
      'https://api.spotify.com',
      'https://i.scdn.co',
    ]);
  });

  it('toda URL absoluta em src/ aponta para um host autorizado ou para documentação', () => {
    // Endereços de documentação aparecem como link para o usuário, não como
    // destino de requisição — por isso entram nesta exceção explícita.
    const documentacao = ['https://developer.spotify.com', 'https://open.spotify.com'];

    const ofensores: string[] = [];
    for (const file of files) {
      for (const match of file.text.matchAll(/https?:\/\/[^\s'"`)]+/gu)) {
        const url = match[0].replace(/[.,;]+$/u, '');
        if (documentacao.some((permitida) => url.startsWith(permitida))) continue;
        if (url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost')) continue;
        if (url.startsWith('http://www.w3.org')) continue;
        if (!isAllowedUrl(url)) ofensores.push(`${file.path}: ${url}`);
      }
    }

    expect(ofensores).toEqual([]);
  });

  it('isAllowedUrl recusa qualquer outro host', () => {
    expect(isAllowedUrl('https://api.spotify.com/v1/me')).toBe(true);
    expect(isAllowedUrl('https://accounts.spotify.com/api/token')).toBe(true);
    expect(isAllowedUrl('https://i.scdn.co/image/abc')).toBe(true);
    expect(isAllowedUrl('https://exemplo.com/coleta')).toBe(false);
    expect(isAllowedUrl('https://api.spotify.com.exemplo.com/')).toBe(false);
    expect(isAllowedUrl('não é uma url')).toBe(false);
  });

  it('nenhum arquivo de src/ chama fetch com URL montada fora dos helpers de host', () => {
    const ofensores = files
      .filter((file) => !file.path.includes('services/spotify'))
      .filter((file) => /\bfetch\s*\(/u.test(file.text))
      .map((file) => file.path);

    // Todo I/O de rede vive em src/services/spotify — é o que torna a lista de
    // hosts auditável em um lugar só.
    expect(ofensores).toEqual([]);
  });
});
