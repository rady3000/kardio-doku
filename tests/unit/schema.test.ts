import { describe, expect, it } from 'vitest';
import { RULES } from '../../src/core/rules/registry';
import { allFields, selectOptions } from '../../src/core/schema';
import { validateSchema } from '../../src/core/validateSchema';
import { MODULE_SCHEMAS } from '../../src/modules';

describe.each([...MODULE_SCHEMAS.values()])('module schema $key', (schema) => {
  it('is structurally valid', () => {
    expect(validateSchema(schema, RULES.rules)).toEqual([]);
  });
  it('select options are unique and include "nicht beurteilbar" unless switched off (D-18)', () => {
    for (const f of allFields(schema)) {
      if (f.type !== 'select') continue;
      const values = selectOptions(f).map((o) => o.value);
      expect(new Set(values).size, f.key).toBe(values.length);
      if (f.allowNb !== false) expect(values, f.key).toContain('nicht beurteilbar');
    }
  });
  it('normal values are valid options', () => {
    for (const f of allFields(schema)) {
      if (f.type === 'select' && f.normal !== undefined) {
        expect(selectOptions(f).map((o) => o.value), f.key).toContain(f.normal);
      }
    }
  });
  it('auto-classified selects offer every category of their rule', () => {
    for (const f of allFields(schema)) {
      if (f.type !== 'select' || !f.autoFrom) continue;
      const rule = RULES.rules.get(f.autoFrom)!;
      const labels = rule.sets.flatMap((s) => s.bands.map((b) => b.label)).filter((l): l is string => l !== null);
      for (const l of labels) expect(selectOptions(f).map((o) => o.value), `${f.key} ← ${rule.id}`).toContain(l);
    }
  });
});
