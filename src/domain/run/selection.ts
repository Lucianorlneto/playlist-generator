/**
 * Seleção de destinos (data-model §4, FR-008 a FR-012).
 *
 * Puro. A trava (`locked`) é a peça central: FR-012 exige que a seleção pare de
 * mudar assim que a primeira criação começa, porque a fila e os resultados já
 * gravados passam a depender dela. O único caminho para destravar é descartar o
 * rascunho — ação explícita, como o Princípio V pede.
 */

import { orderSelection, PROVIDER_ORDER, type ProviderId } from '@/domain/providers';
import type { Credential, DestinationSelection } from '@/domain/types';

/** Provedores com credencial cadastrada, na ordem fixa (invariante C2). */
export function providersWithCredential(
  credentials: Record<ProviderId, Credential | null>,
): ProviderId[] {
  return PROVIDER_ORDER.filter((provider) => {
    const credential = credentials[provider];
    return credential !== null && credential !== undefined && credential.clientId.trim() !== '';
  });
}

/**
 * Valor inicial: **exatamente** o conjunto de provedores com credencial
 * cadastrada (invariante D2, FR-010, SC-003).
 *
 * Não é "todos" nem "nenhum": cadastrar a credencial de um serviço já é a
 * declaração de intenção de usá-lo, e obrigar a marcá-lo de novo seria pedir a
 * mesma informação duas vezes.
 */
export function initialSelection(
  credentials: Record<ProviderId, Credential | null>,
): DestinationSelection {
  return { selected: providersWithCredential(credentials), locked: false };
}

/**
 * Alterna um destino. Ignora o pedido quando a seleção está travada (D4) ou
 * quando o provedor não tem credencial (D1) — a interface já desabilita o
 * controle nesses casos, e a regra fica valendo mesmo se ela falhar.
 */
export function toggleDestination(
  selection: DestinationSelection,
  provider: ProviderId,
  credentials: Record<ProviderId, Credential | null>,
): DestinationSelection {
  if (selection.locked) return selection;

  const available = providersWithCredential(credentials);
  const isSelected = selection.selected.includes(provider);

  if (!isSelected && !available.includes(provider)) return selection;

  const next = isSelected
    ? selection.selected.filter((entry) => entry !== provider)
    : [...selection.selected, provider];

  return { ...selection, selected: orderSelection(next) };
}

/**
 * Reconcilia a seleção com as credenciais disponíveis. Remover a credencial de
 * um serviço o tira da seleção **no mesmo instante**, sem tocar nos demais
 * (FR-006, invariante D1).
 */
export function reconcileSelection(
  selection: DestinationSelection,
  credentials: Record<ProviderId, Credential | null>,
): DestinationSelection {
  if (selection.locked) return selection;

  const available = providersWithCredential(credentials);
  const selected = selection.selected.filter((provider) => available.includes(provider));
  if (selected.length === selection.selected.length) return selection;
  return { ...selection, selected: orderSelection(selected) };
}

/** Trava a seleção no início da primeira criação (FR-012). */
export function lockSelection(selection: DestinationSelection): DestinationSelection {
  return selection.locked ? selection : { ...selection, locked: true };
}
