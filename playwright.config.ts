import { defineConfig, devices } from '@playwright/test';

const PORT = 5173;
/**
 * `E2E_BASE_URL` aponta a suíte para uma instância já servida — é como SC-008 é
 * verificado: o mesmo fluxo roda contra o `dist/` publicado por um servidor de
 * arquivos estáticos, sem o dev server do Vite no caminho.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const USE_EXTERNAL_SERVER = process.env.E2E_BASE_URL !== undefined;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      // SC-012: o fluxo completo tem de caber em 375 px sem rolagem horizontal.
      name: 'narrow-375',
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 667 } },
    },
    {
      /**
       * 009/SC-003 e 010/FR-014, SC-005: quem pediu para reduzir movimento
       * recebe a mesma informação sem giro, sem pulsação e sem transição.
       *
       * **Sem `testMatch`, de propósito** (010/T004). A 009 só tinha movimento no
       * cartão de criação; a 010 leva movimento ao fluxo inteiro, e o SC-005 é
       * medido tela a tela. Restringir este projeto a um arquivo deixaria a maior
       * parte da supressão sem portão de ponta a ponta.
       *
       * Um projeto próprio, e não uma opção dentro de um teste, porque a
       * preferência é opção de **contexto** no Playwright — mudá-la a meio
       * teste exigiria recriar o contexto e perder o estado do fluxo. O viewport
       * é o do `desktop` de propósito: o que varia entre os dois é a preferência
       * e nada mais (009/contracts/motion.md §5).
       *
       * A preferência vai em `contextOptions` porque é onde esta versão do
       * Playwright a expõe; `use.reducedMotion` de topo não existe no tipo.
       */
      name: 'reduced-motion',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        contextOptions: { reducedMotion: 'reduce' },
      },
    },
  ],
  ...(USE_EXTERNAL_SERVER
    ? {}
    : {
        webServer: {
          command: 'npm run dev',
          url: BASE_URL,
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
        },
      }),
});
