// Device extraction on layouts seen in real Vitatron and Medtronic OCR output (D-79, D-80).
// All values here are synthetic.
import { describe, expect, it } from 'vitest';
import type { OcrResult } from '../../src/core/extraction/ocr';
import { extractFromOcr } from '../../src/core/extraction/run';
import { device } from '../../src/modules/device';

type Page = OcrResult['pages'][number];

function page(index: number, text: string): Page {
  // One block over the whole page text, high confidence: these tests are about layout.
  return { index, width: 700, height: 1000, dpi: 87, text, blocks: [{ type: 'table', box: [60, 100, 640, 900], content: text, start: 0, minConfidence: 0.99 }], words: [] };
}
const ocr = (...pages: string[]): OcrResult => ({ provider: 'test', model: 'test', pagesProcessed: pages.length, pages: pages.map((t, i) => page(i, t)) });
const accepted = (o: OcrResult) =>
  Object.fromEntries(extractFromOcr(device, o, 0.85).filter((x) => x.outcome.ok).map((x) => [x.field.key, x.outcome.ok && x.outcome.stored]));

const INITIAL = [
  'Initial Interrogation Report',
  '|  Lead Summary | Atrial | Ventricular  |',
  '| --- | --- | --- |',
  '|  Measured Threshold | 0.750 V at 0.40 ms | 0.625 V at 0.40 ms  |',
  '|  Measured Impedance | 401 ohms | 512 ohms  |',
  'Pacing (% of total):',
  '|  A. Paced | 12.4% | PVC singles | 1,234  |',
  '| --- | --- | --- | --- |',
  '|  V. Paced | 88.1% | PVC runs | 7  |',
].join('\n');

const FINAL_DR = [
  'Final Report',
  '|  Pacemaker Model: | Vitatron X |   |   |',
  '| --- | --- | --- | --- |',
  '|  Atrial Lead: | Medtronic | 5076 |   |',
  '|  Impedance | 101 ohms |  |   |',
  '|  Lead Status:  |   |   |   |',
  '|   | Atrial Lead | Ventricular Lead |   |',
  '|  Measured Impedance | 390 ohms | 470 ohms |   |',
  '|  A. Output Management - |   |   | Sensing Assurance - week ending  |',
  '|  Measured Threshold: 0.500 V at 0.40 ms |   |   | Min. P-Wave Amplitude 2.0 mV  |',
  '|  V. Output Management - from |   |   |   |',
  '|  Measured Threshold: 0.375 V at 0.40 ms |   |   | R-Wave Amplitude: Predominantly paced rhythm  |',
  '|  In-Office Threshold Test Results |   |   |   |',
  '',
  'Atrial Sensing Threshold',
  '',
  'P-wave > 5.60 mV',
  '',
  'Ventricular Sensing Threshold',
  '',
  'R-wave 5.60 mV - 8.00 mV',
].join('\n');

describe('device extraction (Vitatron / Medtronic layouts)', () => {
  it('final report: impedance by column, thresholds by section, sensing ranges; final wins over initial', () => {
    expect(accepted(ocr(INITIAL, FINAL_DR))).toEqual({
      impedance_ra: 390,
      impedance_rv: 470,
      threshold_ra_v: 0.5,
      threshold_ra_ms: 0.4,
      threshold_rv_v: 0.375,
      threshold_rv_ms: 0.4,
      sensing_ra: '>5.6',
      sensing_rv: '5.6..8',
      // Not on the final report: taken from the initial interrogation (D-80).
      ap_anteil: 12.4,
      vp_anteil: 88.1,
    });
  });

  it('single-chamber header printed in the first cell ("| Ventricular Lead |  |"), Medtronic German labels', () => {
    const vvi = [
      '# Abschlussbericht',
      '|  Elektrodenstatus: |  |  |   |',
      '| --- | --- | --- | --- |',
      '|  V. Elektrode  |   |   |   |',
      '|  Gemessene Impedanz | 983 Ohm |  |   |',
      '|  V. Capture-Manageme |  | Sensing Assurance - Woche bis zum |   |',
      '|  Gemessener Reizschwellenwert: 0.625 V bei 0.40 ms |   | R-Zacken-Amplitude: Überwiegend stimulierter Rhythmus  |   |',
      'Ventrikuläre Wahrnehmungsschwelle',
      'R-Welle 11.20 mV - 15.68 mV',
    ].join('\n');
    expect(accepted(ocr(vvi))).toEqual({ impedance_rv: 983, threshold_rv_v: 0.625, threshold_rv_ms: 0.4, sensing_rv: '11.2..15.68' });
  });

  it('a single-lead header with two values in the row is not trusted', () => {
    const t = ['Final Report', '|  Ventricular Lead  |   |   |', '| --- | --- | --- |', '|  Measured Impedance | 390 ohms | 470 ohms |'].join('\n');
    expect(accepted(ocr(t))).toEqual({});
  });

  it('a threshold without an A./V. heading above it is not taken; nor one under another heading', () => {
    const t = [
      'Final Report',
      '|  Measured Threshold: 0.500 V at 0.40 ms |   |',
      '| --- | --- |',
      '|  Sensing Assurance - |   |',
      '|  Measured Threshold: 0.750 V at 0.40 ms |   |',
    ].join('\n');
    expect(accepted(ocr(t))).toEqual({});
  });

  it('different values on two final pages for one field → ambiguous, left empty', () => {
    const a = ['Final Report', 'Ventricular Sensing Threshold', 'R-wave 5.60 mV - 8.00 mV'].join('\n');
    const b = ['Final Report', 'Ventricular Sensing Threshold', 'R-wave 8.00 mV - 11.20 mV'].join('\n');
    const r = extractFromOcr(device, ocr(a, b), 0.85).find((x) => x.field.key === 'sensing_rv')!;
    expect(r.outcome.ok === false && r.outcome.reason).toMatch(/mehrdeutig/);
  });

  it('impedance with thousands separator ("1,234 ohms") is not misread as 1.234 Ω', () => {
    const t = ['Final Report', '|   | Atrial Lead | Ventricular Lead |', '| --- | --- | --- |', '|  Measured Impedance | 1,234 ohms | 470 ohms |'].join('\n');
    const r = accepted(ocr(t));
    expect(r.impedance_ra).toBeUndefined(); // 1.234 is outside 100–3000 → discarded, never stored wrong
    expect(r.impedance_rv).toBe(470);
  });

  it('serial numbers are never extracted', () => {
    const t = ['Final Report', 'Serial Number: ABC123456', 'Seriennummer: 12345678'].join('\n');
    expect(extractFromOcr(device, ocr(t), 0.85).some((x) => x.field.key === 'device_serial')).toBe(false);
  });
});
