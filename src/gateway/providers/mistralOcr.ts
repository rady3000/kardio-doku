// Hosted Mistral OCR, trial use in TESTBETRIEB only (gateway §1, §3.2; D-76).
// The only outbound network call of the application. EU endpoint, pinned
// model, document sent inline as base64 (no Files API, so nothing is stored
// there). The API key comes from Electron safeStorage via `setKeySource`.
import { parseMistralOcr } from '../../core/extraction/ocr';
import type { ExtractionProvider } from '../provider';

export const MISTRAL_ENDPOINT = 'https://api.eu.mistral.ai/v1/ocr';
export const MISTRAL_MODEL = 'mistral-ocr-4-1';

let keySource: () => string | null = () => null;
export function setKeySource(fn: () => string | null): void {
  keySource = fn;
}

export function mistralRequestBody(mime: string, bytes: Uint8Array) {
  const data = `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
  return {
    model: MISTRAL_MODEL,
    document: mime === 'application/pdf' ? { type: 'document_url', document_url: data } : { type: 'image_url', image_url: data },
    include_blocks: true,
    confidence_scores_granularity: 'word',
  };
}

export const mistralOcrProvider: ExtractionProvider = {
  id: 'mistral-ocr',
  displayName: 'Mistral OCR (Cloud, EU)',
  isLocal: false,
  implemented: true,
  async ocr(doc) {
    const key = keySource();
    if (!key) throw new Error('Kein API-Schlüssel für Mistral OCR gespeichert (Einstellungen).');
    const res = await fetch(MISTRAL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(mistralRequestBody(doc.mime, doc.bytes)),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      const detail = res.status === 401 ? 'API-Schlüssel ungültig' : `HTTP ${res.status}`;
      throw new Error(`Mistral OCR: ${detail}`);
    }
    return parseMistralOcr(await res.json());
  },
};
