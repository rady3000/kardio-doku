import type { ExtractionProvider } from '../provider';

/** Canned extractions for the test suite (gateway §3.2). Never touches the network. */
export const mockProvider: ExtractionProvider = {
  id: 'mock',
  displayName: 'Testanbieter (ohne Netzwerk)',
  isLocal: true,
  implemented: true,
  async extract() {
    return { provider: 'mock', model: 'mock', values: [] };
  },
};
