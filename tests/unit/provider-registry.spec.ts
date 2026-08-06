import { describe, expect, it } from 'vitest';

import { capabilitiesOf, orderSelection, PROVIDER_ORDER } from '@/domain/providers';
import { allProviders, orderedProviders, PROVIDERS, providerFor } from '@/services/providers/registry';

describe('FR-015 — ordem fixa dos provedores', () => {
  it('PROVIDER_ORDER é exatamente Spotify e depois YouTube', () => {
    expect(PROVIDER_ORDER).toEqual(['spotify', 'youtube']);
  });

  it('todo provedor de PROVIDER_ORDER está registrado', () => {
    for (const provider of PROVIDER_ORDER) {
      expect(PROVIDERS[provider]).toBeDefined();
      expect(providerFor(provider).id).toBe(provider);
    }
    expect(allProviders()).toHaveLength(PROVIDER_ORDER.length);
  });

  it('orderedProviders ignora a ordem em que a seleção chega', () => {
    expect(orderedProviders(['youtube', 'spotify']).map((p) => p.id)).toEqual([
      'spotify',
      'youtube',
    ]);
    expect(orderedProviders(['youtube']).map((p) => p.id)).toEqual(['youtube']);
    expect(orderedProviders([])).toEqual([]);
  });

  it('orderSelection é a única fonte de ordem, e concorda com o registro', () => {
    expect(orderSelection(['youtube', 'spotify'])).toEqual(['spotify', 'youtube']);
    expect(orderedProviders(['youtube', 'spotify']).map((p) => p.id)).toEqual(
      orderSelection(['youtube', 'spotify']),
    );
  });

  /**
   * Invariante G2 / P2, verificada sobre o registro e não sobre uma lista
   * escrita à mão: se um terceiro provedor com cota entrar antes de um sem cota,
   * este teste quebra.
   */
  it('nenhum provedor com cota precede um provedor sem cota (invariante G2)', () => {
    let vistoComCota = false;
    for (const provider of PROVIDER_ORDER) {
      const temCota = capabilitiesOf(provider).quota !== null;
      if (temCota) vistoComCota = true;
      else {
        expect(
          vistoComCota,
          `${provider} não tem cota e aparece depois de um provedor que tem`,
        ).toBe(false);
      }
    }
  });
});

describe('FR-023, FR-024, FR-029, FR-035 — capacidades declaradas', () => {
  it('Spotify: renova em silêncio, sem cota, lote 100, exibe álbum, limiar 0,82', () => {
    const capabilities = capabilitiesOf('spotify');
    expect(capabilities.canRefreshSilently).toBe(true);
    expect(capabilities.quota).toBeNull();
    expect(capabilities.batchSize).toBe(100);
    expect(capabilities.showsAlbum).toBe(true);
    expect(capabilities.thresholds).toEqual({ confident: 0.82, uncertain: 0.55 });
  });

  it('YouTube: sem renovação silenciosa, com cota, lote 1, sem álbum, limiar 0,88', () => {
    const capabilities = capabilitiesOf('youtube');
    expect(capabilities.canRefreshSilently).toBe(false);
    expect(capabilities.quota?.dailyBudget).toBe(10_000);
    expect(capabilities.quota?.resetTimeZone).toBe('America/Los_Angeles');
    expect(capabilities.batchSize).toBe(1);
    expect(capabilities.showsAlbum).toBe(false);
    expect(capabilities.thresholds).toEqual({ confident: 0.88, uncertain: 0.55 });
  });

  it('o adaptador expõe refresh exatamente quando a capacidade declara (FR-035)', () => {
    for (const provider of PROVIDER_ORDER) {
      const adapter = providerFor(provider);
      expect(adapter.refresh !== undefined).toBe(adapter.capabilities.canRefreshSilently);
    }
  });

  it('o adaptador expõe estimate e recordConsumption exatamente quando há cota (FR-029)', () => {
    for (const provider of PROVIDER_ORDER) {
      const adapter = providerFor(provider);
      const temCota = adapter.capabilities.quota !== null;
      expect(adapter.estimate !== undefined).toBe(temCota);
      expect(adapter.recordConsumption !== undefined).toBe(temCota);
    }
  });

  it('só o YouTube exige origem JavaScript no cadastro (FR-005)', () => {
    expect(providerFor('spotify').setup.needsJavaScriptOrigin).toBe(false);
    expect(providerFor('youtube').setup.needsJavaScriptOrigin).toBe(true);
  });
});
