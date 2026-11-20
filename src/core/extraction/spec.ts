// Per-field extraction declaration (gateway §3.4; units and ranges from
// SPEC-textgen X-6, D-50). Units other than `unit` are converted in code
// (D-22); the plausible range is checked after conversion.

export interface ExtractionSpec {
  /** Labels as printed on the documents, in priority order (first found wins). */
  labels: readonly string[];
  /** Expected unit as printed ('' = unitless). */
  unit: string;
  /** Other accepted units with the factor to the expected unit. */
  alternatives?: readonly { unit: string; factor: number }[];
  /** The value may appear without a unit. */
  unitOptional?: boolean;
  /** Hard sanity bound after conversion (inclusive). Values outside are discarded. */
  range: readonly [number, number];
  /** The range applies to the absolute value (e.g. GLS printed negative). */
  rangeOnAbsolute?: boolean;
}

/** Unit spelling variants mapped to one form ("ml/m²" = "mL/m2"). */
export function normaliseUnit(u: string): string {
  return u
    .trim()
    .toLowerCase()
    .replace(/²/g, '2')
    .replace(/\s+/g, '')
    .replace(/^ohm$|^ohms$/, 'ω');
}
