import { describe, expect, it } from 'vitest';

import {
  initialSelection,
  providersWithCredential,
  reconcileSelection,
  toggleDestination,
} from '@/domain/run/selection';
import {
  validateAtLeastOneCredential,
  validateReduction,
  validateSelection,
  validateSelectionEditable,
} from '@/domain/validation';

import { makeCredentials, makeDestinations } from '../fixtures/factories';

describe('FR-002 — ao menos uma credencial para sair da configuração', () => {
  it('zero credenciais bloqueia, com motivo nomeado', () => {
    const resultado = validateAtLeastOneCredential(makeCredentials());
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.reason).toBe('no_credential');
      expect(resultado.messageKey).toBe('credential.noneSaved');
    }
  });

  it('**qualquer uma** das duas basta — nenhuma é obrigatória isoladamente', () => {
    expect(validateAtLeastOneCredential(makeCredentials({ spotify: 'abc' })).ok).toBe(true);
    expect(validateAtLeastOneCredential(makeCredentials({ youtube: 'xyz' })).ok).toBe(true);
    expect(
      validateAtLeastOneCredential(makeCredentials({ spotify: 'abc', youtube: 'xyz' })).ok,
    ).toBe(true);
  });

  it('credencial só com espaços não conta como cadastrada (invariante C2)', () => {
    expect(validateAtLeastOneCredential(makeCredentials({ spotify: '   ' })).ok).toBe(false);
    expect(providersWithCredential(makeCredentials({ spotify: '   ' }))).toEqual([]);
  });
});

describe('FR-011 — ao menos um destino selecionado', () => {
  it('zero destinos bloqueia o avanço', () => {
    const resultado = validateSelection(makeDestinations({ selected: [] }));
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.reason).toBe('no_destination');
  });

  it('um destino já libera', () => {
    expect(validateSelection(makeDestinations({ selected: ['youtube'] })).ok).toBe(true);
  });
});

describe('FR-010, SC-003 — seleção padrão', () => {
  it('o padrão é **exatamente** o conjunto de provedores com credencial', () => {
    expect(initialSelection(makeCredentials()).selected).toEqual([]);
    expect(initialSelection(makeCredentials({ youtube: 'y' })).selected).toEqual(['youtube']);
    expect(initialSelection(makeCredentials({ spotify: 's', youtube: 'y' })).selected).toEqual([
      'spotify',
      'youtube',
    ]);
  });

  it('nasce destravada', () => {
    expect(initialSelection(makeCredentials({ spotify: 's' })).locked).toBe(false);
  });
});

describe('FR-006 — remover credencial desmarca só aquele destino', () => {
  it('a reconciliação remove o provedor sem credencial e preserva o outro', () => {
    const selecao = makeDestinations({ selected: ['spotify', 'youtube'] });
    const depois = reconcileSelection(selecao, makeCredentials({ spotify: 's' }));
    expect(depois.selected).toEqual(['spotify']);
  });

  it('não mexe em nada quando todas as credenciais continuam lá', () => {
    const selecao = makeDestinations({ selected: ['spotify', 'youtube'] });
    const credenciais = makeCredentials({ spotify: 's', youtube: 'y' });
    expect(reconcileSelection(selecao, credenciais)).toBe(selecao);
  });
});

describe('FR-012 — a trava pós-criação', () => {
  it('seleção travada não aceita alternância (invariante D4)', () => {
    const travada = makeDestinations({ selected: ['spotify'], locked: true });
    const credenciais = makeCredentials({ spotify: 's', youtube: 'y' });
    expect(toggleDestination(travada, 'youtube', credenciais)).toBe(travada);
  });

  it('seleção travada não é reconciliada nem por remoção de credencial', () => {
    const travada = makeDestinations({ selected: ['spotify', 'youtube'], locked: true });
    expect(reconcileSelection(travada, makeCredentials())).toBe(travada);
  });

  it('validateSelectionEditable nomeia a trava', () => {
    const resultado = validateSelectionEditable(makeDestinations({ locked: true }));
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.reason).toBe('selection_locked');
  });
});

describe('FR-009 — só se seleciona destino com credencial (invariante D1)', () => {
  it('marcar um provedor sem credencial é ignorado', () => {
    const selecao = makeDestinations({ selected: [] });
    const credenciais = makeCredentials({ spotify: 's' });
    expect(toggleDestination(selecao, 'youtube', credenciais)).toBe(selecao);
  });

  it('desmarcar sempre funciona, mesmo sem credencial', () => {
    const selecao = makeDestinations({ selected: ['spotify', 'youtube'] });
    const depois = toggleDestination(selecao, 'youtube', makeCredentials({ spotify: 's' }));
    expect(depois.selected).toEqual(['spotify']);
  });

  it('a alternância preserva a ordem fixa (invariante P1)', () => {
    const credenciais = makeCredentials({ spotify: 's', youtube: 'y' });
    let selecao = makeDestinations({ selected: [] });
    selecao = toggleDestination(selecao, 'youtube', credenciais);
    selecao = toggleDestination(selecao, 'spotify', credenciais);
    expect(selecao.selected).toEqual(['spotify', 'youtube']);
  });
});

describe('FR-013 — validação da redução de lista', () => {
  it('aceita subconjunto e recusa acréscimo', () => {
    expect(validateReduction(['l0', 'l1'], ['l0']).ok).toBe(true);
    const recusa = validateReduction(['l0'], ['l0', 'l1']);
    expect(recusa.ok).toBe(false);
    if (!recusa.ok) expect(recusa.reason).toBe('not_a_subset');
  });
});
