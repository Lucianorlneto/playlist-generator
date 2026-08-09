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
    // `.ts` entrou na 007: o mapa de ícones é um `.ts`, e a fechadura em volta
    // da biblioteca precisa alcançar serviços e slices do store — um `import`
    // ali abre o mesmo buraco que um `import` numa tela.
    if (/\.(tsx?|css)$/u.test(entry)) found.push(full);
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
      'surface-zone',
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
      'accent-tint',
      'state-confident',
      'state-uncertain',
      'state-missing',
      'state-live',
      'brand-spotify',
      'brand-youtube',
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

/**
 * A denylist da feature 007 — **o critério objetivo de "a migração terminou"**
 * (`contracts/token-migration.md` §5).
 *
 * As seções acima cobrem a migração 004 → 005. Esta cobre a 005 → 007, e ela é
 * a que declara esta feature encerrada. Enquanto qualquer um destes aparecer em
 * `src/`, a migração está incompleta — e "incompleta" aqui significa uma tela
 * sem estilo que ninguém viu, não um débito abstrato.
 *
 * A varredura ignora comentários. Este repositório documenta as decisões que
 * toma, e explicar por que `text-item` saiu exige escrever `text-item` — um
 * portão que não distingue uso de menção obriga quem escreve documentação a
 * inventar rodeios, e é assim que a documentação morre.
 */
describe('007 · a migração 005 → 007 terminou', () => {
  const TSX_E_CSS = files;

  it('nenhum resquício da goteira sobrevive', () => {
    // A goteira saiu inteira (FR-029): o utilitário, a variante e as duas
    // medidas. A variante é a mais perigosa das quatro — uma variante
    // inexistente faz o Tailwind descartar a **declaração inteira**, então
    // `gutter:not-sr-only` não vira nada e o rótulo fica invisível em toda
    // largura, não só abaixo do ponto de corte.
    const offences = [
      ...scan(/\bgutter-row\b/gu, 'a goteira saiu na 007 (FR-029)'),
      ...scan(/\bgutter:[a-z-]/gu, 'a variante `gutter:` saiu com o breakpoint'),
      ...scan(/--gutter\b/gu, 'medida removida; ver contracts/token-migration.md §4'),
      ...scan(/--breakpoint-gutter\b/gu, 'renomeado para `--breakpoint-shell`'),
    ];
    expect(offences, `\n${report(offences)}`).toEqual([]);
  });

  it('o degrau `text-item` não sobrevive', () => {
    // Fundido em `--text-body`. Um degrau removido não quebra nada: o
    // utilitário deixa de emitir CSS e o texto herda o tamanho de cima.
    const offences = [
      ...scan(/\b(?:[a-z-]+:)*text-item\b/gu, 'use `text-body` (contracts/token-migration.md §4)'),
      ...scan(/--text-item\b/gu, 'o degrau saiu da escala'),
    ];
    expect(offences, `\n${report(offences)}`).toEqual([]);
  });

  it('nenhuma importação dos componentes removidos', () => {
    // `StepIndicator` virou `StepRail`; `SessionHeader` foi absorvido pelo
    // `ConnectionChip`. Os arquivos não existem mais, então uma importação
    // quebraria o build — mas a asserção cobre também o caso de alguém
    // recriá-los por engano em vez de usar o sucessor.
    const offences = [
      ...scan(/@\/app\/StepIndicator/gu, 'substituído por `@/app/StepRail`'),
      ...scan(/@\/features\/connect\/SessionHeader/gu, 'absorvido por `ConnectionChip`'),
    ];
    expect(offences, `\n${report(offences)}`).toEqual([]);
  });

  it('SC-011 · nenhum hex da paleta anterior fora de tokens.css', () => {
    /*
      A lista é a de `contracts/token-migration.md` §5. Cinco deles permanecem
      **dentro** de `tokens.css`, porque o tema claro conserva o substrato da
      005 (FR-032) — a proibição é fora dele, que é a regra que já vale para
      todo hex.

      `tokens.css` é excluído da varredura, e não os hex da lista: excluir os
      valores deixaria passar um `#faf7f0` escrito à mão dentro de um
      componente, que é exatamente o caso a pegar.
    */
    const PALETA_ANTERIOR = [
      '#f4a900',
      '#d99700',
      '#c98600',
      '#9a5b00',
      '#1a2332',
      '#223045',
      '#0d1219',
      '#faf7f0',
      '#14706b',
      '#4ec4b8',
      '#b3261e',
      '#ff8a7a',
      '#e8eaed',
      '#9aa8b8',
      '#8f887a',
      '#2c3a4d',
    ];

    const padrao = new RegExp(`(?:${PALETA_ANTERIOR.join('|')})\\b`, 'giu');
    const offences: Offence[] = [];
    for (const file of TSX_E_CSS) {
      if (file.path.endsWith('styles/tokens.css')) continue;
      file.text.split('\n').forEach((text, index) => {
        const matcher = new RegExp(padrao.source, padrao.flags);
        let match = matcher.exec(text);
        while (match !== null) {
          offences.push({
            file: file.path,
            line: index + 1,
            utility: match[0],
            hint: 'hex da paleta anterior fora de tokens.css (SC-011)',
          });
          match = matcher.exec(text);
        }
      });
    }
    expect(offences, `\n${report(offences)}`).toEqual([]);
  });

  it('SC-016 · nenhuma importação de ícone fora do mapa', () => {
    /*
      Coberto três vezes: por `tp/no-icon-library-import` no editor, por
      `tests/unit/icon-roles.spec.ts` em CI, e aqui. A redundância é deliberada
      — o custo de perder a fechadura é uma varredura por todo o `src/` no dia
      em que um ícone precisar mudar.

      Este caso alcança também os `.css`, que o ESLint não lê.
    */
    const offences: Offence[] = [];
    for (const file of TSX_E_CSS) {
      if (file.path.endsWith('ui/icons.ts')) continue;
      file.text.split('\n').forEach((text, index) => {
        if (!/from\s+'react-icons/u.test(text)) return;
        offences.push({
          file: file.path,
          line: index + 1,
          utility: text.trim(),
          hint: 'peça um papel a `src/ui/icons.ts`; nunca importe da biblioteca (FR-059)',
        });
      });
    }
    expect(offences, `\n${report(offences)}`).toEqual([]);
  });

  it('FR-060 · nenhum PNG de ícone de interface sobrevive em src/assets/', () => {
    /*
      Os nove PNGs que eram ícone de interface foram **removidos do repositório**
      em 2026-08-09. Remover o perigo vence guardá-lo, e é por isso que esta
      asserção olha o disco em vez de manter uma denylist de nomes.

      O que permanece em `src/assets/imgs/` é arte: os onze adesivos, a
      fotografia de clima, o fundo ambiente e a marca — que é exceção declarada
      (`contracts/icons.md` §1).
    */
    const ARTE_PERMITIDA = new Set([
      'Ambient Backdrop.png',
      'Logo Mark.png',
      'Boombox.png',
      'Cassette 1.png',
      'Cassette 2.png',
      'Cassette 3.png',
      'Headphones 1.png',
      'Headphones 2.png',
      'Play Button.png',
      'Star 1.png',
      'Star 2.png',
      'Vinyl 1.png',
      'Vinyl 2.png',
    ]);

    const imgs = readdirSync(join(SRC, 'assets/imgs'));
    const inesperados = imgs
      .filter((nome) => /\.png$/iu.test(nome))
      .filter((nome) => !ARTE_PERMITIDA.has(nome));

    expect(
      inesperados,
      `PNG inesperado em src/assets/imgs/. Ícone de interface vem de \`src/ui/icons.ts\`, ` +
        `nunca de arte solta (FR-060): ${inesperados.join(', ')}`,
    ).toEqual([]);
  });

  it('a pasta src/assets/icons/ continua não existindo', () => {
    const existe = readdirSync(join(process.cwd(), 'src/assets')).includes('icons');
    expect(existe, 'src/assets/icons/ foi recriada; os ícones vêm do mapa (FR-060)').toBe(false);
  });
});
