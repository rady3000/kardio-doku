import type { ExtractionProvider } from '../provider';

/** Self-hosted Mistral OCR container, target for ECHTBETRIEB (gateway §1, §3.2). Stub in v1. */
export const mistralOcrSelfHostedProvider: ExtractionProvider = {
  id: 'mistral-ocr-selfhosted',
  displayName: 'Mistral OCR (eigener Server)',
  isLocal: true,
  implemented: false,
  plannedFor: 'nach der Testphase',
  async extract() {
    throw new Error('Self-hosted Mistral OCR is not implemented in v1.');
  },
};
