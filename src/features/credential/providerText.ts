/**
 * Resolução dos textos específicos de cada serviço.
 *
 * A camada de i18n é a **exceção deliberada** à regra "nada ramifica por
 * `ProviderId`" (contracts/provider-contract.md §1): texto por serviço é
 * justamente o que não pode ser generalizado. Concentrar a indexação aqui evita
 * que cada tela repita o mesmo acesso e mantém o tipo estreito.
 */

import type { ProviderId } from '@/domain/providers';
import { t } from '@/i18n/pt-BR';

export type ProviderText = (typeof t.providers)['spotify' | 'youtube'];

export function textFor(provider: ProviderId): ProviderText {
  return t.providers[provider];
}

export function nameOf(provider: ProviderId): string {
  return t.providers[provider].name;
}
