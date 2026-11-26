// Device extraction on layouts seen in real Vitatron and Medtronic OCR output (D-79, D-80).
// All values here are synthetic.
import { describe, expect, it } from 'vitest';
import type { OcrResult } from '../../src/core/extraction/ocr';
import { extractFromOcr } from '../../src/core/extraction/run';
import { parseDocumentDate } from '../../src/core/extraction/validate';
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
      // D-83: from "Pacemaker Model: | Vitatron X" (no DR/SR in the model, so no device type).
      device_company: 'Vitatron',
      device_model: 'X',
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

  it('D-83 Abbott layout: row V by column, HV shock impedance, VP "<1 %", ICD type, manufacturer column, indication below', () => {
    const wrap = [
      'Wrap-up™ Report',
      '|  Patient | Indikationen für die Implantation |',
      '| --- | --- |',
      '|  EF % | Kammerflimmern, Vorhofflimmern (AF) |',
      '',
      '|  Aggregat | Hersteller | Modell | S/N | Impl.datum |',
      '| --- | --- | --- | --- | --- |',
      '|  ICD | Abbott | Ellipse™ VR 1377-36QC |  |  |',
      '|  V Elektrode | St. Jude Medical | Durata™ 7122Q / 65 cm |  |  |',
      '',
      'Batterie',
      '',
      'Laufzeit: 5,3-6,6 Jahre',
      '',
      'Testergebnisse',
      '',
      '|   | Reizschw. | Signalamplitude | Elektrodenimpedanz |',
      '| --- | --- | --- | --- |',
      '|  V | 0,75V @ 0,5ms (Bi) | 11,7mV (Bi) | 590 Ω (Bi) |',
      '|  HV |  |  | 80 Ω (RV zu Gehäuse) |',
      '',
      '|  Betriebsart | VVI |',
      '| --- | --- |',
      '|  VP | <1 % |',
      '',
      '|   | VT-1 | VT-2 | VF |',
      '| --- | --- | --- | --- |',
      '|  Detektionsparameter | 171 min-1 | 187 min-1 | 240 min-1 |',
    ].join('\n');
    expect(accepted(ocr(wrap))).toEqual({
      device_type: '1-Kammer-ICD',
      device_company: 'Abbott',
      device_model: 'Ellipse VR 1377-36QC',
      device_indication: 'Z.n. Kammerflimmern',
      pacing_mode: 'VVI',
      battery_remaining: '5.3..6.6',
      battery_remaining_unit: 'Jahre',
      impedance_rv: 590,
      sensing_rv: 11.7,
      threshold_rv_v: 0.75,
      threshold_rv_ms: 0.5,
      icd_shock_impedance: 80,
      icd_vf_zone: 240,
      icd_vt_zone: 187, // VT-2 (D-84)
      icd_z1_rate: 171, // VT-1
      vp_anteil: '<1',
    });
  });

  it('D-83 Biotronik: letterhead, "Implantat", A/V pair, ERI years + months, A/V columns', () => {
    const t = [
      'BIOTRONIK',
      'Implantat: Effecta DR',
      'SN:',
      '# Nachsorge',
      '|  Modus | DDD |',
      '| --- | --- |',
      '|  Erwarteter ERI | 8 J. 5 Mo. |',
      '',
      '|  Testergebnisse | A | V |',
      '| --- | --- | --- |',
      '|  P-/R-Wellenamplitude [mV] | 4.9 | 4.1 |',
      '|  Reizschwelle [V] | --- | 0.9 |',
      '|  Impulsdauer [ms] | --- | 1.0 |',
      '|  Elektrodenimpedanz [Ω] | 331 | 604 |',
      '',
      '|  Stimulation in A/V [%] | 1/14 |',
      '| --- | --- |',
      '|  Atriale Arrhythmielast [%] | 2 |',
    ].join('\n');
    expect(accepted(ocr(t))).toEqual({
      device_type: '2-Kammer-Schrittmacher',
      device_company: 'Biotronik',
      device_model: 'Effecta DR',
      pacing_mode: 'DDD',
      battery_remaining: 8.4, // 8 + 5/12 years, rounded to 1 decimal
      battery_remaining_unit: 'Jahre',
      impedance_ra: 331,
      impedance_rv: 604,
      sensing_ra: 4.9,
      sensing_rv: 4.1,
      threshold_rv_v: 0.9,
      threshold_rv_ms: 1,
      ap_anteil: 1,
      vp_anteil: 14,
      af_burden: 2,
    });
  });

  it('D-83 Vitatron "AAIR<=>DDDR" in the Final column; Medtronic longevity in months', () => {
    const v = ['Final Report', '|   | Initial | Final |', '| --- | --- | --- |', '|  Mode | DDD | AAIR<=>DDDR |'].join('\n');
    expect(accepted(ocr(v)).pacing_mode).toBe('AAIR-DDDR');
    const m = ['# Abschlussbericht', 'Geschätzte verbleibende Laufzeit: 25 Mon., < 4 - 46 Mon. (Basierend auf bisherigen Daten)'].join('\n');
    expect(accepted(ocr(m))).toMatchObject({ battery_remaining: 25, battery_remaining_unit: 'Monate' });
  });

  it('a serial number after the model is never taken along', () => {
    const t = ['Final Report', 'Pacemaker Model: Vitatron G70A2 DR Serial Number: ABC123456'].join('\n');
    const r = accepted(ocr(t));
    expect(r.device_model).toBe('G70A2 DR');
    expect(JSON.stringify(extractFromOcr(device, ocr(t), 0.85).map((x) => x.outcome.ok && x.outcome.stored))).not.toContain('ABC123456');
  });

  it('a value block beside a label is never used for a column-bound field (would mix up A and V)', () => {
    // Label and value as separate text blocks: the RV impedance must not take the atrial value.
    const text = 'Elektrodenimpedanz [Ω]\n\n331\n\n604';
    const o: OcrResult = {
      provider: 'test', model: 'test', pagesProcessed: 1,
      pages: [{ index: 0, width: 700, height: 1000, dpi: 87, text, words: [], blocks: [
        { type: 'text', box: [60, 100, 200, 112], content: 'Elektrodenimpedanz [Ω]', start: 0, minConfidence: 0.99 },
        { type: 'text', box: [400, 100, 430, 112], content: '331', start: text.indexOf('331'), minConfidence: 0.99 },
        { type: 'text', box: [500, 100, 530, 112], content: '604', start: text.indexOf('604'), minConfidence: 0.99 },
      ] }],
    };
    const r = accepted(o);
    expect(r.impedance_ra).toBeUndefined();
    expect(r.impedance_rv).toBeUndefined();
  });

  it('battery status is never extracted (physician decision, D-83)', () => {
    const t = ['Final Report', 'Battery Status OK', '|  Batteriezustand | OK |'].join('\n');
    expect(extractFromOcr(device, ocr(t), 0.85).some((x) => x.field.key === 'battery_status')).toBe(false);
  });

  it('dates: only unambiguous formats', () => {
    expect(parseDocumentDate('24.04.2018')).toBe('2018-04-24');
    expect(parseDocumentDate('16-Feb-2026')).toBe('2026-02-16');
    expect(parseDocumentDate('30 Okt 2026')).toBe('2026-10-30');
    expect(parseDocumentDate('05.07.12')).toBe('2012-07-05');
    expect(parseDocumentDate('04/05/2018')).toBeNull(); // day/month order unknown
    expect(parseDocumentDate('31.02.2020')).toBeNull();
  });

  it('D-84 Abbott: detection intervals from the parameter page, tachy therapy from the Wrap-up page', () => {
    const params = [
      '# Parameter',
      '|   | VT-1 | VT-2 | VF |',
      '| --- | --- | --- | --- |',
      '|  Detektionsparameter | 171 min-1/350 ms 40 Intervalle | 187 min-1/320 ms 30 Intervalle | 240 min-1/250 ms 16 Intervalle |',
    ].join('\n');
    const wrap = [
      'Wrap-up™ Report',
      '|  Zonenkonfiguration | VT-1 | VT-2 | VF |',
      '| --- | --- | --- | --- |',
      '|  Detektionsparameter | 171 min-1 | 187 min-1 | 240 min-1 |',
      '',
      '|  Neue Programmierung | Initial | Endgültig |',
      '| --- | --- | --- |',
      '|  Tachy-Therapie | Aktiviert | Deaktiviert |',
    ].join('\n');
    expect(accepted(ocr(params, wrap))).toMatchObject({
      icd_z1_rate: 171, icd_vt_zone: 187, icd_vf_zone: 240,
      icd_z1_det: 40, icd_z2_det: 30, icd_z4_det: 16,
      tachy_therapy: 'deaktiviert',
    });
  });
});
