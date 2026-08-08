import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  APPROVED_PAIR_COUNT,
  APPROVED_PAIRS,
  THEMES,
  type ThemeName,
  type TokenName,
} from '@/domain/theme/approvedPairs';
import { CONTRAST_MINIMUM, contrastRatio, roundRatio } from '@/domain/theme/contrast';

/**
 * Portão de contraste — FR-030, SC-001.
 *
 * A autoridade sobre os números é **este teste**, não a tabela de
 * `contracts/tokens.md` §2 nem o guia de estilo: os dois descrevem o que o
 * cálculo produz. Divergência se resolve corrigindo o documento (FR-036).
 *
 * Os valores são lidos de `src/styles/tokens.css`, a origem única. Nenhum hex é
 * repetido neste arquivo — um teste que carrega sua própria cópia dos valores
 * mede a si mesmo e passa mesmo depois de o produto mudar de cor.
 */

const TOKENS_CSS = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8');

/**
 * Remove comentários antes de qualquer varredura.
 *
 * `tokens.css` é fortemente comentado, e sem esta limpeza o corpo do comentário
 * fica entre `}` e o seletor seguinte, quebrando o reconhecimento de regra.
 */
function withoutComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//gu, '');
}

/** Remove os blocos `@media`, para que o parser veja só as regras de topo. */
function withoutMediaBlocks(css: string): string {
  let out = '';
  let index = 0;
  while (index < css.length) {
    const start = css.indexOf('@media', index);
    if (start === -1) {
      out += css.slice(index);
      break;
    }
    out += css.slice(index, start);
    // Avança até a chave de abertura e depois até a que a fecha.
    let cursor = css.indexOf('{', start);
    let depth = 1;
    cursor += 1;
    while (cursor < css.length && depth > 0) {
      if (css[cursor] === '{') depth += 1;
      if (css[cursor] === '}') depth -= 1;
      cursor += 1;
    }
    index = cursor;
  }
  return out;
}

/** Corpo de todas as regras cujo seletor é exatamente `selector`. */
function bodiesOf(css: string, selector: string): string[] {
  const bodies: string[] = [];
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const pattern = new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{`, 'gu');
  let match = pattern.exec(css);
  while (match !== null) {
    const open = match.index + match[0].length;
    let depth = 1;
    let cursor = open;
    while (cursor < css.length && depth > 0) {
      if (css[cursor] === '{') depth += 1;
      if (css[cursor] === '}') depth -= 1;
      cursor += 1;
    }
    bodies.push(css.slice(open, cursor - 1));
    pattern.lastIndex = cursor;
    match = pattern.exec(css);
  }
  return bodies;
}

/** Declarações `--nome: #hex;` de um corpo de regra. */
function hexDeclarations(body: string): Map<string, string> {
  const found = new Map<string, string>();
  const pattern = /(--[a-z0-9-]+)\s*:\s*(#[0-9a-f]{3,8})\s*;/giu;
  let match = pattern.exec(body);
  while (match !== null) {
    const [, name, value] = match;
    if (name !== undefined && value !== undefined) found.set(name, value);
    match = pattern.exec(body);
  }
  return found;
}

const CLEAN_CSS = withoutComments(TOKENS_CSS);
const topLevel = withoutMediaBlocks(CLEAN_CSS);

const lightTokens = new Map<string, string>();
for (const body of bodiesOf(topLevel, ':root')) {
  for (const [name, value] of hexDeclarations(body)) lightTokens.set(name, value);
}

/** O tema escuro herda o claro e sobrescreve — como no navegador. */
const darkTokens = new Map(lightTokens);
for (const body of bodiesOf(topLevel, "[data-theme='dark']")) {
  for (const [name, value] of hexDeclarations(body)) darkTokens.set(name, value);
}

const byTheme: Record<ThemeName, Map<string, string>> = {
  light: lightTokens,
  dark: darkTokens,
};

function resolve(token: TokenName, theme: ThemeName): string {
  const value = byTheme[theme].get(token);
  if (value === undefined) {
    throw new Error(
      `Token ${token} não está definido no tema ${theme} em src/styles/tokens.css. ` +
        'Todo token de cor existe nos dois temas; definição parcial é erro (contracts/tokens.md §6).',
    );
  }
  return value;
}

describe('FR-030 · a lista de pares aprovados está íntegra', () => {
  it('o parser encontrou os valores brutos em src/styles/tokens.css', () => {
    expect(lightTokens.size).toBeGreaterThanOrEqual(14);
    expect(darkTokens.size).toBeGreaterThanOrEqual(14);
  });

  it('a lista fechada mantém as 15 combinações declaradas em contracts/tokens.md §2', () => {
    expect(APPROVED_PAIRS).toHaveLength(APPROVED_PAIR_COUNT);
  });

  it('nenhuma combinação aparece duas vezes', () => {
    const chaves = APPROVED_PAIRS.map((p) => `${p.foreground} sobre ${p.background} (${p.usage})`);
    expect(new Set(chaves).size).toBe(chaves.length);
  });
});

describe('contracts/tokens.md §6 · todo token de cor existe nos dois temas', () => {
  it('o tema escuro sobrescreve todos os 14 tokens de cor, sem herdar valor do claro', () => {
    const overrides = new Map<string, string>();
    for (const body of bodiesOf(topLevel, "[data-theme='dark']")) {
      for (const [name, value] of hexDeclarations(body)) overrides.set(name, value);
    }
    const naoSobrescritos = [...new Set(APPROVED_PAIRS.flatMap((p) => [p.foreground, p.background]))]
      .filter((token) => !overrides.has(token))
      .sort();
    expect(naoSobrescritos).toEqual([]);
  });

  it('o bloco prefers-color-scheme repete exatamente os valores de [data-theme=dark]', () => {
    // Sem isto, quem nunca escolheu tema veria um escuro diferente de quem
    // escolheu — divergência que só aparece em produção, na tela de alguém.
    const mediaStart = CLEAN_CSS.indexOf('@media (prefers-color-scheme: dark)');
    expect(mediaStart).toBeGreaterThan(-1);

    const mediaTokens = hexDeclarations(CLEAN_CSS.slice(mediaStart));
    const atributoTokens = new Map<string, string>();
    for (const body of bodiesOf(topLevel, "[data-theme='dark']")) {
      for (const [name, value] of hexDeclarations(body)) atributoTokens.set(name, value);
    }

    for (const [name, value] of atributoTokens) {
      expect(mediaTokens.get(name), `${name} diverge entre @media e [data-theme='dark']`).toBe(
        value,
      );
    }
  });
});

describe.each(THEMES)('FR-030 e SC-001 · contraste no tema %s', (theme) => {
  it.each(
    APPROVED_PAIRS.map((pair) => [
      `${pair.foreground} sobre ${pair.background} — ${pair.where}`,
      pair,
    ] as const),
  )('%s', (_nome, pair) => {
    const minimo = CONTRAST_MINIMUM[pair.usage];
    const razao = contrastRatio(resolve(pair.foreground, theme), resolve(pair.background, theme));

    expect(
      roundRatio(razao),
      `${pair.foreground} sobre ${pair.background} no tema ${theme}: ` +
        `${roundRatio(razao)}:1, abaixo do mínimo de ${minimo}:1 para uso "${pair.usage}"`,
    ).toBeGreaterThanOrEqual(minimo);
  });
});

describe('FR-046 · texto claro sobre âmbar é proibido em qualquer contexto', () => {
  it.each(THEMES)('no tema %s, branco sobre --accent reprova e por isso não é par aprovado', (theme) => {
    const razao = contrastRatio('#ffffff', resolve('--accent', theme));
    expect(razao).toBeLessThan(CONTRAST_MINIMUM.text);

    const existe = APPROVED_PAIRS.some(
      (p) => p.background === '--accent' && p.foreground !== '--accent-ink',
    );
    expect(existe).toBe(false);
  });
});
