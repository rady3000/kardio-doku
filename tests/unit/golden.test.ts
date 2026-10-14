// Gateway test §7.9 — determinism: the same confirmed values produce
// byte-identical report text, permanently. Expected texts live in
// tests/golden/<module>/*.txt. To accept an intended change after clinical
// review: UPDATE_GOLDEN=1 npx vitest run tests/unit/golden.test.ts
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { evaluateStudy } from '../../src/core/evaluate';
import { generateReport, reportToText } from '../../src/core/report';
import { RULES } from '../../src/core/rules/registry';
import { parseStudyData } from '../../src/core/studyData';
import { MODULE_SCHEMAS } from '../../src/modules';

const root = path.resolve(__dirname, '../golden');

interface Case {
  sex: 'weiblich' | 'männlich' | null;
  data: unknown;
  /** "all": apply "Alles normal" to the whole study first. */
  normal?: 'all';
}

describe.each([...MODULE_SCHEMAS.keys()].filter((k) => fs.existsSync(path.join(root, k))))('golden files %s', (key) => {
  const schema = MODULE_SCHEMAS.get(key)!;
  const dir = path.join(root, key);
  const cases = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));

  it.each(cases)('%s', (file) => {
    const c = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8')) as Case;
    const data = parseStudyData(c.data);
    if (c.normal === 'all') {
      for (const f of schema.sections.flatMap((s) => s.fields)) {
        if (f.normal !== undefined && !(f.key in data.values)) {
          data.values[f.key] = f.normal;
          data.presets.push(f.key);
        }
      }
    }
    const ctx = { sex: c.sex };
    const text = reportToText(generateReport(schema, RULES.rules, data, ctx, evaluateStudy(schema, RULES.rules, data, ctx)));
    const expectedFile = path.join(dir, file.replace(/\.json$/, '.txt'));
    if (process.env.UPDATE_GOLDEN) fs.writeFileSync(expectedFile, text);
    expect(fs.existsSync(expectedFile), `missing ${expectedFile}`).toBe(true);
    expect(text).toBe(fs.readFileSync(expectedFile, 'utf-8'));
  });
});
