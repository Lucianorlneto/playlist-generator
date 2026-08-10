import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { t } from '@/i18n/pt-BR';

/**
 * **Nenhum texto muda por acidente.**
 *
 * ## O que este teste afirmava, e por que a afirmação mudou
 *
 * Até a feature 007 o docblock aqui dizia que aquela feature trocava a aparência
 * inteira e **nenhuma palavra**. Era verdade então e **é falso agora**: a 008
 * adota os textos do arquivo de design (008/FR-026 a FR-030), e o instantâneo foi
 * rebaselinado com `ATUALIZAR_I18N=1`.
 *
 * Deixar o comentário como estava seria pior do que removê-lo — comentário é
 * lido como verdade, e um que descreve o oposto do que a feature fez engana
 * exatamente quem está tentando entender a mudança (008/research §R9).
 *
 * O que este teste garante hoje: **mudança de texto é deliberada e aparece no
 * diff do instantâneo**. Ele não decide se o texto novo está certo — isso é
 * `tests/unit/design-text-fidelity.spec.ts`, que compara cada texto adotado com a
 * string do arquivo de design. Os dois papéis são opostos e complementares:
 *
 * | Teste | Garante | Falha quando |
 * | --- | --- | --- |
 * | este | nenhum texto muda **por acidente** | um valor muda sem o instantâneo ser regravado |
 * | `design-text-fidelity` | todo texto adotado **coincide com o design** | o dicionário diverge do arquivo, ou uma chave some |
 *
 * O instantâneo continua **assimétrico** por decisão: permite adição de chave e
 * recusa modificação de valor existente. Um instantâneo simétrico obrigaria a
 * regravá-lo a cada texto novo, e regravar por hábito é como um instantâneo
 * deixa de proteger qualquer coisa — a próxima alteração acidental passaria
 * junto com a intencional.
 *
 * Para acolher texto novo, rode com `ATUALIZAR_I18N=1` e **leia o diff**.
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

describe('nenhum texto da aplicação muda por acidente', () => {
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
      'Textos existentes foram alterados sem o instantâneo ser regravado. Se a mudança é ' +
        'deliberada, rode `ATUALIZAR_I18N=1 npx vitest run tests/unit/i18n-stability.spec.ts` ' +
        `e leia o diff — é ele que serve de revisão:\n  ${modificados.join('\n  ')}`,
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
      // 007/FR-010 a FR-015 — a trilha vertical de etapas: título, ação de
      // recomeço e as duas famílias de linha de apoio.
      'rail.',
      // 007/FR-007 a FR-009 — os três estados do chip de conexão.
      'connectionChip.',
      // 007/FR-016 a FR-019 — barra de ações do rodapé do conteúdo.
      'actionBar.',
      // 008 — a contagem de serviços configurados na faixa de Configuração, que
      // o arquivo de design passou a desenhar (nó `N7OSfN` em `fVjnY`).
      'credential.configuredCount',
      // 008/FR-009 a FR-012 — a linha de contexto do cabeçalho. **Substitui**
      // `greeting.`, da 007: o arquivo de design não repete a saudação em todas
      // as telas, e a chave antiga saiu junto com o componente que a lia.
      'header.',
      // 008/FR-014 a FR-020 — o painel "Ordem de execução" da etapa Destinos.
      'destinations.panel',
      // 008/FR-021 e FR-021a — a linha de estado da conta no cartão de destino.
      'destinations.account',
      // 007 — conjunção de lista, consumida por `listAnd` para compor a linha
      // de apoio derivada de Destinos. Vive em `common` porque não pertence a
      // nenhuma superfície: é gramática.
      'common.and',
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
