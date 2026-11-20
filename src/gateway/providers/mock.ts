import fs from 'node:fs';
import { parseMistralOcr } from '../../core/extraction/ocr';
import type { ExtractionProvider } from '../provider';

/**
 * Canned OCR results for tests (gateway §3.2). Never touches the network.
 * Reads a recorded Mistral response from KARDIO_E2E_MOCK_OCR when set.
 */
export const mockProvider: ExtractionProvider = {
  id: 'mock',
  displayName: 'Testanbieter (ohne Netzwerk)',
  isLocal: true,
  implemented: true,
  async ocr() {
    const file = process.env.KARDIO_E2E_MOCK_OCR;
    if (!file) return { provider: 'mock', model: 'mock', pages: [], pagesProcessed: 0 };
    return { ...parseMistralOcr(JSON.parse(fs.readFileSync(file, 'utf-8'))), provider: 'mock' };
  },
};
