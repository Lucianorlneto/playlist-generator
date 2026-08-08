import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { THEME_PREFERENCES } from '@/domain/theme';
import { RECORD_SCHEMA_VERSION, STORAGE_KEYS } from '@/services/storage/schema';

/**
 * A contenção da única duplicação estrutural da feature (contracts/storage.md §5).
 *
 * `public/theme-boot.js` precisa ler a chave de tema **antes** de qualquer
 * módulo carregar, sob `script-src 'self'`. Vive fora de `src/`, não passa pelo
 * TypeScript e não pode importar `STORAGE_KEYS` — então a chave, a versão do
 * registro e o nome do campo estão duplicados.
 *
 * Isso é dívida conhecida, não descuido, e sem este teste a primeira renomeação
 * de chave produziria uma piscada de tema que nenhuma suíte pegaria: ela só
 * apareceria em produção, na segunda visita de um usuário com preferência
 * manual divergente do sistema.
 */

const BOOT = readFileSync(join(process.cwd(), 'public/theme-boot.js'), 'utf8');

/** O texto sem comentários — para não confundir menção com uso. */
const CODE = BOOT.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');

describe('contracts/storage.md §5 · theme-boot.js em sincronia com STORAGE_KEYS', () => {
  it('contém literalmente a chave exportada por STORAGE_KEYS.theme', () => {
    expect(CODE).toContain(`'${STORAGE_KEYS.theme}'`);
  });

  it('referencia o campo `preference` do registro', () => {
    expect(CODE).toMatch(/\.preference\b/u);
  });

  it('confere a versão do registro contra RECORD_SCHEMA_VERSION', () => {
    expect(CODE).toMatch(new RegExp(`schemaVersion\\s*!==\\s*${RECORD_SCHEMA_VERSION}\\b`, 'u'));
  });

  it.each(THEME_PREFERENCES)('trata o valor válido "%s"', (preference) => {
    expect(CODE).toContain(`'${preference}'`);
  });

  it('escreve o atributo `data-theme` no elemento raiz', () => {
    expect(CODE).toMatch(/documentElement/u);
    expect(CODE).toMatch(/setAttribute\(\s*'data-theme'/u);
  });

  it('não escreve atributo quando a preferência é "system" — o CSS decide', () => {
    expect(CODE).toMatch(/removeAttribute\(\s*'data-theme'/u);
  });
});

describe('Princípio II e FR-011 · o script não pode derrubar nem vazar', () => {
  it('todo o acesso ao armazenamento está sob try/catch', () => {
    expect(CODE).toMatch(/try\s*\{/u);
    expect(CODE).toMatch(/catch\s*\(/u);
  });

  it('é script clássico: nenhum import, export ou sintaxe de módulo', () => {
    expect(CODE).not.toMatch(/\bimport\b/u);
    expect(CODE).not.toMatch(/\bexport\b/u);
  });

  it('não alcança a rede nem hospeda origem remota', () => {
    expect(CODE).not.toMatch(/https?:\/\//u);
    expect(CODE).not.toMatch(/\bfetch\b|XMLHttpRequest/u);
  });

  it('não toca nenhuma outra chave de armazenamento', () => {
    const chaves = CODE.match(/'tp\.[a-z0-9.]+'/gu) ?? [];
    expect([...new Set(chaves)]).toEqual([`'${STORAGE_KEYS.theme}'`]);
  });
});

describe('FR-010 · index.html carrega o script antes do bundle', () => {
  // Sem os comentários: o `index.html` explica por escrito por que o script
  // clássico precisa vir antes do `<script type="module">`, e citar a tag no
  // comentário não pode contar como usá-la.
  const HTML = readFileSync(join(process.cwd(), 'index.html'), 'utf8').replace(
    /<!--[\s\S]*?-->/gu,
    '',
  );

  it('referencia theme-boot.js', () => {
    expect(HTML).toMatch(/<script src="\.\/theme-boot\.js"><\/script>/u);
  });

  it('o script clássico vem antes do módulo — que é adiado por definição', () => {
    const boot = HTML.indexOf('theme-boot.js');
    const bundle = HTML.indexOf('type="module"');
    expect(boot).toBeGreaterThan(-1);
    expect(bundle).toBeGreaterThan(-1);
    expect(boot).toBeLessThan(bundle);
  });

  it('não existe script inline — o CSP de produção o bloquearia', () => {
    // `<script>` sem `src` é inline. O build injeta `script-src 'self'`, e um
    // inline aqui quebraria só em produção (research §2).
    const inline = HTML.match(/<script(?![^>]*\ssrc=)[^>]*>/gu) ?? [];
    expect(inline).toEqual([]);
  });
});
