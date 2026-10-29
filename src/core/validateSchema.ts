// Structural checks of a module schema: unique keys, known rule sets, and
// every condition or placeholder refers to something that exists.
import { condKeys, type Cond } from './conditions';
import type { RuleSet } from './rules/ruleSet';
import { allFields, type LineItem, type ModuleSchema, type Template } from './schema';
import { placeholders } from './template';

export function validateSchema(schema: ModuleSchema, rules: ReadonlyMap<string, RuleSet>): string[] {
  const problems: string[] = [];
  const fields = allFields(schema);
  const keys = new Set<string>();
  for (const f of fields) {
    if (keys.has(f.key)) problems.push(`duplicate field ${f.key}`);
    keys.add(f.key);
  }
  for (const d of schema.derived) {
    if (keys.has(d.key)) problems.push(`duplicate key ${d.key}`);
    keys.add(d.key);
  }
  keys.add('sex');

  const ruleKnown = (id: string, where: string) => {
    if (!rules.has(id)) problems.push(`${where}: unknown rule set ${id}`);
    else if (!schema.rules.includes(id)) problems.push(`${where}: rule set ${id} not listed in schema.rules`);
  };
  for (const id of schema.rules) if (!rules.has(id)) problems.push(`schema.rules: unknown rule set ${id}`);
  for (const id of schema.rules) {
    const r = rules.get(id);
    if (r && !keys.has(r.field)) problems.push(`rule ${id}: field ${r.field} not in schema`);
  }

  const checkCond = (c: Cond | undefined, where: string) => {
    if (!c) return;
    const { keys: ks, rules: rs } = condKeys(c);
    for (const k of ks) if (!keys.has(k)) problems.push(`${where}: unknown key ${k}`);
    for (const r of rs) ruleKnown(r, where);
  };
  const checkTemplate = (t: Template, where: string) => {
    const strings: string[] = typeof t === 'string' ? [t] : t.flatMap((p) => (typeof p === 'string' ? [p] : p.items.flat()));
    for (const s of strings) {
      let names: string[];
      try {
        names = placeholders(s);
      } catch (err) {
        problems.push(`${where}: ${(err as Error).message}`);
        continue;
      }
      for (const name of names) {
        const [a, b] = name.split(':');
        if (a === 'cat') ruleKnown(b!, where);
        else if (!keys.has(a!)) problems.push(`${where}: unknown placeholder ${name}`);
      }
    }
  };

  for (const f of fields) {
    checkCond(f.visibleIf, `field ${f.key}`);
    if (f.type === 'number' && f.referenceRule) ruleKnown(f.referenceRule, `field ${f.key}`);
    if (f.type === 'select' && f.autoFrom) ruleKnown(f.autoFrom, `field ${f.key}`);
  }
  for (const d of schema.derived) {
    if (d.kind === 'countFilled' || d.kind === 'sum') for (const k of d.fields) if (!keys.has(k)) problems.push(`derived ${d.key}: unknown ${k}`);
    if (d.kind === 'countTrue') d.items.forEach((i) => checkCond(i.when, `derived ${d.key}`));
  }
  for (const w of schema.warnings ?? []) {
    checkCond(w.when, `warning ${w.text}`);
    if (!schema.sections.some((s) => s.key === w.section)) problems.push(`warning ${w.text}: unknown section ${w.section}`);
  }
  for (const disp of schema.displays) {
    checkTemplate(disp.template, `display ${disp.label}`);
    disp.details?.forEach((d) => checkCond(d.when, `display ${disp.label}`));
  }
  for (const t of schema.tables) {
    for (const row of t.rows) {
      if (row.rule) ruleKnown(row.rule, `table ${t.title}`);
      if (row.cells.length !== t.columns.length) problems.push(`table ${t.title}: row ${row.label} has wrong cell count`);
    }
  }

  const ids = new Set<string>();
  const checkItem = (item: LineItem, where: string) => {
    if ('nb' in item) {
      for (const k of item.nb) if (!keys.has(k)) problems.push(`${where}: unknown nb field ${k}`);
      return;
    }
    if (ids.has(item.id)) problems.push(`${where}: duplicate sentence id ${item.id}`);
    ids.add(item.id);
    if ('choose' in item) {
      for (const alt of item.choose) {
        checkCond(alt.when, `${where}/${item.id}`);
        checkTemplate(alt.text, `${where}/${item.id}`);
      }
    } else {
      checkCond(item.when, `${where}/${item.id}`);
      checkTemplate(item.text, `${where}/${item.id}`);
    }
  };
  for (const sec of [...schema.report.head, ...schema.report.body]) {
    for (const line of sec.lines) line.items.forEach((i) => checkItem(i, `report ${sec.id}/${line.id}`));
  }
  for (const g of schema.report.measurements) {
    for (const k of g.fields) if (!fields.some((f) => f.key === k)) problems.push(`measurements: unknown field ${k}`);
  }
  return problems;
}
