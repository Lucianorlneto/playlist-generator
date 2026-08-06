import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PROVIDER_ORDER } from '@/domain/providers';
import {
  ALLOWED_ORIGINS,
  isAllowedForProvider,
  isAllowedUrl,
  PROVIDER_HOSTS,
} from '@/services/providers/hosts';

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

describe('Princípio II — nenhum segredo de cliente, em nenhum provedor', () => {
  it('encontrou arquivos para inspecionar', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('nenhum arquivo de src/ menciona client_secret ou clientSecret', () => {
    const ofensores = files
      .filter((file) => /client_secret|clientSecret/u.test(file.text))
      .map((file) => file.path);

    expect(ofensores).toEqual([]);
  });

  /** Ampliado para os segredos que cada plataforma poderia sugerir. */
  it('nenhum arquivo menciona segredo de nenhuma plataforma', () => {
    const padroes = [
      /client[_-]?secret/iu,
      /\bapi[_-]?key\b/iu,
      /\bservice[_-]?account\b/iu,
      /\bprivate[_-]?key\b/iu,
    ];
    const ofensores = files
      .filter((file) => padroes.some((padrao) => padrao.test(file.text)))
      .map((file) => file.path);

    expect(ofensores).toEqual([]);
  });

  it('nenhum arquivo lê credencial de variável de ambiente (FR-004)', () => {
    const ofensores = files
      .filter((file) => /import\.meta\.env\.VITE_[A-Z_]*(?:CLIENT|SECRET|TOKEN|KEY)/u.test(file.text))
      .map((file) => file.path);

    expect(ofensores).toEqual([]);
  });
});

describe('Princípio II — a tabela de hosts, provedor a provedor', () => {
  /**
   * A comparação é **entrada a entrada** e falha tanto por host ausente quanto
   * por host excedente — o Princípio IV exige exatamente isso. Uma comparação
   * frouxa (só "contém") deixaria passar um host novo adicionado sem emenda.
   */
  it('a tabela é exatamente a do Princípio II', () => {
    expect(PROVIDER_HOSTS).toEqual({
      spotify: ['https://accounts.spotify.com', 'https://api.spotify.com', 'https://i.scdn.co'],
      youtube: ['https://accounts.google.com', 'https://www.googleapis.com', 'https://i.ytimg.com'],
    });
  });

  it('cada provedor declara exatamente três hosts, e nenhum é compartilhado', () => {
    for (const provider of PROVIDER_ORDER) {
      expect(PROVIDER_HOSTS[provider]).toHaveLength(3);
    }
    const todos = Object.values(PROVIDER_HOSTS).flat();
    expect(new Set(todos).size).toBe(todos.length);
    expect(ALLOWED_ORIGINS).toHaveLength(6);
  });

  it('a tabela cobre todos os provedores registrados — nem a mais, nem a menos', () => {
    expect(Object.keys(PROVIDER_HOSTS).sort()).toEqual([...PROVIDER_ORDER].sort());
  });

  it('isAllowedForProvider isola os provedores entre si', () => {
    expect(isAllowedForProvider('spotify', 'https://api.spotify.com/v1/me')).toBe(true);
    expect(isAllowedForProvider('youtube', 'https://api.spotify.com/v1/me')).toBe(false);
    expect(isAllowedForProvider('youtube', 'https://www.googleapis.com/youtube/v3/search')).toBe(
      true,
    );
    expect(isAllowedForProvider('spotify', 'https://www.googleapis.com/youtube/v3/search')).toBe(
      false,
    );
  });

  it('isAllowedUrl recusa qualquer outro host', () => {
    expect(isAllowedUrl('https://api.spotify.com/v1/me')).toBe(true);
    expect(isAllowedUrl('https://accounts.google.com/o/oauth2/v2/auth')).toBe(true);
    expect(isAllowedUrl('https://i.ytimg.com/vi/abc/default.jpg')).toBe(true);
    expect(isAllowedUrl('https://exemplo.com/coleta')).toBe(false);
    expect(isAllowedUrl('https://api.spotify.com.exemplo.com/')).toBe(false);
    expect(isAllowedUrl('https://googleapis.com/youtube/v3/search')).toBe(false);
    expect(isAllowedUrl('não é uma url')).toBe(false);
  });

  /**
   * A distinção precisa estar escrita: `open.spotify.com`, `www.youtube.com` e
   * os dois consoles aparecem **apenas como `href` exibido ao usuário**, nunca
   * como destino de requisição (research §14). Sem esta lista explícita, a
   * próxima leitura do teste interpretaria a exceção como brecha.
   */
  it('toda URL absoluta em src/ é host autorizado ou link exibido', () => {
    const linkExibidoNaoDestinoDeRede = [
      'https://developer.spotify.com',
      'https://open.spotify.com',
      'https://www.youtube.com',
      'https://console.cloud.google.com',
    ];

    const ofensores: string[] = [];
    for (const file of files) {
      for (const match of file.text.matchAll(/https?:\/\/[^\s'"`)]+/gu)) {
        const url = match[0].replace(/[.,;]+$/u, '');
        if (linkExibidoNaoDestinoDeRede.some((permitida) => url.startsWith(permitida))) continue;
        if (url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost')) continue;
        if (url.startsWith('http://www.w3.org')) continue;
        if (!isAllowedUrl(url)) ofensores.push(`${file.path}: ${url}`);
      }
    }

    expect(ofensores).toEqual([]);
  });

  it('nenhum arquivo fora de services/providers chama fetch', () => {
    const ofensores = files
      .filter((file) => !file.path.includes('services/providers'))
      .filter((file) => /\bfetch\s*\(/u.test(file.text))
      .map((file) => file.path);

    // Todo I/O de rede vive em src/services/providers — é o que torna a lista
    // de hosts auditável em um lugar só (Princípio II).
    expect(ofensores).toEqual([]);
  });

  /**
   * Regra do contrato de provedor §1: fora de `services/providers/{id}/`,
   * nenhum arquivo ramifica por `ProviderId`. A exceção deliberada é a camada
   * de i18n e a sua resolução, que precisa de texto específico por serviço.
   */
  it('nenhuma tela ramifica por ProviderId', () => {
    const excecoes = [
      join('services', 'providers'),
      join('domain', 'providers.ts'),
      join('features', 'credential', 'providerText.ts'),
      join('services', 'storage'),
      join('store', 'credentialSlice.ts'),
      join('app', 'bootstrap.ts'),
      join('features', 'connect', 'callback.ts'),
    ];

    const ofensores = files
      .filter((file) => !excecoes.some((excecao) => file.path.includes(excecao)))
      .filter((file) => /===\s*'(spotify|youtube)'|'(spotify|youtube)'\s*===/u.test(file.text))
      .map((file) => file.path);

    expect(ofensores).toEqual([]);
  });
});
