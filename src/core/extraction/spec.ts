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
  /**
   * Table column the value must stand in, named by its header cell
   * ("Atrial Lead" / "Ventricular Lead"). The header is the nearest row above
   * in the same table that contains any header the module declares in
   * `ModuleSchema.extraction.columns`; if it has no such column, nothing is taken.
   */
  column?: readonly string[];
  /**
   * Section headings the value must stand under (prefixes, case-insensitive).
   * The section is the nearest heading above that the module declares in
   * `ModuleSchema.extraction.sections`. Under any other heading, nothing is taken.
   */
  section?: readonly string[];
  /** Take the second value of "0.500 V at 0.40 ms" / "0.625 V bei 0.40 ms" (the pulse width). */
  second?: boolean;
}

/** Module-wide extraction settings. */
export interface ModuleExtraction {
  /**
   * Page markers (e.g. "Final Report", "Abschlussbericht"). If a field is found
   * on such pages, only those values count; otherwise all pages count.
   */
  preferPages?: readonly string[];
  /** All section headings that delimit sections (prefixes, case-insensitive). */
  sections?: readonly string[];
  /** All table column headers that `column` may name (a row containing one is a header row). */
  columns?: readonly string[];
}

/** Unit spelling variants mapped to one form ("ml/m²" = "mL/m2"). */
export function normaliseUnit(u: string): string {
  return u
    .trim()
    .toLowerCase()
    .replace(/²|\^\{2\}|\^2/g, '2') // OCR writes "cm²" also as "cm^{2}" or "cm^2"
    .replace(/\s+/g, '')
    .replace(/^ohm$|^ohms$/, 'ω');
}
