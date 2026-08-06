import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/**
 * Política de segurança de conteúdo do artefato de produção.
 *
 * `style-src 'self'` só é possível porque o Tailwind emite um `.css` estático no
 * build (research §8/§14). O dev server do Vite injeta CSS via `<style>` inline e
 * exigiria `'unsafe-inline'` — por isso a meta é injetada **apenas no build**, para
 * que o afrouxamento de desenvolvimento nunca vaze para produção.
 *
 * Os hosts permitidos espelham `PROVIDER_HOSTS` de `src/services/providers/hosts.ts`,
 * três por provedor (Princípio II). `accounts.google.com` fica **fora** de
 * `connect-src`: a autorização do YouTube é navegação de página inteira, não
 * `fetch` — por isso entra apenas em `form-action` (research §14).
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: https://i.scdn.co https://i.ytimg.com",
  "connect-src 'self' https://accounts.spotify.com https://api.spotify.com https://www.googleapis.com",
  "form-action 'self' https://accounts.spotify.com https://accounts.google.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

function cspOnBuildOnly(): Plugin {
  return {
    name: 'tp-csp-on-build-only',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return {
          html,
          tags: [
            {
              tag: 'meta',
              attrs: {
                'http-equiv': 'Content-Security-Policy',
                content: CONTENT_SECURITY_POLICY,
              },
              injectTo: 'head-prepend',
            },
          ],
        };
      },
    },
  };
}

export default defineConfig({
  // Caminhos relativos: permite servir o `dist/` de qualquer subdiretório de uma
  // hospedagem estática sem reconfigurar nada (SC-008).
  base: './',
  plugins: [react(), tailwindcss(), cspOnBuildOnly()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // IPv4 literal: a plataforma rejeita `localhost` como Redirect URI (research §2).
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
