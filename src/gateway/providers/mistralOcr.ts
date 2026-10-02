import type { ExtractionProvider } from '../provider';

/** Hosted Mistral OCR API, trial use in TESTBETRIEB only (gateway §1, §3.2). Built in M4. */
export const mistralOcrProvider: ExtractionProvider = {
  id: 'mistral-ocr',
  displayName: 'Mistral OCR (Cloud)',
  isLocal: false,
  implemented: false,
  plannedFor: 'Meilenstein M4',
  async extract() {
    throw new Error('Mistral OCR is not implemented yet (milestone M4).');
  },
};
