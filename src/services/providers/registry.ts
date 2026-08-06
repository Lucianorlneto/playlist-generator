/**
 * Registro de provedores — a **única** fonte de ordenação da fila e do seletor
 * (invariante G1).
 *
 * A ordem nunca é decidida aqui: vem de `PROVIDER_ORDER`, no domínio. Este
 * módulo só resolve `ProviderId` em adaptador, para que nenhuma tela precise
 * conhecer os módulos de serviço.
 *
 * **Invariante G2 / FR-015**: um provedor com orçamento diário nunca precede um
 * sem orçamento. A razão é concreta: a lista que cabe no Spotify sempre cabe,
 * enquanto a do YouTube pode ser bloqueada pela cota — e descobrir isso depois
 * de já ter criado uma playlist no outro serviço é pior do que descobrir antes.
 * A invariante é verificada por teste sobre este registro.
 */

import { orderSelection, PROVIDER_ORDER, type ProviderId } from '@/domain/providers';

import { AppError } from './errors';
import { spotifyProvider } from './spotify';
import type { PlaylistProvider } from './types';
import { youtubeProvider } from './youtube';

export const PROVIDERS: Record<ProviderId, PlaylistProvider> = {
  spotify: spotifyProvider,
  youtube: youtubeProvider,
};

export function providerFor(id: ProviderId): PlaylistProvider {
  const provider = PROVIDERS[id];
  if (provider === undefined) {
    throw new AppError('unexpected', {
      provider: id,
      cause: new Error(`Provedor ${id} não registrado`),
    });
  }
  return provider;
}

/** Adaptadores dos serviços selecionados, na ordem fixa de `PROVIDER_ORDER`. */
export function orderedProviders(selected: readonly ProviderId[]): PlaylistProvider[] {
  return orderSelection(selected).map(providerFor);
}

/** Todos os adaptadores, na ordem fixa — base do seletor de destinos (FR-008). */
export function allProviders(): PlaylistProvider[] {
  return PROVIDER_ORDER.map(providerFor);
}
