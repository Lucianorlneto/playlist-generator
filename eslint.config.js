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
