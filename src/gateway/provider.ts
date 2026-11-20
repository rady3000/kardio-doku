// Extraction provider interface (SPEC-extraction-gateway §3). This directory is
// the only place in the application allowed to make network calls; the egress
// test (tests/unit/egress.test.ts) enforces that. A provider only reads the
// document (OCR); finding field values is deterministic code in
// src/core/extraction (D-76 a).
import type { OcrResult } from '../core/extraction/ocr';

export interface SourceDocument {
  fileName: string;
  mime: string;
  bytes: Uint8Array;
}

export interface ExtractionProvider {
  id: string;
  displayName: string;
  /** True when documents never leave the institution. Only local providers exist in ECHTBETRIEB. */
  isLocal: boolean;
  /** False until the provider is implemented. */
  implemented: boolean;
  /** When an unimplemented provider is planned, shown in the settings page. */
  plannedFor?: string;
  ocr(document: SourceDocument): Promise<OcrResult>;
}
