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
  /** With `column`: if no header row is found above, the next cell is used (tables without headers). */
  columnOptional?: boolean;
  /** Text may follow the value on the same line ("9 years, 7 - 10.5 years (Based on …)"). */
  trailing?: boolean;
  /**
   * The printed unit decides a companion select field instead of a conversion
   * (battery longevity: "Jahre" or "Monate", stored as printed, SPEC-textgen X-6).
   * Keys are the option values, entries the printed spellings.
   */
  unitField?: { key: string; units: Readonly<Record<string, readonly string[]>> };
  /** Per label: "Stimulation in A/V [%] | 1/14" → part 0 (before "/") or part 1 (after it). */
  parts?: Readonly<Record<string, 0 | 1>>;
  /** "8 J. 5 Mo.": a second number with this unit is added as value × factor (8 + 5/12 years). */
  compound?: { units: readonly string[]; factor: number; decimals: number };
}

/**
 * Extraction for a choice, text or date field (D-83). The value is the text
 * next to (or below) a label; it is never interpreted by a model. A choice is
 * taken only if one of the mapping patterns matches; anything else is discarded.
 */
export interface ValueExtractionSpec {
  kind: 'choice' | 'text' | 'date';
  labels: readonly string[];
  column?: readonly string[];
  columnOptional?: boolean;
  section?: readonly string[];
  /** The value may also stand on the line directly below a label line ("Indikationen für die Implantation"). */
  below?: boolean;
  /** Labels whose mere presence is the evidence, e.g. the "BIOTRONIK" letterhead; the value is the label text. */
  presence?: readonly string[];
  /** choice: patterns test "<label as listed> <value>" (default; e.g. "ICD Ellipse VR 1377-36QC") or the value alone. */
  mapOn?: 'raw' | 'value';
  /** The value ends before these words (e.g. "Serial Number", "Seriennummer"), so a serial is never taken along. */
  stopAt?: readonly string[];
  /** choice: [pattern, option] pairs tried in order on "label value" (case-insensitive regular expressions). */
  map?: readonly (readonly [string, string])[];
  /** text: patterns removed from the value (case-insensitive), e.g. the manufacturer prefix or "™". */
  strip?: readonly string[];
  /** date: earliest plausible date (ISO); the latest is today. */
  minDate?: string;
}

/** Module-wide extraction settings. */
export interface ModuleExtraction {
  /**
   * Page titles (e.g. "Final Report", "Abschlussbericht"; a whole line). If a field is found
   * on such pages, only those values count; otherwise all pages count.
   */
  preferPages?: readonly string[];
  /** All section headings that delimit sections (prefixes, case-insensitive). */
  sections?: readonly string[];
  /** All table column headers that `column` may name (a row containing one is a header row). Matching ignores a trailing colon. */
  columns?: readonly string[];
}

/** Unit spelling variants mapped to one form ("ml/m²" = "mL/m2"). */
export function normaliseUnit(u: string): string {
  return u
    .trim()
    .toLowerCase()
    .replace(/²|\^\{2\}|\^2/g, '2') // OCR writes "cm²" also as "cm^{2}" or "cm^2"
    .replace(/\s+/g, '')
    .replace(/[,;]$/, '') // "years," at the end of a list
    .replace(/^ohm$|^ohms$/, 'ω');
}
