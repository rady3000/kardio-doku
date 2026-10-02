// Extraction provider interface (SPEC-extraction-gateway §3). This directory is
// the only place in the application allowed to make network calls; the egress
// test (tests/unit/egress.test.ts) enforces that.
//
// M1 defines the interface and the mode gating only. Extraction itself,
// provenance checks and plausibility rules arrive in M4.

export interface SourceDocument {
  fileName: string;
  bytes: Uint8Array;
}

export interface ExtractedValue {
  fieldKey: string;
  rawText: string;
  value: number | string;
  unit: string | null;
  confidence: number;
  page: number;
  bbox: [number, number, number, number];
}

export interface ExtractionResult {
  provider: string;
  model: string;
  values: ExtractedValue[];
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
  extract(document: SourceDocument, fieldKeys: string[]): Promise<ExtractionResult>;
}
