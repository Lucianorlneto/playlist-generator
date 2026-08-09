/**
 * V0 — para onde o fluxo vai depois de um pulo (`006/FR-002`, FR-003, FR-004).
 *
 * Percorre a tabela de verdade inteira de `006/contracts/flow-contract §1`. É o
 * teste que precisa ficar verde antes de qualquer componente existir: os seis
 * pontos de pulo da interface consomem este contrato, e escrevê-los antes dele
 * seria escrever seis vezes a mesma suposição.
 *
 * Sem DOM, sem store, sem rede — Princípio III.
 */

import { describe, expect, it } from 'vitest';

import { exitAfterSkip } from '@/domain/run/exit';

import { makeQueueWithOutcomes } from '../fixtures/factories';

describe('exitAfterSkip — tabela de verdade (flow-contract §1)', () => {
  it('destino único, nada rodou → discard', () => {
    const fila = makeQueueWithOutcomes(['spotify'], { spotify: null });
    expect(exitAfterSkip(fila, 'spotify')).toEqual({ kind: 'discard' });
  });

  it('dois destinos, pulando o primeiro → next', () => {
    const fila = makeQueueWithOutcomes(['spotify', 'youtube'], { spotify: null, youtube: null });
    expect(exitAfterSkip(fila, 'spotify')).toEqual({ kind: 'next', provider: 'youtube' });
  });

  it('dois destinos, pulando o último com o primeiro pulado → discard', () => {
    const fila = makeQueueWithOutcomes(['spotify', 'youtube'], {
      spotify: 'skipped',
      youtube: null,
    });
    expect(exitAfterSkip(fila, 'youtube')).toEqual({ kind: 'discard' });
  });

  it.each(['completed', 'partial', 'failed'] as const)(
    'dois destinos, pulando o último com o primeiro %s → summary',
    (outcome) => {
      const fila = makeQueueWithOutcomes(['spotify', 'youtube'], {
        spotify: outcome,
        youtube: null,
      });
      expect(exitAfterSkip(fila, 'youtube')).toEqual({ kind: 'summary' });
    },
  );
});

describe('exitAfterSkip — o que a tabela deixa explícito', () => {
  /**
   * A regra de **posição** vem antes da de **desfecho**. Um destino anterior
   * concluído não impede que pular o primeiro de dois vá para o segundo.
   */
  it('pular o primeiro de dois nunca devolve summary nem discard', () => {
    for (const outcome of [null, 'completed', 'partial', 'failed', 'skipped'] as const) {
      const fila = makeQueueWithOutcomes(['spotify', 'youtube'], { youtube: outcome });
      expect(exitAfterSkip(fila, 'spotify')).toEqual({ kind: 'next', provider: 'youtube' });
    }
  });

  /**
   * A fronteira de FR-003 é "rodou", não "deu certo". `failed` conta como
   * rodado tanto quanto `completed` — e é por isso que o critério é `outcome`,
   * não `phase`: a fase de uma execução encerrada não separa "falhou depois de
   * criar a playlist" de "falhou antes".
   */
  it('failed conta como rodado, skipped não', () => {
    const falhou = makeQueueWithOutcomes(['spotify', 'youtube'], { spotify: 'failed' });
    const pulou = makeQueueWithOutcomes(['spotify', 'youtube'], { spotify: 'skipped' });

    expect(exitAfterSkip(falhou, 'youtube')).toEqual({ kind: 'summary' });
    expect(exitAfterSkip(pulou, 'youtube')).toEqual({ kind: 'discard' });
  });

  /** Invariante E1: total. Nunca `null`, nunca um quarto caso. */
  it('é total sobre toda fila com pelo menos um destino', () => {
    const ordens = [['spotify'], ['youtube'], ['spotify', 'youtube']] as const;
    for (const ordem of ordens) {
      for (const provider of ordem) {
        const saida = exitAfterSkip(makeQueueWithOutcomes([...ordem], {}), provider);
        expect(['next', 'summary', 'discard']).toContain(saida.kind);
      }
    }
  });

  /** Invariante E2: pura. Chamar duas vezes devolve o mesmo, e nada muda. */
  it('é pura — duas chamadas concordam e a fila não é alterada', () => {
    const fila = makeQueueWithOutcomes(['spotify', 'youtube'], { spotify: 'completed' });
    const congelada = structuredClone(fila);

    expect(exitAfterSkip(fila, 'youtube')).toEqual(exitAfterSkip(fila, 'youtube'));
    expect(fila).toEqual(congelada);
  });
});
