import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import tp from './eslint-rules/index.js';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      // Templates de skill do agente. Não são código do projeto e rodam em
      // outro ambiente (p5.js), então as globais deles não existem aqui.
      '.claude/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { tp },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['src/**/*.tsx'],
    plugins: { tp, 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'tp/no-ui-text-literals': 'error',
      'tp/no-dynamic-classname': 'error',
    },
  },
  {
    /**
     * `public/theme-boot.js` é script clássico de navegador, servido como está.
     * Não passa pelo TypeScript nem pelo bundler — daí as globais explícitas e
     * o `sourceType: 'script'`. A contenção da duplicação que ele carrega é
     * `tests/unit/theme-boot-sync.spec.ts`, não o lint (contracts/storage.md §5).
     */
    files: ['public/**/*.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'script',
      globals: globals.browser,
    },
    rules: {
      'no-empty': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    /**
     * `docs/theme-guidelines/build.mjs` é ferramenta de autoria, executada com
     * `node`. O corpo de `page.evaluate` roda no navegador, então as duas
     * famílias de globais valem, e o relatório de saída é o produto do script.
     */
    files: ['docs/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    rules: { 'no-console': 'off' },
  },
  {
    // Onde a decisão visual é tomada é onde a regra precisa valer (research §10).
    files: ['src/features/**/*.{ts,tsx}', 'src/app/**/*.{ts,tsx}', 'src/ui/**/*.{ts,tsx}'],
    plugins: { tp },
    rules: { 'tp/no-raw-visual-values': 'error' },
  },
  {
    /**
     * A fechadura em volta da biblioteca de ícones vale para **todo** o `src/`,
     * não só para as camadas visuais: o ponto é que exista um único lugar onde
     * o mapa de papéis é escrito, e um `import` num serviço ou num slice do
     * store abriria o mesmo buraco que um `import` numa tela (007/FR-059).
     *
     * O próprio `src/ui/icons.ts` é a exceção, resolvida dentro da regra.
     */
    files: ['src/**/*.{ts,tsx}'],
    plugins: { tp },
    rules: { 'tp/no-icon-library-import': 'error' },
  },
  {
    /**
     * A fechadura em volta da biblioteca de movimento, pelo mesmo motivo e no
     * mesmo alcance da de ícones: o ponto é que exista **um** lugar onde o
     * movimento é escrito, e um `import` num slice do store abriria o mesmo
     * buraco que um numa tela (009/FR-010b).
     *
     * O próprio `src/ui/motion/` é a exceção, resolvida dentro da regra.
     */
    files: ['src/**/*.{ts,tsx}'],
    plugins: { tp },
    rules: { 'tp/no-motion-library-import': 'error' },
  },
  {
    // O módulo de textos é justamente onde os literais devem estar.
    files: ['src/i18n/**/*.ts', 'src/i18n/**/*.tsx'],
    rules: { 'tp/no-ui-text-literals': 'off' },
  },
  {
    files: ['tests/**/*.{ts,tsx}', 'e2e/**/*.ts', '*.config.{ts,js}'],
    rules: {
      'tp/no-ui-text-literals': 'off',
      'no-console': 'off',
    },
  },
);
