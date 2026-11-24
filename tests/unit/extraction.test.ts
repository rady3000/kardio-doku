// Stage-1 extraction on recorded Mistral OCR 4.1 responses for synthetic,
// fictitious documents (seed/*.pdf): provenance, confidence, units, ranges.
import { describe, expect, it } from 'vitest';
import { parseMistralOcr, type OcrResult } from '../../src/core/extraction/ocr';
import { findCandidates } from '../../src/core/extraction/match';
import { extractFromOcr } from '../../src/core/extraction/run';
import { validateCandidates } from '../../src/core/extraction/validate';
import { allFields } from '../../src/core/schema';
import { tte } from '../../src/modules/tte';
import geRaw from '../fixtures/ocr/tte-ge-synthetic.json';
import textRaw from '../fixtures/ocr/tte-text-synthetic.json';

const ge = parseMistralOcr(geRaw);
const specOf = (key: string) => {
  const f = allFields(tte).find((x) => x.key === key);
  if (f?.type !== 'number' || !f.extraction) throw new Error(key);
  return f.extraction;
};
const text = parseMistralOcr(textRaw);

const accepted = (ocr: OcrResult, threshold = 0.85) =>
  Object.fromEntries(
    extractFromOcr(tte, ocr, threshold)
      .filter((r) => r.outcome.ok)
      .map((r) => [r.field.key, r.outcome.ok ? r.outcome.stored : null]),
  );

describe('Mistral OCR response', () => {
  it('parses pages, blocks with pixel boxes and word confidences', () => {
    expect(ge.model).toBe('mistral-ocr-4-1');
    const p = ge.pages[0]!;
    expect(p.width).toBeGreaterThan(500);
    expect(p.blocks.some((b) => b.type === 'table')).toBe(true);
    expect(p.blocks.every((b) => b.start >= 0)).toBe(true);
    expect(p.words.length).toBeGreaterThan(20);
  });
  it('rejects an unexpected format instead of guessing', () => {
    expect(() => parseMistralOcr({ pages: [{ index: 0 }] })).toThrow();
  });
});

describe('table layout (GE-like, synthetic)', () => {
  it('reads values with units converted in code (cm → mm)', () => {
    expect(accepted(ge)).toEqual({
      ivsd: 11, lvedd: 52, lvesd: 34, pwd: 10, lvef: 58, mitral_e: 0.82, mitral_a: 0.61,
      e_e_prime: 9.4, tapse: 21, gls: -19.2, laesvi: 31,
    });
  });
  it('every value carries page, box and the source line', () => {
    const c = findCandidates(ge, 'lvef', specOf('lvef'))[0]!;
    expect(c.page).toBe(0);
    expect(c.box).not.toBeNull();
    expect(c.rawText).toBe('LVEF_BiP_Q 58 %');
    expect(c.confidence).toBeGreaterThan(0.9);
  });
});

describe('text layout (synthetic, German decimals)', () => {
  const r = Object.fromEntries(extractFromOcr(tte, text, 0.85).map((x) => [x.field.key, x.outcome]));
  it('prefers LVEF_BiP_Q and ignores "LVEF (Teich)"', () => {
    expect(r.lvef!.ok && r.lvef!.stored).toBe(57);
  });
  it('accepts decimal commas and converts m/s → cm/s and cm → mm', () => {
    expect(r.e_e_prime!.ok && r.e_e_prime!.stored).toBe(11.2);
    expect(r.tasv!.ok && r.tasv!.stored).toBe(11);
    expect(r.rv!.ok && r.rv!.stored).toBe(32);
    expect(r.laesvi!.ok && r.laesvi!.stored).toBe(38.5);
    expect(r.nt_probnp!.ok && r.nt_probnp!.stored).toBe(845);
  });
  it('discards an implausible value (TAPSE 9 mm is plausible; range check runs after conversion)', () => {
    expect(r.tapse!.ok && r.tapse!.stored).toBe(9);
  });
  it('fields not in the document stay empty', () => {
    expect(r.ivsd!.ok).toBe(false);
    if (!r.ivsd!.ok) expect(r.ivsd!.reason).toBe('nicht gefunden');
  });
});

describe('automatic rejection (gateway §4.3, test §7.6–7.7)', () => {
  const spec = { labels: ['TAPSE'], unit: 'mm', alternatives: [{ unit: 'cm', factor: 10 }], range: [3, 40] as const };
  const base = findCandidates(text, 'tapse', spec)[0]!;
  it('no bounding box → rejected', () => {
    const o = validateCandidates(spec, [{ ...base, box: null }], 0.85, false);
    expect(o.ok).toBe(false);
  });
  it('low confidence → rejected', () => {
    expect(validateCandidates(spec, [{ ...base, confidence: 0.6 }], 0.85, false).ok).toBe(false);
  });
  it('wrong unit → rejected', () => {
    expect(validateCandidates(spec, [{ ...base, unitText: 'cm/s' }], 0.85, false).ok).toBe(false);
  });
  it('missing unit where one is required → rejected', () => {
    expect(validateCandidates(spec, [{ ...base, unitText: '' }], 0.85, false).ok).toBe(false);
  });
  it('outside the plausible range after conversion → rejected', () => {
    const o = validateCandidates(spec, [{ ...base, unitText: 'cm', value: { q: null, a: 9 } }], 0.85, false);
    expect(o.ok).toBe(false); // 90 mm
  });
  it('two different values for the same label → rejected as ambiguous', () => {
    const o = validateCandidates(spec, [base, { ...base, valueText: '12', value: { q: null, a: 12 } }], 0.85, false);
    expect(o.ok === false && o.reason).toMatch(/mehrdeutig/);
  });
});

describe('layouts seen on real GE printouts (D-77; synthetic data here)', () => {
  const page = (text: string, blocks: OcrResult['pages'][number]['blocks']): OcrResult => ({
    provider: 'test',
    model: 'test',
    pagesProcessed: 1,
    pages: [{ index: 0, width: 700, height: 1000, dpi: 87, text, blocks, words: [] }],
  });
  const block = (content: string, text: string, box: [number, number, number, number], type = 'table') => ({
    type,
    box,
    content,
    start: text.indexOf(content),
    minConfidence: 0.99,
  });

  it('several label/value pairs in one table row; a unit cell only if the field accepts it', () => {
    const table = '|  2D |  | Mitralklappe |  |\n| --- | --- | --- | --- |\n|  IVSd | 1.2 cm | MV E Max | 0.62 m/s |\n|  LVPWd | 1.1 cm | MV E/A Ratio | 2.86 |';
    const ocr = page(table, [block(table, table, [70, 400, 600, 500])]);
    const r = Object.fromEntries(extractFromOcr(tte, ocr, 0.85).filter((x) => x.outcome.ok).map((x) => [x.field.key, x.outcome.ok && x.outcome.stored]));
    expect(r).toEqual({ ivsd: 12, pwd: 11, mitral_e: 0.62, e_a_ratio: 2.86 });
  });

  it('label and value as separate blocks on the same row', () => {
    const text = 'M-Mode\n\nTAPSE\n\n2.2 cm';
    const ocr = page(text, [
      block('M-Mode', text, [68, 788, 127, 803], 'caption'),
      block('TAPSE', text, [69, 805, 110, 817], 'text'),
      block('2.2 cm', text, [192, 805, 230, 817], 'text'),
    ]);
    const c = findCandidates(ocr, 'tapse', specOf('tapse'))[0]!;
    expect(c.rawText).toBe('TAPSE 2.2 cm');
    expect(c.box).toEqual([69, 805, 230, 817]);
    expect(validateCandidates(specOf('tapse'), [c], 0.85, false)).toMatchObject({ ok: true, stored: 22 });
  });

  it("e' septal / lateral in m/s are converted to cm/s; E/E' Sept is not mistaken for E' Sept", () => {
    const t = "|  E' Sept | 0.05 m/s |\n| --- | --- |\n|  E/E' Sept | 12.18 |\n|  E' Lat | 0.11 m/s |";
    const ocr = page(t, [block(t, t, [70, 100, 300, 200])]);
    const r = Object.fromEntries(extractFromOcr(tte, ocr, 0.85).filter((x) => x.outcome.ok).map((x) => [x.field.key, x.outcome.ok && x.outcome.stored]));
    expect(r).toEqual({ e_prime_septal: 5, e_prime_lateral: 11 });
  });

  it('a label cell must match exactly: "G peak SL Voll" (APLAX) is not the average', () => {
    const t = '|  G peak SL Voll | -11 % |\n| --- | --- |\n|  (APLAX) |  |\n|  G peak SL Voll (Avg) | -12 % |';
    const ocr = page(t, [block(t, t, [70, 100, 300, 200])]);
    expect(findCandidates(ocr, 'gls', specOf('gls')).map((c) => c.valueText)).toEqual(['-12']);
  });

  it('a label wrapped onto the next row is joined; the partial label alone matches nothing', () => {
    const t = '|  G peak SL Voll | -15 % |\n| --- | --- |\n|  (A4C) |  |\n|  G peak SL Voll | -16 % |\n|  (Avg) |  |\n|  BA PSSL Voll | -10 % |';
    const ocr = page(t, [block(t, t, [70, 100, 300, 200])]);
    const c = findCandidates(ocr, 'gls', specOf('gls'));
    expect(c.map((x) => [x.valueText, x.rawText])).toEqual([['-16', 'G peak SL Voll (Avg) -16 %']]);
    expect(validateCandidates(specOf('gls'), c, 0.85, false)).toMatchObject({ ok: true, stored: -16 });
  });

  it('a row whose value cell is filled is never treated as a wrapped label', () => {
    const t = '|  G peak SL Voll | -15 % |\n| --- | --- |\n|  (Avg) | -9 % |';
    const ocr = page(t, [block(t, t, [70, 100, 300, 200])]);
    expect(findCandidates(ocr, 'gls', specOf('gls'))).toEqual([]);
  });
});
