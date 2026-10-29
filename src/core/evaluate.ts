// Resolves a study: visibility, effective values (entered / pre-selected /
// "Alles normal"), classifications, derived values and warnings. Pure function.
import { evaluate as evalCond, type Resolver, type Scalar } from './conditions';
import { formatQualified, readQualified } from './format';
import { classify, type Classification, type RuleSet } from './rules/ruleSet';
import { allFields, type Derived, type Field, type ModuleSchema, optionValue, selectOptions } from './schema';
import type { StudyData } from './studyData';

export interface Context {
  sex: 'weiblich' | 'männlich' | null;
}

export type ValueSource = 'entered' | 'auto' | 'preset';

export interface Evaluation {
  /** Effective value per visible, filled field (numbers: the value used for checks). */
  values: Map<string, Scalar>;
  /** Report form of qualified numbers, e.g. "> 2,8" or "5,6–22,4" (D-72 b). */
  display: Map<string, string>;
  source: Map<string, ValueSource>;
  visible: Set<string>;
  /** Category per rule set (only when the rule produced a band). */
  classifications: Map<string, Classification>;
  /** Pre-selection a rule suggests for a select field, even when overridden. */
  suggestions: Map<string, string>;
  derived: Map<string, number>;
  /** Fields outside their reference range (neutral highlight only). */
  outOfRange: Set<string>;
  /** Neutral warnings that currently apply (never part of the report). */
  warnings: { section: string; text: string }[];
  resolver: Resolver;
}

export function evaluateStudy(
  schema: ModuleSchema,
  rules: ReadonlyMap<string, RuleSet>,
  data: StudyData,
  ctx: Context,
): Evaluation {
  const values = new Map<string, Scalar>();
  const display = new Map<string, string>();
  const source = new Map<string, ValueSource>();
  const visible = new Set<string>();
  const classifications = new Map<string, Classification>();
  const suggestions = new Map<string, string>();
  const derivedDefs = new Map(schema.derived.map((d) => [d.key, d]));
  const presets = new Set(data.presets);
  let outOfRange: Set<string> | null = null;

  // Derived values are computed on demand from the values known so far, so
  // visibility conditions may use them (e.g. number of episodes).
  const derivedValue = (d: Derived): number => {
    if (d.kind === 'countFilled') return d.fields.filter((f) => values.has(f)).length;
    if (d.kind === 'sum') return d.fields.reduce((s, f) => s + (typeof values.get(f) === 'number' ? (values.get(f) as number) : 0), 0);
    return d.items.filter((i) => evalCond(i.when, resolver)).length;
  };

  const lookup = (key: string): Scalar | undefined => {
    if (key === 'sex') return ctx.sex ?? undefined;
    if (values.has(key)) return values.get(key);
    const d = derivedDefs.get(key);
    return d ? derivedValue(d) : undefined;
  };
  const resolver: Resolver = {
    value: lookup,
    category: (ruleId) => classificationFor(ruleId)?.band.label ?? undefined,
    outOfRange: (key) => (outOfRange ? (key === null ? outOfRange.size > 0 : outOfRange.has(key)) : false),
  };

  // A rule is evaluated on the values known so far (schema order).
  function classificationFor(ruleId: string): Classification | undefined {
    const rule = rules.get(ruleId);
    if (!rule) return undefined;
    const v = values.get(rule.field);
    const c = classify(rule, typeof v === 'number' ? v : undefined, lookup);
    if (c) classifications.set(ruleId, c);
    else classifications.delete(ruleId);
    return c ?? undefined;
  }

  for (const field of allFields(schema)) {
    if (field.visibleIf && !evalCond(field.visibleIf, resolver)) continue;
    visible.add(field.key);
    const has = Object.prototype.hasOwnProperty.call(data.values, field.key);
    const raw = has ? data.values[field.key] : undefined;
    const entered = has && !presets.has(field.key);

    let auto: string | undefined;
    if (field.type === 'select' && field.autoFrom) {
      const label = classificationFor(field.autoFrom)?.band.label ?? undefined;
      if (label && selectOptions(field).some((o) => o.value === label)) {
        auto = label;
        suggestions.set(field.key, label);
      }
    }

    if (entered) {
      if (raw !== null && raw !== undefined && raw !== '') set(field, raw, 'entered');
    } else if (auto !== undefined) {
      set(field, auto, 'auto');
    } else if (raw !== null && raw !== undefined && raw !== '') {
      set(field, raw, 'preset');
    }
  }

  function set(field: Field, v: Scalar, s: ValueSource) {
    if (field.type === 'number') {
      if (field.qualified) {
        const q = readQualified(v);
        if (!q) return;
        values.set(field.key, q.a);
        if (q.q) display.set(field.key, formatQualified(q, field.decimals));
      } else if (typeof v === 'number') {
        values.set(field.key, v);
      } else return;
    } else if (field.type === 'select') {
      if (!selectOptions(field).some((o) => optionValue(o) === v)) return;
      values.set(field.key, v);
    } else if (field.type === 'date') {
      if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
      values.set(field.key, v);
    } else {
      values.set(field.key, v);
    }
    source.set(field.key, s);
  }

  // Final pass: every rule on the final values (later fields may feed conditions).
  for (const id of schema.rules) classificationFor(id);

  const derived = new Map<string, number>();
  for (const d of schema.derived) derived.set(d.key, derivedValue(d));

  outOfRange = new Set<string>();
  for (const field of allFields(schema)) {
    if (field.type !== 'number' || !field.referenceRule || !values.has(field.key)) continue;
    const c = classifications.get(field.referenceRule);
    if (c && !c.band.normal) outOfRange.add(field.key);
  }

  const warnings = (schema.warnings ?? [])
    .filter((w) => evalCond(w.when, resolver))
    .map((w) => ({ section: w.section, text: w.text }));

  return { values, display, source, visible, classifications, suggestions, derived, outOfRange, warnings, resolver };
}

/** Option object for a select value (for `{key:short}` etc.). */
export function optionFor(field: Field, value: Scalar) {
  if (field.type !== 'select') return undefined;
  return selectOptions(field).find((o) => optionValue(o) === value);
}
