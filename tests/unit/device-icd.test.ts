// D-84: device report layout, manufacturer zone names, ICD programming check
// (Stiles et al. 2019, on screen only) and the switchable hint group.
import { describe, expect, it } from 'vitest';
import { fieldLabel } from '../../src/core/evaluate';
import { applyHintSettings } from '../../src/core/hints';
import { allFields } from '../../src/core/schema';
import { device } from '../../src/modules/device';
import { runDevice } from '../helpers/device';

const field = (key: string) => allFields(device).find((f) => f.key === key)!;
const konsensus = (ev: ReturnType<typeof runDevice>['ev']) => ev.warnings.filter((w) => w.group === 'icd-konsensus').map((w) => w.text);

/** Abbott, no known VT, programmed exactly as the consensus table (1443a). */
const ABBOTT_OK = {
  device_type: '1-Kammer-ICD',
  device_company: 'Abbott',
  vt_history: 'keine VT bekannt',
  tachy_therapy: 'aktiviert',
  icd_vf_zone: 240,
  icd_z4_det: 30,
  icd_vt_zone: 187,
  icd_z2_det: 30,
  icd_vf_atp: 'ein',
};

describe('report title and device phrase (D-84)', () => {
  it.each([
    ['1-Kammer-Schrittmacher', 'Schrittmacherabfrage'],
    ['2-Kammer-Schrittmacher', 'Schrittmacherabfrage'],
    ['1-Kammer-ICD', 'ICD-Abfrage'],
    ['2-Kammer-ICD', 'ICD-Abfrage'],
    ['S-ICD', 'ICD-Abfrage'],
    ['3-Kammer-Schrittmacher', 'CRT-Abfrage'],
    ['3-Kammer-ICD', 'CRT-Abfrage'],
  ])('%s → %s', (type, title) => {
    expect(runDevice({ device_type: type }).model.title).toBe(title);
  });
  it('no device type → "Device-Abfrage"', () => expect(runDevice({}).model.title).toBe('Device-Abfrage'));
  it('implantation sentence in the genitive, mode, battery wording and bullets', () => {
    const { text } = runDevice({
      device_type: '2-Kammer-Schrittmacher',
      device_company: 'Vitatron',
      device_model: 'Q70',
      implantation_date: '2020-03-04',
      device_indication: 'Sick-Sinus-Syndrom',
      pacing_mode: 'DDDR',
      battery_status: 'OK',
      battery_remaining: 12,
      battery_remaining_unit: 'Jahre',
      threshold_ra_v: 0.375,
      threshold_ra_ms: 0.4,
    });
    expect(text).toContain(
      'Implantation & Programmierung:\nZ. n. Implantation eines 2-Kammer-Schrittmachers (Vitatron Q70) am 04.03.2020 bei Sick-Sinus-Syndrom. Programmierter Betriebsmodus: DDDR.',
    );
    expect(text).toContain('Geräte- und Sondenmesswerte:\n· Batteriestatus: Regelrecht (geschätzte Restlaufzeit: 12 Jahre)\n· Reizschwellen: RA 0,375 V / 0,4 ms');
  });
  it('"Andere" indication uses the free text', () => {
    const { text } = runDevice({ device_type: '1-Kammer-Schrittmacher', device_indication: 'Andere', other_indication_text: 'AV-Block III° und Sick-Sinus-Syndrom' });
    expect(text).toContain('Z. n. Implantation eines 1-Kammer-Schrittmachers bei AV-Block III° und Sick-Sinus-Syndrom.');
  });
  it('"Beurteilung und Procedere" is the physician\'s free text, never pre-filled', () => {
    expect(runDevice({ device_type: '1-Kammer-Schrittmacher' }).text).not.toContain('Beurteilung und Procedere');
    expect(runDevice({ assessment_text: 'Kontrolle in 6 Monaten.' }).text).toContain('Beurteilung und Procedere:\nKontrolle in 6 Monaten.');
  });
});

describe('manufacturer zone names (D-84)', () => {
  it('labels follow the company', () => {
    const label = (key: string, values: Record<string, string>) => fieldLabel(field(key), runDevice(values).ev.resolver);
    expect(label('icd_z1_rate', { device_type: '1-Kammer-ICD', device_company: 'Medtronic' })).toBe('VT Monitor: Frequenz');
    expect(label('icd_vt_zone', { device_type: '1-Kammer-ICD', device_company: 'Biotronik' })).toBe('VT2: Frequenz');
    expect(label('icd_vf_zone', { device_type: 'S-ICD', device_company: 'Boston Scientific' })).toBe('Schockzone: Frequenz');
    expect(label('icd_z2_det', { device_type: '1-Kammer-ICD', device_company: 'Boston Scientific' })).toBe('VT: Erkennung (s)');
    expect(label('icd_vt_zone', { device_type: '1-Kammer-ICD' })).toBe('Zone 2: Frequenz');
  });
  it('report line uses the names and the detection unit', () => {
    expect(runDevice(ABBOTT_OK).text).toContain('· Detektionszonen: VT-2 187 bpm (30 Intervalle) / VF 240 bpm (30 Intervalle)');
    expect(runDevice({ device_type: 'S-ICD', icd_z3_rate: 200, icd_vf_zone: 230 }).text).toContain('· Detektionszonen: Bedingte Schockzone 200 bpm / Schockzone 230 bpm');
  });
});

describe('ICD programming check (Stiles et al. 2019; on screen only, D-84)', () => {
  it('programming as in the consensus table: no notice', () => {
    const { ev } = runDevice(ABBOTT_OK);
    expect(konsensus(ev)).toEqual([]);
    expect(ev.derived.get('icd_konsensus_abweichungen')).toBe(0);
    expect(ev.visible.has('icd_konsensus_entscheidung')).toBe(false);
  });
  it('a deviating zone gives a neutral notice and asks for the physician\'s response', () => {
    const { ev, text } = runDevice({ ...ABBOTT_OK, icd_vt_zone: 171, icd_vf_atp: 'aus' });
    expect(konsensus(ev)).toHaveLength(2);
    expect(konsensus(ev)[0]).toMatch(/^Abweichung vom Konsensus-Vorschlag \(.*Abbott, keine VT bekannt\): VT-2 187 bpm\.$/);
    expect(ev.visible.has('icd_konsensus_entscheidung')).toBe(true);
    // Never in the report text.
    expect(text).not.toMatch(/Konsensus|Abweichung/);
    expect(runDevice({ ...ABBOTT_OK, icd_vt_zone: 171, icd_konsensus_entscheidung: 'bewusst so belassen' }).text).not.toContain('belassen');
  });
  it('known VT: a zone 10–20 bpm below the VT rate is accepted', () => {
    const known = { ...ABBOTT_OK, vt_history: 'VT bekannt', vt_rate: 170 };
    expect(konsensus(runDevice({ ...known, icd_vt_zone: 155 }).ev)).toEqual([]);
    expect(konsensus(runDevice({ ...known, icd_vt_zone: 165 }).ev)).toHaveLength(1);
  });
  it('no check without VT history or company; empty values are not deviations', () => {
    const { vt_history: _h, ...noHistory } = ABBOTT_OK;
    expect(konsensus(runDevice({ ...noHistory, icd_vt_zone: 100 }).ev)).toEqual([]);
    expect(konsensus(runDevice({ device_type: '1-Kammer-ICD', device_company: 'Abbott', vt_history: 'keine VT bekannt' }).ev)).toEqual([]);
  });
  it('deactivated tachy therapy: neutral notice, also with the check switched off', () => {
    const r = runDevice({ ...ABBOTT_OK, tachy_therapy: 'deaktiviert' });
    const off = applyHintSettings(r.ev, device, ['icd-konsensus']);
    expect(off.warnings.map((w) => w.text)).toEqual(['Hinweis: Die Tachykardie-Therapie ist deaktiviert.']);
  });
  it('switched off: notices and the response field disappear', () => {
    const r = runDevice({ ...ABBOTT_OK, icd_vt_zone: 171 });
    const off = applyHintSettings(r.ev, device, ['icd-konsensus']);
    expect(konsensus(off)).toEqual([]);
    expect(off.visible.has('icd_konsensus_entscheidung')).toBe(false);
    expect(applyHintSettings(r.ev, device, [])).toBe(r.ev);
  });
});
