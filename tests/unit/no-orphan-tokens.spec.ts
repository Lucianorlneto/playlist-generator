import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Portão de token órfão — o critério objetivo de conclusão da Phase 4 (T059).
 *
 * Existe por um modo de falha específico do Tailwind: **utilitário inexistente
 * não é erro**. `bg-surface-sunken` depois de o token `--color-surface-sunken`
 * sair do tema não quebra o build, não falha no `typecheck` e não aparece em
 * log nenhum — a classe simplesmente não gera CSS, e a tela fica sem estilo.
 * Uma tela esquecida na migração é invisível até alguém abri-la.
 *
 * A lista de proibidos abaixo espelha `contracts/token-migration.md`. Ela é
 * denylist e não allowlist de propósito: a allowlist exigiria distinguir
 * `text-ink` de `text-center` e `border-rule` de `border-t`, e o custo dessa
 * distinção seria falso positivo — que erode a confiança no portão mais rápido
 * do que o falso negativo que ela evitaria.
 *
 * **Este teste falha de propósito enquanto a Phase 4 não termina.** É o que
 * torna "migrei todas as telas" verificável em vez de lembrada.
 */

const SRC = join(process.cwd(), 'src');

function sourceFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) {
      found.push(...sourceFiles(full));
      continue;
    }
    if (/\.(tsx|css)$/u.test(entry)) found.push(full);
  }
  return found;
}

/**
 * Neutraliza comentários preservando a numeração de linha.
 *
 * Sem isto o portão acusa a si mesmo: os comentários de `index.css` e deste
 * repositório citam nominalmente os utilitários proibidos para explicar por que
 * são proibidos. Um portão que não sabe distinguir uso de menção obriga quem
 * escreve documentação a inventar rodeios, e é assim que a documentação morre.
 *
 * Cada caractere do comentário vira espaço — não é removido — para que
 * `file:line` continue apontando para o lugar certo.
 */
function withoutComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//gu, (block) => block.replace(/[^\n]/gu, ' '))
    .replace(/^\s*\/\/.*$/gmu, (line) => line.replace(/[^\n]/gu, ' '));
}

const files = sourceFiles(SRC).map((path) => ({
  path: relative(process.cwd(), path),
  text: withoutComments(readFileSync(path, 'utf8')),
}));

/** Tokens de cor que deixaram de existir (contracts/token-migration.md §1–§4). */
const REMOVED_COLOR_TOKENS = [
  'surface-muted',
  'surface-sunken',
  'border-strong',
  'ink-inverse',
  'accent-strong',
  'accent-soft',
  'danger-soft',
  'danger',
  'status-confident-soft',
  'status-confident',
  'status-uncertain-soft',
  'status-uncertain',
  'status-not-found-soft',
  'status-not-found',
  'status-neutral-soft',
  'status-neutral',
] as const;

/**
 * `border-border` e `border-accent` precisam de tratamento próprio: o primeiro
 * porque `border` sozinho continua sendo utilitário válido de largura, o
 * segundo porque é proibido pelo FR-050 e não apenas removido.
 */
const COLOR_PREFIX =
  '(?:bg|text|border|ring|outline|fill|stroke|divide|decoration|placeholder|caret|from|via|to|shadow)';

/** Degraus válidos da escala de espaçamento (contracts/tokens.md §4). */
/**
 * Os degraus da escala de espaçamento.
 *
 * `0.5` entrou na feature 007: o arquivo de design usa 2px 73 vezes como respiro
 * entre título e linha de apoio, e colapsá-lo em 4px engordaria a trilha inteira
 * (`contracts/tokens.md` §4).
 */
const SPACING_STEPS = new Set(['0', '0.5', '1', '2', '3', '4', '6', '8', '12']);

const SPACING_PREFIX =
  '(?:p|px|py|pt|pb|pl|pr|ps|pe|m|mx|my|mt|mb|ml|mr|ms|me|gap|gap-x|gap-y|space-x|space-y|size|w|h|min-w|min-h|max-w|max-h|top|bottom|left|right|inset|inset-x|inset-y|translate-x|translate-y|basis)';

/** Degraus de raio e de tipografia que saíram de circulação (T010). */
const REMOVED_RADIUS = ['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', 'full'] as const;
const REMOVED_TEXT_SIZES = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl'] as const;
const REMOVED_SHADOWS = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const;

interface Offence {
  readonly file: string;
  readonly line: number;
  readonly utility: string;
  readonly hint: string;
}

function scan(pattern: RegExp, hint: string): Offence[] {
  const offences: Offence[] = [];
  for (const file of files) {
    file.text.split('\n').forEach((text, index) => {
      const matcher = new RegExp(pattern.source, pattern.flags);
      let match = matcher.exec(text);
      while (match !== null) {
        offences.push({ file: file.path, line: index + 1, utility: match[0], hint });
        match = matcher.exec(text);
      }
    });
  }
  return offences;
}

function report(offences: readonly Offence[]): string {
  return offences.map((o) => `  ${o.file}:${o.line}  ${o.utility}  → ${o.hint}`).join('\n');
}

describe('T012 · nenhum utilitário derivado de token removido sobrevive em src/', () => {
  it('encontrou arquivos para inspecionar', () => {
    expect(files.length).toBeGreaterThan(30);
  });

  it('nenhum token de cor removido é referenciado', () => {
    const offences = scan(
      new RegExp(
        `\\b(?:[a-z-]+:)*${COLOR_PREFIX}-(?:${REMOVED_COLOR_TOKENS.join('|')})\\b(?:/\\d+)?`,
        'gu',
      ),
      'ver contracts/token-migration.md §1–§4',
    );
    expect(offences, `Tokens de cor removidos ainda em uso:\n${report(offences)}`).toEqual([]);
  });

  it('nenhuma referência a `border-border`, que virou `border-rule`', () => {
    const offences = scan(
      /\b(?:[a-z-]+:)*border-border\b/gu,
      'use `border-rule` (contracts/token-migration.md §1)',
    );
    expect(offences, `\n${report(offences)}`).toEqual([]);
  });

  it('FR-050 · âmbar em cheia saturação não é usado como texto, borda ou anel de foco', () => {
    // A regra de lint de T017 cobre o mesmo terreno em `.tsx`. Aqui a varredura
    // alcança também os `.css`, que o ESLint não lê.
    const offences = scan(
      /\b(?:[a-z-]+:)*(?:text|border|ring|outline|divide)-accent\b(?!-)/gu,
      'para texto, borda e foco o token é `--accent-text` (FR-046, FR-050)',
    );
    expect(offences, `\n${report(offences)}`).toEqual([]);
  });

  it('FR-014 · nenhum degrau de raio fora dos três declarados', () => {
    const offences = scan(
      new RegExp(
        `\\b(?:[a-z-]+:)*rounded(?:-(?:t|b|l|r|tl|tr|bl|br|s|e))?-(?:${REMOVED_RADIUS.join('|')})\\b`,
        'gu',
      ),
      'use `rounded-control`, `rounded-card` ou `rounded-pill`',
    );
    expect(offences, `\n${report(offences)}`).toEqual([]);
  });

  it('FR-014 · nenhum degrau de tipografia fora dos seis declarados', () => {
    const offences = scan(
      new RegExp(`\\b(?:[a-z-]+:)*text-(?:${REMOVED_TEXT_SIZES.join('|')})\\b`, 'gu'),
      'use `text-page`, `text-step`, `text-section`, `text-body`, `text-meta` ou `text-data`',
    );
    expect(offences, `\n${report(offences)}`).toEqual([]);
  });

  it('FR-014 · nenhum degrau de espaçamento fora dos sete declarados', () => {
    const pattern = new RegExp(
      `\\b(?:[a-z-]+:)*(?:-)?${SPACING_PREFIX}-(\\d+(?:\\.\\d+)?)\\b`,
      'gu',
    );
    const offences: Offence[] = [];
    for (const file of files) {
      file.text.split('\n').forEach((text, index) => {
        const matcher = new RegExp(pattern.source, pattern.flags);
        let match = matcher.exec(text);
        while (match !== null) {
          const step = match[1];
          if (step !== undefined && !SPACING_STEPS.has(step)) {
            offences.push({
              file: file.path,
              line: index + 1,
              utility: match[0],
              hint: 'degraus válidos: 0, 0.5, 1, 2, 3, 4, 6, 8, 12',
            });
          }
          match = matcher.exec(text);
        }
      });
    }
    expect(offences, `\n${report(offences)}`).toEqual([]);
  });

  it('a profundidade tem um único nível, e ele se chama `shadow-card`', () => {
    const offences = scan(
      new RegExp(`\\b(?:[a-z-]+:)*shadow-(?:${REMOVED_SHADOWS.join('|')})\\b`, 'gu'),
      'use `shadow-card`, que é `none` no tema escuro (contracts/tokens.md §4)',
    );
    expect(offences, `\n${report(offences)}`).toEqual([]);
  });

  it('FR-040 · nenhum valor visual arbitrário em colchete', () => {
    const offences = scan(
      new RegExp(
        `\\b(?:[a-z-]+:)*(?:${COLOR_PREFIX}|${SPACING_PREFIX}|rounded(?:-[a-z]+)?)-\\[[^\\]]+\\]`,
        'gu',
      ),
      'valor avulso não passa pela camada de tokens (FR-040, SC-009)',
    );
    expect(offences, `\n${report(offences)}`).toEqual([]);
  });
});

describe('T012 · a lista de proibidos não pode envelhecer em silêncio', () => {
  const indexCss = readFileSync(join(SRC, 'styles/index.css'), 'utf8');

  it('nenhum token da lista de removidos voltou a ser declarado em index.css', () => {
    const ressuscitados = REMOVED_COLOR_TOKENS.filter((token) =>
      new RegExp(`--color-${token}\\s*:`, 'u').test(indexCss),
    );
    expect(ressuscitados).toEqual([]);
  });

  it('os tokens novos que a migração usa como destino estão de fato declarados', () => {
    const destinos = [
      'bg',
      'surface',
      'surface-raised',
      'rule',
      'rule-strong',
      'ink',
      'ink-muted',
      'accent',
      'accent-deep',
      'accent-ink',
      'accent-text',
      'state-confident',
      'state-uncertain',
      'state-missing',
      'state-confident-tint',
      'state-uncertain-tint',
      'state-missing-tint',
      'state-neutral-tint',
      'state-confident-edge',
      'state-uncertain-edge',
      'state-missing-edge',
      'state-neutral-edge',
      'scrim',
    ];
    const ausentes = destinos.filter(
      (token) => !new RegExp(`--color-${token}\\s*:`, 'u').test(indexCss),
    );
    expect(ausentes, `Destinos de migração não declarados em index.css: ${ausentes.join(', ')}`).toEqual(
      [],
    );
  });
});
