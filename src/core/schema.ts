// Declarative module schema (CLAUDE.md "Architecture"). A module is data:
// sections, fields, derived values, rule references and sentence templates.
// One generic form renderer and one report generator work on any schema.
import type { Cond } from './conditions';

export const NB = 'nicht beurteilbar';

export interface SelectOption {
  value: string;
  /** Short form, e.g. "II°" for the summary. */
  short?: string;
  /** Further grammatical forms, e.g. { adj: "eingeschränkte" }. */
  forms?: Record<string, string>;
}

interface FieldBase {
  key: string;
  label: string;
  /** Label in the report (measurement list, "nicht beurteilbar" sentences); default `label`. */
  reportLabel?: string;
  visibleIf?: Cond;
  /** Value set by "Alles normal". */
  normal?: string | number;
  /** Document extraction allowed (gateway §3.4); used from milestone M4. */
  extractable?: boolean;
  help?: string;
}

export interface NumberField extends FieldBase {
  type: 'number';
  unit: string;
  /** Decimal places shown in the report. */
  decimals: number;
  /** Rule set used for the neutral out-of-range highlight. */
  referenceRule?: string;
  /** Accepts "> x", "< x" and ranges "a–b" (D-72 b); checks use x or a. */
  qualified?: boolean;
}

export interface DateField extends FieldBase {
  type: 'date';
}

export interface SelectField extends FieldBase {
  type: 'select';
  options: readonly (string | SelectOption)[];
  /** "nicht beurteilbar" is offered unless false (D-18). */
  allowNb?: boolean;
  /** Pre-selected from this rule set's category; the physician's choice wins (D-15). */
  autoFrom?: string;
}

export interface TextField extends FieldBase {
  type: 'text';
  multiline?: boolean;
}

export type Field = NumberField | SelectField | TextField | DateField;

export interface Section {
  key: string;
  title: string;
  fields: readonly Field[];
}

/** Derived value. Each one cites its source in `source` (CLAUDE.md working method). */
export type Derived =
  | { key: string; label: string; source: string; kind: 'countFilled'; fields: readonly string[] }
  | { key: string; label: string; source: string; kind: 'countTrue'; items: readonly { label: string; when: Cond }[] }
  | { key: string; label: string; source: string; kind: 'sum'; fields: readonly string[] };

/** Live display of a derived value inside a form section; hover shows its inputs. */
export interface DerivedDisplay {
  section: string;
  label: string;
  template: Template;
  when?: Cond;
  details?: readonly { label: string; when: Cond }[];
  inputs: readonly string[];
}

/** Neutral warning shown in the form and next to the report; never part of the report (D-62). */
export interface Warning {
  section: string;
  when: Cond;
  text: string;
}

/** Criteria table shown next to a section; the entered value's column is highlighted. */
export interface CriteriaTable {
  section: string;
  title: string;
  source: string;
  columns: readonly string[];
  rows: readonly { label: string; field?: string; rule?: string; cells: readonly string[] }[];
}

// ---- Report templates ----------------------------------------------------

/**
 * Template text: `{key}` value, `{key:form}` option form (e.g. `short`),
 * `{cat:rule}` / `{cat:rule:form}` category, `[...]` optional group (dropped
 * when a placeholder inside is empty). A sentence whose required placeholder
 * is empty is dropped (empty is safe, D-18).
 */
export type Template = string | readonly TemplatePart[];
export type TemplatePart =
  | string
  /** List: items joined by `sep`; an item may give alternatives (first that renders). */
  | { join: string; items: readonly (string | readonly string[])[]; before?: string; after?: string };

export interface SentenceSpec {
  id: string;
  when?: Cond;
  text: Template;
}

export type LineItem =
  | SentenceSpec
  /** First alternative whose condition holds and which renders. */
  | { id: string; choose: readonly SentenceSpec[] }
  /** "{reportLabel}: nicht beurteilbar." for each listed field set to nicht beurteilbar (D-18). */
  | { nb: readonly string[] };

export interface LineSpec {
  id: string;
  label?: string;
  items: readonly LineItem[];
  /** Fragments joined by ", ", capitalised, closed by "." — the whole line is one editable sentence. */
  fragments?: boolean;
  /** Physician-inserted library blocks are placed here. */
  library?: boolean;
}

export interface ReportSectionSpec {
  id: string;
  heading?: string;
  lines: readonly LineSpec[];
}

export interface MeasurementGroup {
  label: string;
  fields: readonly string[];
}

export interface ReportSpec {
  title: string;
  measurementsHeading: string;
  measurements: readonly MeasurementGroup[];
  /** Sections before the measurement block (e.g. indication). */
  head: readonly ReportSectionSpec[];
  body: readonly ReportSectionSpec[];
}

export interface ModuleSchema {
  key: string;
  title: string;
  version: number;
  sections: readonly Section[];
  derived: readonly Derived[];
  displays: readonly DerivedDisplay[];
  tables: readonly CriteriaTable[];
  warnings?: readonly Warning[];
  /** Rule sets this module uses (each must exist in reference/). */
  rules: readonly string[];
  /** Library file with physician-selectable text blocks. */
  library?: string;
  report: ReportSpec;
}

export function allFields(schema: ModuleSchema): Field[] {
  return schema.sections.flatMap((s) => s.fields);
}

export function optionValue(o: string | SelectOption): string {
  return typeof o === 'string' ? o : o.value;
}

/** Options as shown in the form, incl. "nicht beurteilbar" (D-18). */
export function selectOptions(field: SelectField): SelectOption[] {
  const opts = field.options.map((o) => (typeof o === 'string' ? { value: o } : o));
  if (field.allowNb !== false && !opts.some((o) => o.value === NB)) opts.push({ value: NB });
  return opts;
}
