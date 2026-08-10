/**
 * A fila exibida do painel "Ordem de execução" — 008/FR-015, regras Q1 a Q4.
 *
 * **Arquivo novo, e não um bloco em `validation-destinations.spec.ts`**, por um
 * motivo que vale registrar: SC-009 exige que nenhum teste de comportamento mude
 * de resultado nesta feature, e a leitura desse critério é feita no diff.
 * Acrescentar casos a um arquivo de comportamento existente tornaria o diff
 * ambíguo — quem revisa teria de distinguir, linha a linha, o que é caso novo do
 * que é caso alterado.
 *
 * A regra que este arquivo protege é a mais fácil de quebrar sem perceber: a
 * ordem de execução tem **uma** autoridade, `PROVIDER_ORDER`, e uma projeção que
 * lesse a ordem da seleção seria uma segunda fonte disfarçada de conveniência.
 */

import { describe, expect, it } from 'vitest';

import { PROVIDER_ORDER, type ProviderId } from '@/domain/providers';
import { displayedQueue } from '@/domain/run/selection';
import type { DestinationSelection } from '@/domain/types';

function selecao(selected: readonly ProviderId[], locked = false): DestinationSelection {
  return { selected: [...selected], locked };
}

describe('Q1 · a fila contém exatamente os destinos selecionados', () => {
  it('com os dois marcados, lista os dois', () => {
    expect(displayedQueue(selecao(['spotify', 'youtube'])).map((d) => d.provider)).toEqual([
      'spotify',
      'youtube',
    ]);
  });

  it.each(['spotify', 'youtube'] as const)('com só o %s marcado, lista só ele', (provider) => {
    const fila = displayedQueue(selecao([provider]));
    expect(fila.map((d) => d.provider)).toEqual([provider]);
  });

  it('nunca lista um destino que não foi escolhido (FR-015)', () => {
    // A asserção que o painel depende: um item a mais aqui é o produto dizendo
    // que vai criar uma playlist onde o usuário não pediu.
    const fila = displayedQueue(selecao(['youtube']));
    expect(fila.some((d) => d.provider === 'spotify')).toBe(false);
  });
});

describe('Q2 · a ordem vem de PROVIDER_ORDER, nunca da seleção', () => {
  it('a seleção fora de ordem não reordena a fila', () => {
    // É o caso que separa projeção de cópia. `orderSelection` já mantém a
    // seleção ordenada no fluxo real, mas a projeção não pode **depender** disso
    // — se dependesse, a ordem teria duas fontes e uma delas envelheceria.
    const fila = displayedQueue(selecao(['youtube', 'spotify']));
    expect(fila.map((d) => d.provider)).toEqual([...PROVIDER_ORDER]);
  });

  it('as posições são 1-based e contíguas', () => {
    const fila = displayedQueue(selecao(['spotify', 'youtube']));
    expect(fila.map((d) => d.position)).toEqual([1, 2]);
  });

  it('com um destino do meio da ordem, a posição é recontada a partir de 1', () => {
    // Numerar antes de filtrar produziria "2º" para um serviço que é o único da
    // fila — um buraco visível que ninguém consegue explicar.
    const ultimo = PROVIDER_ORDER[PROVIDER_ORDER.length - 1];
    expect(ultimo).toBeDefined();
    const fila = displayedQueue(selecao([ultimo!]));
    expect(fila.map((d) => d.position)).toEqual([1]);
  });
});

describe('Q3 · seleção vazia devolve lista vazia', () => {
  it('sem nenhum destino, a fila é vazia', () => {
    expect(displayedQueue(selecao([]))).toEqual([]);
  });

  it('a lista vazia é uma lista, não `null`', () => {
    // Quem trata o vazio é a superfície, com o convite de FR-015a — **o painel
    // não some**. Devolver `null` aqui empurraria essa decisão para o
    // componente, que é onde ela já estava errada.
    expect(Array.isArray(displayedQueue(selecao([])))).toBe(true);
  });
});

describe('Q4 · `solo` marca a fila de um destino só', () => {
  it.each(['spotify', 'youtube'] as const)('com só o %s, solo é true', (provider) => {
    expect(displayedQueue(selecao([provider])).every((d) => d.solo)).toBe(true);
  });

  it('com dois destinos, nenhum é solo', () => {
    expect(displayedQueue(selecao(['spotify', 'youtube'])).some((d) => d.solo)).toBe(false);
  });
});

describe('a projeção não depende da trava', () => {
  it('seleção travada produz a mesma fila', () => {
    // A trava é sobre **mudar** a seleção (FR-012), não sobre exibi-la. O painel
    // continua mostrando a ordem depois que a primeira criação começou.
    const livre = displayedQueue(selecao(['spotify', 'youtube'], false));
    const travada = displayedQueue(selecao(['spotify', 'youtube'], true));
    expect(travada).toEqual(livre);
  });
});
