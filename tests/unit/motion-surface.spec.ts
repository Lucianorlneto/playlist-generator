import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import * as primitivas from '@/ui/motion';

/**
 * A fechadura em volta da biblioteca de movimento — 009/FR-010b, FR-016,
 * FR-017a, SC-011.
 *
 * ## Por que existe, sendo que já há uma regra de lint
 *
 * A redundância é deliberada, e é a mesma disciplina da tabela de hosts do
 * Princípio II: a fechadura que importa é a que continua fechada depois de
 * alguém tentar abri-la. `tp/no-motion-library-import` falha no editor, enquanto
 * ainda custa uma tecla consertar; este teste alcança o que o ESLint não lê —
 * os `.css` — e sobrevive a um comentário de supressão.
 *
 * O FR-010b diz que o movimento autorizado é "exatamente três". Sem estas duas
 * verificações, essa frase é prosa.
 */

const SRC = join(process.cwd(), 'src');
const DIRETORIO_DE_MOVIMENTO = 'src/ui/motion';

function arquivos(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) {
      found.push(...arquivos(full));
      continue;
    }
    if (/\.(tsx?|css)$/u.test(entry)) found.push(full);
  }
  return found;
}

/** Neutraliza comentários preservando a numeração de linha. */
function semComentarios(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//gu, (block) => block.replace(/[^\n]/gu, ' '))
    .replace(/^\s*\/\/.*$/gmu, (line) => line.replace(/[^\n]/gu, ' '));
}

const FONTES = arquivos(SRC).map((path) => {
  const caminho = relative(process.cwd(), path).replaceAll('\\', '/');
  return {
    caminho,
    texto: semComentarios(readFileSync(path, 'utf8')),
    /** Sem comentários **nem** neutralização: para inspecionar as primitivas. */
    cru: readFileSync(path, 'utf8'),
    dentroDaFechadura: caminho.startsWith(`${DIRETORIO_DE_MOVIMENTO}/`),
  };
});

/** Os arquivos das três primitivas, sem o barril. */
const PRIMITIVAS = FONTES.filter(
  (f) => f.dentroDaFechadura && f.caminho.endsWith('.tsx'),
);

describe('FR-010b · a biblioteca de movimento entra por um único diretório', () => {
  it('encontrou arquivos para inspecionar', () => {
    expect(FONTES.length).toBeGreaterThan(30);
    expect(PRIMITIVAS.length).toBe(3);
  });

  it('nenhum arquivo fora de src/ui/motion/ importa de `motion`', () => {
    const infratores = FONTES.filter((f) => !f.dentroDaFechadura)
      .flatMap((f) =>
        f.texto
          .split('\n')
          .map((linha, i) => ({ linha, numero: i + 1, caminho: f.caminho }))
          .filter(({ linha }) => /from\s+'motion(?:\/[a-z-]+)?'/u.test(linha)),
      )
      .map(({ caminho, numero, linha }) => `${caminho}:${String(numero)}  ${linha.trim()}`);

    expect(
      infratores,
      'A superfície pede a primitiva — `SpinningDisc`, `PulsingBar`, `CrossFade` — e nunca a ' +
        `biblioteca (FR-010b):\n  ${infratores.join('\n  ')}`,
    ).toEqual([]);
  });

  it('`framer-motion` não é importado em lugar nenhum, nem dentro da fechadura', () => {
    // O nome anterior da mesma biblioteca, presente aqui só como dependência
    // transitiva de `motion`. Importá-lo contornaria a fechadura sem que a
    // contagem de três mudasse — e produziria duas cópias no artefato, com um
    // `useReducedMotion` de cada uma.
    const infratores = FONTES.flatMap((f) =>
      f.texto
        .split('\n')
        .map((linha, i) => ({ linha, numero: i + 1, caminho: f.caminho }))
        .filter(({ linha }) => /from\s+'framer-motion/u.test(linha)),
    ).map(({ caminho, numero, linha }) => `${caminho}:${String(numero)}  ${linha.trim()}`);

    expect(infratores, `\n  ${infratores.join('\n  ')}`).toEqual([]);
  });
});

describe('SC-011 · o movimento autorizado é exatamente três', () => {
  it('o diretório exporta três primitivas, e são elas', () => {
    expect(Object.keys(primitivas).sort()).toEqual(['CrossFade', 'PulsingBar', 'SpinningDisc']);
  });

  it('o barril não reexporta `motion` nem nada da biblioteca', () => {
    /*
      **É o modo de falha que interessa.** Um `export { motion } from 'motion/react'`
      passaria na contagem acima se o nome fosse contado como quarta primitiva —
      e passaria calado se alguém o reexportasse com outro nome. A asserção é
      sobre o texto do barril: nada além dos três arquivos locais sai daqui.
    */
    const barril = FONTES.find((f) => f.caminho === `${DIRETORIO_DE_MOVIMENTO}/index.ts`);
    expect(barril).toBeDefined();

    const origens = [...(barril?.texto ?? '').matchAll(/from\s+'([^']+)'/gu)].map((m) => m[1]);
    expect(
      origens.sort(),
      'O barril só reexporta os três arquivos locais. Reexportar a biblioteca devolveria a ' +
        'chave à fechadura (FR-010b).',
    ).toEqual(['./CrossFade', './PulsingBar', './SpinningDisc']);
  });
});

describe('FR-017a · as três animam só `transform` e `opacity`', () => {
  /**
   * As propriedades que a biblioteca aceita em `animate` e que **não** são
   * `transform` nem `opacity`. Animar qualquer uma força recálculo de layout ou
   * repintura a cada quadro — e esta tela anima **enquanto uma requisição está
   * em voo** (009/contracts/motion.md §4).
   */
  const PROIBIDAS = [
    'height',
    'width',
    'top',
    'left',
    'right',
    'bottom',
    'margin',
    'padding',
    'backgroundColor',
    'color',
    'borderRadius',
    'filter',
    'boxShadow',
    'layout',
    'layoutId',
  ];

  it.each(PRIMITIVAS.map((f) => [f.caminho, f] as const))(
    '%s não anima propriedade fora das duas autorizadas',
    (_nome, arquivo) => {
      const encontradas = PROIBIDAS.filter((prop) =>
        new RegExp(`\\b${prop}\\s*:`, 'u').test(arquivo.texto),
      );
      expect(
        encontradas,
        `Propriedades proibidas em ${arquivo.caminho}: ${encontradas.join(', ')}. ` +
          '`transform` e `opacity` são compostas pela GPU sem recálculo de layout; ' +
          'qualquer outra competiria com a requisição que a tela está esperando (FR-017a).',
      ).toEqual([]);
    },
  );

  it('nenhuma primitiva usa `AnimatePresence mode="wait"`', () => {
    // Produziria 200ms de cartão vazio — o salto de layout que o SC-004 proíbe,
    // só que em duas etapas (009/research §R7).
    const infratores = PRIMITIVAS.filter((f) => /mode\s*=\s*["']wait["']/u.test(f.texto)).map(
      (f) => f.caminho,
    );
    expect(infratores).toEqual([]);
  });
});

describe('FR-016 e SC-003 · cada primitiva tem o seu próprio interruptor', () => {
  /**
   * Por que a asserção é **por primitiva** e não global (009/research §R6):
   *
   * - a regra de CSS de `index.css` zera `animation-duration` e
   *   `transition-duration`, e **não alcança** a biblioteca, que anima por WAAPI;
   * - `<MotionConfig reducedMotion="user">` desativa transformação e layout e
   *   **preserva `opacity`** — que é justamente o que a pulsação do esqueleto
   *   anima e o que o FR-016 manda suprimir.
   *
   * Não há interruptor de cima que sirva. Cada uma consulta o seu.
   */
  it.each(PRIMITIVAS.map((f) => [f.caminho, f] as const))(
    '%s consulta useReducedMotion',
    (_nome, arquivo) => {
      expect(
        /useReducedMotion\s*\(\s*\)/u.test(arquivo.texto),
        `${arquivo.caminho} não consulta \`useReducedMotion()\`. Nenhum interruptor de cima ` +
          'serve: a regra de CSS não alcança a biblioteca, e `MotionConfig reducedMotion="user"` ' +
          'preserva a `opacity` que o FR-016 manda suprimir (009/research §R6).',
      ).toBe(true);
    },
  );
});
