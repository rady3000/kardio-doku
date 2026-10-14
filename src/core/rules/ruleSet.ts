// Classification rule sets (CLAUDE.md "Classification rules are data, not
// code"; gateway §5). Each file in reference/*.json is one rule set.
//
// Band semantics (SPEC-textgen G-2, D-52): bands are listed in ascending
// order; each boundary is stored once on both neighbouring bands, and exactly
// one of them includes it. The validator rejects gaps and overlaps.
import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const BandSchema = z
  .object({
    /** Category word used in report text; null = no category (no text). */
    label: z.string().min(1).nullable(),
    min: z.number().optional(),
    minIncl: z.boolean().optional(),
    max: z.number().optional(),
    maxIncl: z.boolean().optional(),
    /** Inside the reference range (no highlight). */
    normal: z.boolean(),
    /** Grammatical forms of the label, e.g. { adj: "leicht reduzierte" }. */
    forms: z.record(z.string(), z.string()).optional(),
  })
  .strict();
export type Band = z.infer<typeof BandSchema>;

export const BandSetSchema = z
  .object({
    /** Condition on sex or a field, e.g. { "sex": "männlich" } or { "rhythm": ["Vorhofflimmern"] }. */
    when: z.record(z.string(), z.union([z.string(), z.array(z.string()).min(1)])).optional(),
    bands: z.array(BandSchema).min(1),
  })
  .strict();
export type BandSet = z.infer<typeof BandSetSchema>;

export const RuleSetSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    version: z.number().int().positive(),
    title: z.string().min(1),
    field: z.string().min(1),
    unit: z.string(),
    /** Guideline and version — mandatory (gateway §5.2). */
    source: z.string().min(10),
    reviewedOn: isoDate,
    /** Purpose: classification text, reference range (highlight only) or criteria table. */
    purpose: z.enum(['category', 'reference', 'criteria']),
    /** Further fields that must be entered for a result (e.g. RV function needs TAPSE and TASV). */
    requires: z.array(z.string()).optional(),
    note: z.string().optional(),
    sets: z.array(BandSetSchema).min(1),
  })
  .strict();
export type RuleSet = z.infer<typeof RuleSetSchema>;

/** Returns the list of problems; empty when valid. */
export function validateRuleSet(raw: unknown): string[] {
  const parsed = RuleSetSchema.safeParse(raw);
  if (!parsed.success) {
    return parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
  }
  const rule = parsed.data;
  const problems: string[] = [];
  rule.sets.forEach((set, s) => {
    const where = `sets[${s}]`;
    const { bands } = set;
    if (bands[0]!.min !== undefined) problems.push(`${where}: first band must be open below (no min)`);
    if (bands[bands.length - 1]!.max !== undefined) problems.push(`${where}: last band must be open above (no max)`);
    for (let i = 0; i < bands.length - 1; i++) {
      const a = bands[i]!;
      const b = bands[i + 1]!;
      if (a.max === undefined || b.min === undefined) {
        problems.push(`${where}: bands ${i} and ${i + 1} must share a boundary (max/min)`);
        continue;
      }
      if (a.max !== b.min) problems.push(`${where}: gap or overlap between ${a.max} and ${b.min}`);
      if (a.maxIncl === undefined || b.minIncl === undefined) {
        problems.push(`${where}: boundary ${a.max} needs maxIncl and minIncl`);
      } else if (a.maxIncl === b.minIncl) {
        problems.push(
          `${where}: boundary ${a.max} must belong to exactly one band (${a.maxIncl ? 'overlap' : 'gap'})`,
        );
      }
      if (i > 0 && a.min !== undefined && a.max <= a.min) problems.push(`${where}: band ${i} is empty`);
    }
  });
  // Band sets must not compete for the same condition values.
  const seen = new Map<string, number>();
  rule.sets.forEach((set, s) => {
    const combos = expandWhen(set.when);
    for (const combo of combos) {
      if (seen.has(combo)) problems.push(`sets[${s}]: condition ${combo || '(none)'} already used by sets[${seen.get(combo)}]`);
      seen.set(combo, s);
    }
  });
  if (rule.sets.length > 1 && rule.sets.some((s) => !s.when)) {
    problems.push('sets: with several band sets, every set needs a condition');
  }
  return problems;
}

function expandWhen(when: BandSet['when']): string[] {
  if (!when) return [''];
  let combos = [''];
  for (const key of Object.keys(when).sort()) {
    const vals = when[key]!;
    const list = typeof vals === 'string' ? [vals] : vals;
    combos = combos.flatMap((c) => list.map((v) => `${c}${c ? '&' : ''}${key}=${v}`));
  }
  return combos;
}

export interface Classification {
  ruleId: string;
  band: Band;
}

/** Classifies a value. `lookup` gives sex and field values for band-set conditions. */
export function classify(
  rule: RuleSet,
  value: number | undefined,
  lookup: (key: string) => string | number | undefined,
): Classification | null {
  if (value === undefined || !Number.isFinite(value)) return null;
  if (rule.requires?.some((k) => lookup(k) === undefined)) return null;
  const set = rule.sets.find((s) =>
    Object.entries(s.when ?? {}).every(([key, want]) => {
      const v = lookup(key);
      return typeof v === 'string' && (typeof want === 'string' ? v === want : want.includes(v));
    }),
  );
  if (!set) return null; // e.g. sex or rhythm not entered: no category (empty is safe)
  const band = set.bands.find((b) => inBand(b, value));
  return band ? { ruleId: rule.id, band } : null;
}

function inBand(b: Band, v: number): boolean {
  const aboveMin = b.min === undefined || (b.minIncl ? v >= b.min : v > b.min);
  const belowMax = b.max === undefined || (b.maxIncl ? v <= b.max : v < b.max);
  return aboveMin && belowMax;
}
