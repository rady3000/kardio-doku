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
