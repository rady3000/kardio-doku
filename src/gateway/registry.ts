// Provider registry with mode gating (gateway §2.3 item 2, test §7.1):
// in ECHTBETRIEB cloud providers are neither returned nor invokable.
import type { Betriebsmodus } from '../shared/mode';
import type { ProviderInfo } from '../shared/types';
import type { ExtractionProvider } from './provider';
import { mockProvider } from './providers/mock';
import { mistralOcrProvider } from './providers/mistralOcr';
import { mistralOcrSelfHostedProvider } from './providers/mistralOcrSelfHosted';

const ALL_PROVIDERS: readonly ExtractionProvider[] = [
  mistralOcrProvider,
  mistralOcrSelfHostedProvider,
  mockProvider,
];

export const CLOUD_BLOCKED_REASON =
  'Im Echtbetrieb gesperrt: Dokumente dürfen die Einrichtung nicht verlassen.';

/** Providers that may be invoked in this mode. */
export function availableProviders(
  mode: Betriebsmodus,
  providers: readonly ExtractionProvider[] = ALL_PROVIDERS,
): ExtractionProvider[] {
  return providers.filter((p) => mode === 'TESTBETRIEB' || p.isLocal);
}

/** The only way to obtain a provider for use. Throws for a cloud provider in ECHTBETRIEB. */
export function getProvider(
  mode: Betriebsmodus,
  id: string,
  providers: readonly ExtractionProvider[] = ALL_PROVIDERS,
): ExtractionProvider {
  const provider = availableProviders(mode, providers).find((p) => p.id === id);
  if (!provider) {
    throw new Error(`Extraction provider "${id}" is not available in ${mode}.`);
  }
  return provider;
}

/** Display list for the settings page; cloud providers are shown greyed out in ECHTBETRIEB. */
export function providerInfo(
  mode: Betriebsmodus,
  providers: readonly ExtractionProvider[] = ALL_PROVIDERS,
): ProviderInfo[] {
  return providers
    .filter((p) => p.id !== 'mock')
    .map((p) => {
      const blocked = mode === 'ECHTBETRIEB' && !p.isLocal;
      const reason = blocked
        ? CLOUD_BLOCKED_REASON
        : !p.implemented
          ? `Noch nicht verfügbar (${p.plannedFor ?? 'später'}).`
          : null;
      return {
        id: p.id,
        displayName: p.displayName,
        isLocal: p.isLocal,
        enabled: reason === null,
        disabledReason: reason,
      };
    });
}
