// From an OCR result to field values for one module (deterministic stage 1, D-76 a).
import { allFields, optionValue, type Field, type ModuleSchema } from '../schema';
import type { OcrResult } from './ocr';
import { findCandidates, findValueCandidates } from './match';
import { validateCandidates, validateValueCandidates, type Outcome } from './validate';

export interface FieldOutcome {
  field: Field;
  outcome: Outcome;
}

export interface ExtractionContext {
  /** ECHTBETRIEB with a local provider: identifying fields (localOnly) may be read (D-84). */
  localEchtbetrieb?: boolean;
}

export function extractFromOcr(schema: ModuleSchema, ocr: OcrResult, threshold: number, ctx: ExtractionContext = {}): FieldOutcome[] {
  const fields = allFields(schema);
  const out: FieldOutcome[] = [];
  for (const field of fields) {
    if (!field.extraction) continue;
    if (field.type !== 'number' && field.extraction.localOnly && !ctx.localEchtbetrieb) continue;
    if (field.type === 'number') {
      const spec = field.extraction;
      const outcome = validateCandidates(spec, findCandidates(ocr, field.key, spec, schema.extraction), threshold, !!field.qualified);
      out.push({ field, outcome });
      // The printed unit fills its companion select ("Monate"), with the same source (D-83).
      const companion = spec.unitField ? fields.find((f) => f.key === spec.unitField!.key) : undefined;
      if (companion && outcome.ok) out.push({ field: companion, outcome: { ...outcome, stored: outcome.unit, unit: '' } });
    } else {
      const options = field.type === 'select' ? field.options.map(optionValue) : [];
      const outcome = validateValueCandidates(field.extraction, findValueCandidates(ocr, field.key, field.extraction, schema.extraction), threshold, options);
      out.push({ field, outcome });
    }
  }
  return out;
}
