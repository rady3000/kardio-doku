// Gateway test §7.1 — in ECHTBETRIEB cloud providers are not returned by the
// registry and cannot be invoked.
import { describe, expect, it } from 'vitest';
import { availableProviders, getProvider, providerInfo, CLOUD_BLOCKED_REASON } from '../../src/gateway/registry';
import type { ExtractionProvider } from '../../src/gateway/provider';

const fake = (id: string, isLocal: boolean): ExtractionProvider => ({
  id,
  displayName: id,
  isLocal,
  implemented: true,
  extract: async () => ({ provider: id, model: id, values: [] }),
});
const providers = [fake('cloud', false), fake('local', true)];

describe('mode gating', () => {
  it('returns no cloud provider in ECHTBETRIEB', () => {
    expect(availableProviders('ECHTBETRIEB', providers).map((p) => p.id)).toEqual(['local']);
    expect(availableProviders('ECHTBETRIEB').every((p) => p.isLocal)).toBe(true);
  });

  it('refuses to hand out a cloud provider in ECHTBETRIEB', () => {
    expect(() => getProvider('ECHTBETRIEB', 'cloud', providers)).toThrow(/not available in ECHTBETRIEB/);
    expect(() => getProvider('ECHTBETRIEB', 'mistral-ocr')).toThrow();
  });

  it('allows cloud and local providers in TESTBETRIEB', () => {
    expect(availableProviders('TESTBETRIEB', providers).map((p) => p.id)).toEqual(['cloud', 'local']);
    expect(getProvider('TESTBETRIEB', 'mistral-ocr').id).toBe('mistral-ocr');
  });

  it('shows cloud providers greyed out with the reason in ECHTBETRIEB', () => {
    const info = providerInfo('ECHTBETRIEB').find((p) => p.id === 'mistral-ocr')!;
    expect(info.enabled).toBe(false);
    expect(info.disabledReason).toBe(CLOUD_BLOCKED_REASON);
  });

  it('runs with no provider configured: the mock provider makes no network call', async () => {
    const mock = getProvider('ECHTBETRIEB', 'mock');
    await expect(mock.extract({ fileName: 'x.pdf', bytes: new Uint8Array() }, [])).resolves.toEqual({
      provider: 'mock',
      model: 'mock',
      values: [],
    });
  });
});
