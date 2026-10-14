// Resolves a study: visibility, effective values (entered / pre-selected /
// "Alles normal"), classifications and derived values. Pure function.
import { evaluate as evalCond, type Resolver, type Scalar } from './conditions';
import { classify, type Classification, type RuleSet } from './rules/ruleSet';
import { allFields, type Field, type ModuleSchema, optionValue, selectOptions } from './schema';
import type { StudyData } from './studyData';

export interface Context {
  sex: 'weiblich' | 'männlich' | null;
}

export type ValueSource = 'entered' | 'auto' | 'preset';

export interface Evaluation {
  /** Effective value per visible, filled field. */
  values: Map<string, Scalar>;
  source: Map<string, ValueSource>;
  visible: Set<string>;
  /** Category per rule set (only when the rule produced a band). */
  classifications: Map<string, Classification>;
  /** Pre-selection a rule suggests for a select field, even when overridden. */
  suggestions: Map<string, string>;
  derived: Map<string, number>;
  /** Fields outside their reference range (neutral highlight only). */
  outOfRange: Set<string>;
  resolver: Resolver;
}

export function evaluateStudy(
  schema: ModuleSchema,
  rules: ReadonlyMap<string, RuleSet>,
  data: StudyData,
  ctx: Context,
): Evaluation {
  const values = new Map<string, Scalar>();
  const source = new Map<string, ValueSource>();
  const visible = new Set<string>();
  const classifications = new Map<string, Classification>();
  const suggestions = new Map<string, string>();
  const derived = new Map<string, number>();
  const presets = new Set(data.presets);

  const lookup = (key: string): Scalar | undefined => {
    if (key === 'sex') return ctx.sex ?? undefined;
    return values.get(key) ?? derived.get(key);
  };
  const resolver: Resolver = {
    value: lookup,
    category: (ruleId) => {
      const c = classificationFor(ruleId);
      return c?.band.label ?? undefined;
    },
  };

  // A rule is evaluated lazily on the values known so far (schema order).
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
    if (field.type === 'number' && typeof v !== 'number') return;
    if (field.type === 'select' && !selectOptions(field).some((o) => o.value === v)) return;
    values.set(field.key, v);
    source.set(field.key, s);
  }

  // Final pass: every rule on the final values (later fields may feed conditions).
  for (const id of schema.rules) classificationFor(id);

  for (const d of schema.derived) {
    if (d.kind === 'countFilled') derived.set(d.key, d.fields.filter((f) => values.has(f)).length);
    else derived.set(d.key, d.items.filter((i) => evalCond(i.when, resolver)).length);
  }

  const outOfRange = new Set<string>();
  for (const field of allFields(schema)) {
    if (field.type !== 'number' || !field.referenceRule || !values.has(field.key)) continue;
    const c = classifications.get(field.referenceRule);
    if (c && !c.band.normal) outOfRange.add(field.key);
  }

  return { values, source, visible, classifications, suggestions, derived, outOfRange, resolver };
}

/** Option object for a select value (for `{key:short}` etc.). */
export function optionFor(field: Field, value: Scalar) {
  if (field.type !== 'select') return undefined;
  return selectOptions(field).find((o) => optionValue(o) === value);
}
