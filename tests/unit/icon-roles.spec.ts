import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { BRAND_ROLE, ICON_ROLES, ICONS, type IconRole } from '@/ui/icons';

/**
 * Portão do mapa de ícones — FR-055, FR-056, FR-059, FR-060, SC-016.
 *
 * O modo de falha que este teste existe para pegar é específico e silencioso: o
 * Lucide renomeia parte do conjunto entre versões, e `react-icons` acompanha a
 * versão que empacota. Uma exportação que deixa de existir vira `undefined` no
 * mapa — não é erro de tipo, não é erro de build, e o React renderiza nada. O
 * ícone some da tela e nenhum log menciona o assunto.
 *
 * Por isso a asserção é **por papel, com o papel nomeado**: quem ler a falha
 * precisa saber que `confident` quebrou, não que "um ícone está indefinido".
 */

const ROLES_ESPERADOS: readonly IconRole[] = [
  'brand',
  'theme-light',
  'theme-dark',
  'theme-system',
  'restart',
  'reconnect',
  'advance',
  'back',
  'done',
  'status-ok',
  'confident',
  'uncertain',
  'missing',
  'hint',
  'queue',
  'loading',
  'external',
  'provider-spotify',
  'provider-youtube',
];

describe('FR-059 · todo papel resolve, e nenhum papel sobra', () => {
  it.each(ROLES_ESPERADOS)('o papel "%s" existe no mapa', (role) => {
    expect(
      ICONS[role],
      `O papel "${role}" está declarado em contracts/icons.md mas não existe em src/ui/icons.ts.`,
    ).toBeDefined();
  });

  it.each(ROLES_ESPERADOS)('o papel "%s" resolve para algo renderizável', (role) => {
    const entry = ICONS[role];
    if (entry.kind === 'art') {
      expect(
        typeof entry.src,
        `O papel "${role}" é arte, mas o recurso não resolveu para um caminho.`,
      ).toBe('string');
      expect(entry.src.length).toBeGreaterThan(0);
      return;
    }
    expect(
      typeof entry.component,
      `O papel "${role}" não resolveu para um componente. ` +
        'O nome de exportação provavelmente mudou na versão instalada de react-icons — ' +
        'confira contracts/icons.md §1 contra o conjunto atual.',
    ).toBe('function');
  });

  it('nenhum papel órfão: o mapa não tem entrada fora do contrato', () => {
    const foraDoContrato = ICON_ROLES.filter((r) => !ROLES_ESPERADOS.includes(r)).sort();
    expect(
      foraDoContrato,
      'Papel no mapa sem entrada em contracts/icons.md. Um ícone sem papel declarado ' +
        'é um ícone que ninguém consegue conferir contra o arquivo de design.',
    ).toEqual([]);
  });

  it('os dezenove papéis estão todos presentes — dezoito de biblioteca mais a marca', () => {
    expect(ICON_ROLES).toHaveLength(ROLES_ESPERADOS.length);
  });
});

describe('FR-060 · a marca é o único papel que resolve para arte', () => {
  it('brand é arte local, não componente de biblioteca', () => {
    expect(ICONS[BRAND_ROLE].kind).toBe('art');
  });

  it('todos os demais papéis são componentes', () => {
    const arteInesperada = ICON_ROLES.filter((r) => r !== BRAND_ROLE && ICONS[r].kind === 'art');
    expect(arteInesperada).toEqual([]);
  });
});

/**
 * SC-016 e FR-056 — a fechadura em volta da biblioteca.
 *
 * `eslint-rules/index.js` também recusa estas importações, e a duplicação é
 * deliberada: o lint pega no editor, este teste pega em CI e no `npm test` de
 * quem desabilitou a regra. A fechadura só vale enquanto ninguém consegue abrir
 * um buraco nela por acidente.
 */
describe('SC-016 · nenhuma superfície importa da biblioteca de ícones', () => {
  const SRC = join(process.cwd(), 'src');
  const MAPA = join(SRC, 'ui', 'icons.ts');

  function arquivosDeCodigo(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const caminho = join(dir, entry.name);
      if (entry.isDirectory()) return arquivosDeCodigo(caminho);
      return /\.tsx?$/u.test(entry.name) ? [caminho] : [];
    });
  }

  /** Sem comentários: prosa que **cita** o nome da biblioteca não é importação. */
  function semComentarios(codigo: string): string {
    return codigo.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/.*$/gmu, '');
  }

  const arquivos = arquivosDeCodigo(SRC);

  it('encontrou os arquivos de código de src/', () => {
    expect(arquivos.length).toBeGreaterThan(20);
  });

  it('apenas src/ui/icons.ts importa de react-icons', () => {
    const infratores = arquivos
      .filter((caminho) => caminho !== MAPA)
      .filter((caminho) => /from\s+'react-icons/u.test(semComentarios(readFileSync(caminho, 'utf8'))))
      .map((caminho) => caminho.slice(process.cwd().length + 1))
      .sort();

    expect(
      infratores,
      'Importação de react-icons fora de src/ui/icons.ts. Uma superfície pede um ' +
        'papel (`advance`), nunca um componente (`LuArrowRight`) — é o que faz trocar ' +
        'o ícone de um papel custar uma edição em vez de uma varredura (FR-059).',
    ).toEqual([]);
  });

  it('nenhum arquivo importa do índice raiz da biblioteca', () => {
    // `from 'react-icons'` sem subcaminho puxa a árvore inteira sem emitir
    // aviso nenhum. O custo só apareceria na medição de pacote do SC-018, ou
    // seja: tarde demais (FR-056).
    const infratores = arquivos
      .filter((caminho) => {
        const codigo = semComentarios(readFileSync(caminho, 'utf8'));
        return /from\s+'react-icons'/u.test(codigo);
      })
      .map((caminho) => caminho.slice(process.cwd().length + 1))
      .sort();

    // `import type { IconType } from 'react-icons'` é a exceção legítima: é
    // apenas tipo, apagado na compilação, e não puxa runtime nenhum.
    const comValorEmTempoDeExecucao = infratores.filter((relativo) => {
      const codigo = semComentarios(readFileSync(join(process.cwd(), relativo), 'utf8'));
      return /(?<!import\s+type\s+)\{[^}]*\}\s+from\s+'react-icons'/u.test(
        codigo.replace(/import\s+type\s+\{[^}]*\}\s+from\s+'react-icons';/gu, ''),
      );
    });

    expect(comValorEmTempoDeExecucao).toEqual([]);
  });
});
