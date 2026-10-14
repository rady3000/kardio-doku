// What a study stores (in studies.data_json). Old or empty data parse to defaults.
import { z } from 'zod';

export const StudyDataSchema = z.object({
  /** Entered values. null = explicitly emptied (stops a pre-selection). */
  values: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).default({}),
  /** Keys whose value came from "Alles normal"; a computed category replaces them. */
  presets: z.array(z.string()).default([]),
  /** Physician edits of generated sentences; `basis` = the generated text when edited. "" removes it. */
  overrides: z.record(z.string(), z.object({ text: z.string(), basis: z.string() })).default({}),
  /** Free text appended to a report line. */
  extras: z.record(z.string(), z.string()).default({}),
  /** Physician-inserted library blocks, in order. */
  blocks: z.array(z.object({ id: z.string(), text: z.string() })).default([]),
  /** Extracted values not yet confirmed (milestone M4). Export is blocked while any feeds the report. */
  unconfirmed: z.array(z.string()).default([]),
});
export type StudyData = z.infer<typeof StudyDataSchema>;

/**
 * Reads stored data. Invalid entries are dropped one by one, never the whole
 * study (a single bad value must not erase the documentation).
 */
export function parseStudyData(raw: unknown): StudyData {
  const r = StudyDataSchema.safeParse(raw ?? {});
  if (r.success) return r.data;
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out = StudyDataSchema.parse({});
  for (const key of Object.keys(out) as (keyof StudyData)[]) {
    const part = StudyDataSchema.shape[key].safeParse(obj[key]);
    if (part.success) (out as Record<string, unknown>)[key] = part.data;
  }
  if (obj.values && typeof obj.values === 'object') {
    for (const [k, v] of Object.entries(obj.values as Record<string, unknown>)) {
      if (typeof v === 'string' || v === null || (typeof v === 'number' && Number.isFinite(v))) out.values[k] = v;
    }
  }
  return out;
}
