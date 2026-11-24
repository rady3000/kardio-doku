// From an OCR result to field values for one module (deterministic stage 1, D-76 a).
import { allFields, type ModuleSchema, type NumberField } from '../schema';
import type { OcrResult } from './ocr';
import { findCandidates } from './match';
import { validateCandidates, type Outcome } from './validate';

export interface FieldOutcome {
  field: NumberField;
  outcome: Outcome;
}

export function extractFromOcr(schema: ModuleSchema, ocr: OcrResult, threshold: number): FieldOutcome[] {
  return allFields(schema)
    .filter((f): f is NumberField => f.type === 'number' && !!f.extraction)
    .map((field) => ({
      field,
      outcome: validateCandidates(field.extraction!, findCandidates(ocr, field.key, field.extraction!, schema.extraction), threshold, !!field.qualified),
    }));
}
