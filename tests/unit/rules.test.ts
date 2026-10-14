// Every classification band set has a test (CLAUDE.md working method), and
// the validator rejects gaps, overlaps and missing provenance (gateway §5.2).
import { describe, expect, it } from 'vitest';
import { RULES } from '../../src/core/rules/registry';
import { classify, validateRuleSet } from '../../src/core/rules/ruleSet';

const rule = (id: string) => {
  const r = RULES.rules.get(id);
  if (!r) throw new Error(`missing rule ${id}`);
  return r;
};
const label = (id: string, value: number, ctx: Record<string, string> = {}) =>
  classify(rule(id), value, (k) => ctx[k] ?? (k === 'tapse' ? 20 : undefined))?.band.label ?? undefined;
const normal = (id: string, value: number, ctx: Record<string, string> = {}) =>
  classify(rule(id), value, (k) => ctx[k])?.band.normal;
const M = { sex: 'männlich' };
const W = { sex: 'weiblich' };
const SR = { rhythm: 'Sinusrhythmus' };
const AF = { rhythm: 'Vorhofflimmern' };
const FLA = { rhythm: 'Vorhofflattern' };

describe('reference/*.json', () => {
  it('all rule files are valid', () => {
    expect(RULES.problems).toEqual([]);
    expect(RULES.rules.size).toBeGreaterThanOrEqual(26);
  });
});

describe('validator', () => {
  const base = {
    id: 'x', version: 1, title: 'X', field: 'x', unit: 'mm', purpose: 'category',
    source: 'Some guideline 2020', reviewedOn: '2026-01-01',
  };
  const two = (maxIncl: boolean | undefined, minIncl: boolean | undefined, max = 10, min = 10) => ({
    ...base,
    sets: [{ bands: [{ label: 'a', max, maxIncl, normal: true }, { label: 'b', min, minIncl, normal: false }] }],
  });
  it('accepts contiguous bands', () => expect(validateRuleSet(two(true, false))).toEqual([]));
  it('rejects a gap between values', () => expect(validateRuleSet(two(true, false, 10, 11)).join()).toMatch(/gap or overlap/));
  it('rejects an overlapping boundary', () => expect(validateRuleSet(two(true, true)).join()).toMatch(/overlap/));
  it('rejects an open boundary (gap)', () => expect(validateRuleSet(two(false, false)).join()).toMatch(/gap/));
  it('rejects missing source and reviewedOn', () => {
    const { source: _s, reviewedOn: _r, ...rest } = two(true, false);
    const problems = validateRuleSet(rest).join();
    expect(problems).toMatch(/source/);
    expect(problems).toMatch(/reviewedOn/);
  });
  it('rejects bands not open at the ends', () => {
    const r = two(true, false);
    (r.sets[0]!.bands[0] as Record<string, unknown>).min = 0;
    expect(validateRuleSet(r).join()).toMatch(/open below/);
  });
  it('rejects competing band-set conditions', () => {
    const r = two(true, false);
    const set = r.sets[0]!;
    expect(validateRuleSet({ ...r, sets: [{ ...set, when: { sex: 'männlich' } }, { ...set, when: { sex: 'männlich' } }] }).join()).toMatch(/already used/);
  });
  it('gives no category without the condition value (empty is safe)', () => {
    expect(label('tte-lvef', 60)).toBeUndefined();
  });
});

describe('TTE-R30 chamber quantification', () => {
  it('R30-1 LVEF (Lang 2015)', () => {
    expect(label('tte-lvef', 52, M)).toBe('normal');
    expect(label('tte-lvef', 51.9, M)).toBe('leicht reduziert');
    expect(label('tte-lvef', 54, W)).toBe('normal');
    expect(label('tte-lvef', 53.9, W)).toBe('leicht reduziert');
    expect(label('tte-lvef', 41, M)).toBe('leicht reduziert');
    expect(label('tte-lvef', 40.9, W)).toBe('mittelgradig reduziert');
    expect(label('tte-lvef', 30, M)).toBe('mittelgradig reduziert');
    expect(label('tte-lvef', 29.9, M)).toBe('hochgradig reduziert');
  });
  it('R30-2 LAVI', () => {
    expect(label('tte-lavi', 34)).toBe('normal dimensioniert');
    expect(label('tte-lavi', 34.1)).toBe('leichtgradig dilatiert');
    expect(label('tte-lavi', 41.5)).toBe('leichtgradig dilatiert');
    expect(label('tte-lavi', 42)).toBe('mittelgradig dilatiert');
    expect(label('tte-lavi', 48)).toBe('mittelgradig dilatiert');
    expect(label('tte-lavi', 48.1)).toBe('hochgradig dilatiert');
  });
  it('R30-3 LVEDD', () => {
    expect(label('tte-lvedd', 58, M)).toBe('normal dimensioniert');
    expect(label('tte-lvedd', 58.1, M)).toBe('leicht dilatiert');
    expect(label('tte-lvedd', 63.9, M)).toBe('leicht dilatiert');
    expect(label('tte-lvedd', 64, M)).toBe('mittelgradig dilatiert');
    expect(label('tte-lvedd', 69, M)).toBe('hochgradig dilatiert');
    expect(label('tte-lvedd', 52, W)).toBe('normal dimensioniert');
    expect(label('tte-lvedd', 52.5, W)).toBe('leicht dilatiert');
    expect(label('tte-lvedd', 58, W)).toBe('mittelgradig dilatiert');
    expect(label('tte-lvedd', 62, W)).toBe('hochgradig dilatiert');
  });
  it.each(['tte-ivsd', 'tte-pwd'])('R30-4 / 4b wall thickness %s', (id) => {
    expect(label(id, 5.9, M)).toBeUndefined();
    expect(normal(id, 5.9, M)).toBe(false);
    expect(label(id, 6, M)).toBe('normwertig');
    expect(label(id, 10, M)).toBe('normwertig');
    expect(label(id, 10.5, M)).toBe('leicht hypertrophiert');
    expect(label(id, 13.9, M)).toBe('leicht hypertrophiert');
    expect(label(id, 14, M)).toBe('mittelgradig hypertrophiert');
    expect(label(id, 17, M)).toBe('hochgradig hypertrophiert');
    expect(label(id, 9, W)).toBe('normwertig');
    expect(label(id, 9.1, W)).toBe('leicht hypertrophiert');
    expect(label(id, 13, W)).toBe('mittelgradig hypertrophiert');
    expect(label(id, 16, W)).toBe('hochgradig hypertrophiert');
  });
  it('R30-5 LVESD reference range', () => {
    expect(normal('tte-lvesd', 25, M)).toBe(true);
    expect(normal('tte-lvesd', 40, M)).toBe(true);
    expect(normal('tte-lvesd', 40.1, M)).toBe(false);
    expect(normal('tte-lvesd', 24.9, M)).toBe(false);
    expect(normal('tte-lvesd', 22, W)).toBe(true);
    expect(normal('tte-lvesd', 35.1, W)).toBe(false);
  });
  it('R30-6 / 6b RV size', () => {
    expect(label('tte-rv-laenge', 30)).toBe('normwertig');
    expect(label('tte-rv-laenge', 30.1)).toBe('dilatiert');
    expect(label('tte-rvd1', 41)).toBe('normwertig');
    expect(label('tte-rvd1', 41.1)).toBe('dilatiert');
    expect(label('tte-rvd2', 35)).toBe('normwertig');
    expect(label('tte-rvd2', 35.1)).toBe('dilatiert');
  });
  it('R30-7 RV function follows TASV, only with TAPSE entered', () => {
    expect(label('tte-rv-funktion', 9.5)).toBe('normal');
    expect(label('tte-rv-funktion', 9.4)).toBe('eingeschränkt');
    expect(classify(rule('tte-rv-funktion'), 12, () => undefined)).toBeNull(); // TAPSE missing
    expect(normal('tte-tapse', 17)).toBe(true);
    expect(normal('tte-tapse', 16.9)).toBe(false);
    expect(normal('tte-tasv', 9.5)).toBe(true);
    expect(normal('tte-tasv', 9.4)).toBe(false);
  });
  it('R30-8 VCI', () => {
    expect(label('tte-vci', 21)).toBe('normalkalibrig');
    expect(label('tte-vci', 21.1)).toBe('dilatiert');
  });
  it('R30-9 aorta ascendens (ESC 2024)', () => {
    expect(label('tte-aorta-asc', 40, M)).toBe('normwertig');
    expect(label('tte-aorta-asc', 40.1, M)).toBe('dilatiert');
    expect(label('tte-aorta-asc', 36, W)).toBe('normwertig');
    expect(label('tte-aorta-asc', 36.1, W)).toBe('dilatiert');
  });
});

describe('TTE-R20 HFpEF criteria and peptides', () => {
  it('R20-1 LVMI ≥ 95 / ≥ 115 (cut-off itself fulfilled)', () => {
    expect(label('tte-hfpef-lvmi', 115, M)).toBe('erfüllt');
    expect(label('tte-hfpef-lvmi', 114.9, M)).toBe('nicht erfüllt');
    expect(label('tte-hfpef-lvmi', 95, W)).toBe('erfüllt');
    expect(label('tte-hfpef-lvmi', 94.9, W)).toBe('nicht erfüllt');
  });
  it('R20-1 RWT > 0.42', () => {
    expect(label('tte-hfpef-rwt', 0.42)).toBe('nicht erfüllt');
    expect(label('tte-hfpef-rwt', 0.43)).toBe('erfüllt');
  });
  it('R20-2 LAVI > 34 (SR) / > 40 (AF, flutter)', () => {
    expect(label('tte-hfpef-lavi', 34, SR)).toBe('nicht erfüllt');
    expect(label('tte-hfpef-lavi', 34.1, SR)).toBe('erfüllt');
    expect(label('tte-hfpef-lavi', 40, AF)).toBe('nicht erfüllt');
    expect(label('tte-hfpef-lavi', 40.1, FLA)).toBe('erfüllt');
    expect(label('tte-hfpef-lavi', 50, { rhythm: 'AV-Block III' })).toBeUndefined();
  });
  it("R20-3 E/e' > 9, R20-4 sPAP > 35 / TR > 2.8", () => {
    expect(label('tte-hfpef-ee', 9)).toBe('nicht erfüllt');
    expect(label('tte-hfpef-ee', 9.1)).toBe('erfüllt');
    expect(label('tte-hfpef-spap', 35)).toBe('nicht erfüllt');
    expect(label('tte-hfpef-spap', 36)).toBe('erfüllt');
    expect(label('tte-hfpef-trv', 2.8)).toBe('nicht erfüllt');
    expect(label('tte-hfpef-trv', 2.81)).toBe('erfüllt');
  });
  it('R20.2 natriuretic peptides by rhythm', () => {
    expect(label('tte-ntprobnp', 220, SR)).toBe('nicht erhöht');
    expect(label('tte-ntprobnp', 221, SR)).toBe('erhöht');
    expect(label('tte-ntprobnp', 660, AF)).toBe('nicht erhöht');
    expect(label('tte-ntprobnp', 661, FLA)).toBe('erhöht');
    expect(label('tte-bnp', 80, SR)).toBe('nicht erhöht');
    expect(label('tte-bnp', 81, SR)).toBe('erhöht');
    expect(label('tte-bnp', 240, AF)).toBe('nicht erhöht');
    expect(label('tte-bnp', 241, AF)).toBe('erhöht');
  });
  it("R20.4 e' reference values", () => {
    expect(normal('tte-eprime-septal', 7)).toBe(true);
    expect(normal('tte-eprime-septal', 6.9)).toBe(false);
    expect(normal('tte-eprime-lateral', 10)).toBe(true);
    expect(normal('tte-eprime-lateral', 9.9)).toBe(false);
  });
});

describe('TTE-R40 TR criteria table (display only)', () => {
  it('VC columns', () => {
    expect(label('tte-tr-vc', 2.9)).toBe('I');
    expect(label('tte-tr-vc', 3)).toBe('II');
    expect(label('tte-tr-vc', 6.9)).toBe('II');
    expect(label('tte-tr-vc', 13.5)).toBe('III');
    expect(label('tte-tr-vc', 14)).toBe('IV');
    expect(label('tte-tr-vc', 21)).toBe('V');
  });
  it('EROA columns', () => {
    expect(label('tte-tr-eroa', 19)).toBe('I');
    expect(label('tte-tr-eroa', 20)).toBe('II');
    expect(label('tte-tr-eroa', 40)).toBe('III');
    expect(label('tte-tr-eroa', 79)).toBe('IV');
    expect(label('tte-tr-eroa', 80)).toBe('V');
  });
});
