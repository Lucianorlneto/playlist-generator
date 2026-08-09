import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { t } from '@/i18n/pt-BR';

/**
 * Os textos existentes não mudaram (FR-035, SC-012) — T068.
 *
 * Esta feature troca a aparência inteira do aplicativo e **nenhuma palavra**.
 * A `frontend-design` traz uma seção forte sobre escrita de interface — voz
 * ativa, erro que não se desculpa, tela vazia como convite — e nada dela foi
 * aplicado aqui de propósito: mexer em copy junto com identidade visual
 * misturaria duas mudanças de natureza diferente na mesma revisão, e a revisão
 * de copy do fluxo ficou registrada como candidata a feature própria
 * (design.md §7).
 *
 * O instantâneo é assimétrico por decisão: **permite adição de chave e recusa
 * modificação de valor existente**. Um instantâneo simétrico obrigaria a
 * regravá-lo a cada texto novo, e regravar por hábito é como um instantâneo
 * deixa de proteger qualquer coisa — a próxima alteração acidental passaria
 * junto com a intencional.
 *
 * Para acolher texto novo, rode com `ATUALIZAR_I18N=1`.
 */

const SNAPSHOT = join(process.cwd(), 'tests/fixtures/i18n-pt-BR.snapshot.json');

/** Achata a árvore de textos em `caminho.pontilhado` → valor. */
function flatten(value: unknown, prefix = ''): Record<string, string> {
  if (typeof value === 'string') return { [prefix]: value };
  if (Array.isArray(value)) {
    return Object.assign(
      {},
      ...value.map((entry, index) => flatten(entry, `${prefix}[${String(index)}]`)),
    ) as Record<string, string>;
  }
  if (typeof value === 'object' && value !== null) {
    return Object.assign(
      {},
      ...Object.entries(value).map(([key, entry]) =>
        flatten(entry, prefix === '' ? key : `${prefix}.${key}`),
      ),
    ) as Record<string, string>;
  }
  return {};
}

const atual = flatten(t);

function lerInstantaneo(): Record<string, string> | null {
  try {
    return JSON.parse(readFileSync(SNAPSHOT, 'utf8')) as Record<string, string>;
  } catch {
    return null;
  }
}

describe('FR-035 e SC-012 · nenhum texto da aplicação mudou nesta feature', () => {
  const gravado = lerInstantaneo();

  if (gravado === null || process.env['ATUALIZAR_I18N'] === '1') {
    it('grava o instantâneo de referência', () => {
      writeFileSync(SNAPSHOT, `${JSON.stringify(atual, null, 2)}\n`, 'utf8');
      expect(Object.keys(atual).length).toBeGreaterThan(50);
    });
    return;
  }

  it('o instantâneo cobre a árvore de textos', () => {
    expect(Object.keys(gravado).length).toBeGreaterThan(50);
  });

  it('nenhum valor existente foi modificado', () => {
    const modificados = Object.entries(gravado)
      .filter(([chave, valor]) => chave in atual && atual[chave] !== valor)
      .map(([chave, valor]) => `${chave}\n    antes: ${valor}\n    agora: ${String(atual[chave])}`);

    expect(
      modificados,
      `Textos existentes foram alterados. O FR-035 os congela nesta feature:\n  ${modificados.join('\n  ')}`,
    ).toEqual([]);
  });

  it('nenhuma chave existente foi removida', () => {
    const removidas = Object.keys(gravado).filter((chave) => !(chave in atual));
    expect(removidas, `Chaves removidas: ${removidas.join(', ')}`).toEqual([]);
  });

  /**
   * Adição não falha. O caso existe para provar que cada feature acrescentou
   * **só** os textos que declarou, e não copy que entrou de carona.
   *
   * A lista cresce por feature, e cada prefixo aponta o requisito que o
   * autoriza. Acrescentar um prefixo aqui é uma decisão consciente; deixar a
   * asserção cair para `true` genérico é o que faria esta guarda parar de
   * guardar qualquer coisa.
   */
  it('chave nova é permitida — e só com prefixo declarado', () => {
    const PREFIXOS_AUTORIZADOS = [
      // 005/FR-022 — controle de tema.
      'theme.',
      // 006/FR-005 — confirmação do pulo que encerra o fluxo e descarta.
      'queue.skipEndsFlow',
      // 006/FR-013 a FR-015 — comando global de recomeço.
      'flow.',
    ];

    const novas = Object.keys(atual).filter((chave) => !(chave in gravado));
    const forasteiras = novas.filter(
      (chave) => !PREFIXOS_AUTORIZADOS.some((prefixo) => chave.startsWith(prefixo)),
    );

    expect(
      forasteiras,
      `Texto novo sem prefixo declarado: ${forasteiras.join(', ')}`,
    ).toEqual([]);
  });
});
