// Device-Abfrage through the generic engine: DEV-REF highlight bands, D-72 b
// qualifiers, visibility by device type, D-72 c EGM sentences, D-62 warning.
import { describe, expect, it } from 'vitest';
import { formatQualified, parseQualified, readQualified, storeQualified } from '../../src/core/format';
import { RULES } from '../../src/core/rules/registry';
import { classify } from '../../src/core/rules/ruleSet';
import { runDevice } from '../helpers/device';

const normal = (id: string, value: number, ctx: Record<string, string> = {}) =>
  classify(RULES.rules.get(id)!, value, (k) => ctx[k])?.band.normal;

describe('DEV-REF reference bands (Ellenbogen & Kaszala; Asirvatham)', () => {
  it('sensing: highlight below the lower limit only (D-72 f)', () => {
    expect(normal('dev-sensing-ra', 1.5)).toBe(true);
    expect(normal('dev-sensing-ra', 1.4)).toBe(false);
    expect(normal('dev-sensing-ra', 9)).toBe(true);
    expect(normal('dev-sensing-rv', 5)).toBe(true);
    expect(normal('dev-sensing-rv', 4.9)).toBe(false);
    expect(normal('dev-sensing-lv', 3)).toBe(true);
    expect(normal('dev-sensing-lv', 2.9)).toBe(false);
  });
  it.each(['dev-impedance-ra', 'dev-impedance-rv', 'dev-impedance-lv'])('%s 300–1500 Ω', (id) => {
    expect(normal(id, 299)).toBe(false);
    expect(normal(id, 300)).toBe(true);
    expect(normal(id, 1500)).toBe(true);
    expect(normal(id, 1501)).toBe(false);
  });
  it('chronic thresholds: RA/RV above 1.5 V, LV above 2.5 V', () => {
    expect(normal('dev-threshold-ra', 1.5)).toBe(true);
    expect(normal('dev-threshold-ra', 1.6)).toBe(false);
    expect(normal('dev-threshold-rv', 0.3)).toBe(true);
    expect(normal('dev-threshold-rv', 1.75)).toBe(false);
    expect(normal('dev-threshold-lv', 2.5)).toBe(true);
    expect(normal('dev-threshold-lv', 2.6)).toBe(false);
  });
  it('shock impedance: transvenous 25–100 Ω, S-ICD 25–110 Ω', () => {
    expect(normal('dev-shock-impedance', 105, { device_type: 'VVI-ICD' })).toBe(false);
    expect(normal('dev-shock-impedance', 105, { device_type: 'S-ICD' })).toBe(true);
    expect(normal('dev-shock-impedance', 24, { device_type: 'CRT-D' })).toBe(false);
    expect(normal('dev-shock-impedance', 100, { device_type: 'DDD-ICD' })).toBe(true);
    expect(normal('dev-shock-impedance', 111, { device_type: 'S-ICD' })).toBe(false);
    expect(normal('dev-shock-impedance', 60)).toBeUndefined(); // no device type: no highlight
  });
  it('charge time > 15 s and BiV pacing < 98 % (Asirvatham 2021)', () => {
    expect(normal('dev-charge-time', 15)).toBe(true);
    expect(normal('dev-charge-time', 15.1)).toBe(false);
    expect(normal('dev-biv-pacing', 98)).toBe(true);
    expect(normal('dev-biv-pacing', 97.9)).toBe(false);
  });
});

describe('qualified values (D-72 b)', () => {
  it.each([
    ['> 2,8', { q: '>', a: 2.8 }, '>2.8', '> 2,8'],
    ['<200', { q: '<', a: 200 }, '<200', '< 200'],
    ['5,6 - 22,4', { q: 'range', a: 5.6, b: 22.4 }, '5.6..22.4', '5,6–22,4'],
    ['5.6 to 22.4', { q: 'range', a: 5.6, b: 22.4 }, '5.6..22.4', '5,6–22,4'],
    ['5,6 bis 22,4', { q: 'range', a: 5.6, b: 22.4 }, '5.6..22.4', '5,6–22,4'],
    ['12', { q: null, a: 12 }, 12, '12'],
  ])('%s', (input, parsed, stored, shown) => {
    const q = parseQualified(input)!;
    expect(q).toEqual(parsed);
    expect(storeQualified(q)).toEqual(stored);
    expect(formatQualified(readQualified(stored)!, 1)).toBe(shown);
  });
  it.each(['22,4 - 5,6', '>', 'abc', '-3', '>> 2'])('rejects %s', (input) => expect(parseQualified(input)).toBeNull());
  it('checks use the number after > / < or the lower end of a range', () => {
    const { ev, text } = runDevice({ device_type: 'DDD-SM', sensing_rv: '4.2..12', sensing_ra: '>1' });
    expect(ev.values.get('sensing_rv')).toBe(4.2);
    expect([...ev.outOfRange].sort()).toEqual(['sensing_ra', 'sensing_rv']);
    expect(text).toContain('Wahrnehmung: RA > 1 mV / RV 4,2–12 mV.');
  });
});

describe('visibility by device type', () => {
  const visible = (type: string | null) => runDevice(type ? { device_type: type } : {}).ev.visible;
  it('single-chamber pacemaker: no RA fields, no ICD/CRT section', () => {
    const v = visible('VVI-SM');
    expect(v.has('sensing_rv')).toBe(true);
    expect(v.has('sensing_ra')).toBe(false);
    expect(v.has('icd_shock_impedance')).toBe(false);
    expect(v.has('crt_lv_impedance')).toBe(false);
  });
  it('S-ICD: no lead fields, no ATP, shocks and shock impedance shown', () => {
    const v = visible('S-ICD');
    expect(v.has('sensing_rv')).toBe(false);
    expect(v.has('pacing_mode')).toBe(false);
    expect(v.has('atp_count')).toBe(false);
    expect(v.has('shock_count')).toBe(true);
    expect(v.has('icd_shock_impedance')).toBe(true);
  });
  it('CRT-D: ICD and CRT sections', () => {
    const v = visible('CRT-D');
    expect(v.has('crt_lv_threshold_v')).toBe(true);
    expect(v.has('icd_vt_zone')).toBe(true);
    expect(v.has('atp_count')).toBe(true);
  });
  it('no type yet: lead fields shown, ICD/CRT hidden', () => {
    const v = visible(null);
    expect(v.has('sensing_ra')).toBe(true);
    expect(v.has('icd_vt_zone')).toBe(false);
  });
  it('hidden values never reach the report', () => {
    expect(runDevice({ device_type: 'VVI-SM', sensing_ra: 2, sensing_rv: 9 }).text).toContain('Wahrnehmung: RV 9 mV.');
  });
});

describe('episodes and EGM sentences (D-60, D-72 c)', () => {
  it('up to 5 episodes: one sentence per episode', () => {
    const r = runDevice({ at_af_episodes: 1, vt_vf_episodes: 1, egm_1: 'Vorhofflimmern', egm_2: 'eine SVT mit Schenkelblock' });
    expect(r.ev.derived.get('episodes_total')).toBe(2);
    expect(r.text).toContain('Nach Sichtung des EGMs handelt es sich am ehesten um Vorhofflimmern. Nach Sichtung des EGMs handelt es sich am ehesten um eine SVT mit Schenkelblock.');
    expect(r.ev.visible.has('egm_3')).toBe(false);
  });
  it('more than 5: one general sentence plus free text', () => {
    const r = runDevice({ at_af_episodes: 6, egm_1: 'x', egm_alle: 'Vorhofflimmern', egm_zusatz: 'Eine Episode: Sinustachykardie.' });
    expect(r.text).toContain('Nach Sichtung der EGMs handelt es sich am ehesten um Vorhofflimmern. Eine Episode: Sinustachykardie.');
    expect(r.text).not.toContain('des EGMs'); // egm_1 hidden
  });
  it('zero episodes', () => {
    expect(runDevice({ at_af_episodes: 0, vt_vf_episodes: 0 }).text).toContain('Keine AT/AF-Episoden. Keine VT/VF-Episoden.');
  });
});

describe('conclusion (D-62) and empty is safe', () => {
  it('no conclusion without a physician selection', () => {
    const { text } = runDevice({ device_type: 'DDD-SM', sensing_rv: 10, impedance_rv: 600 });
    expect(text).not.toMatch(/Regelrechte|Zusammenfassung/);
  });
  it('warning (no block) when "regelrecht" meets a highlighted value', () => {
    const r = runDevice({ device_type: 'DDD-SM', sensing_rv: 3, conclusion: 'Regelrechte Aggregat- und Sondenfunktion' });
    expect(r.ev.warnings.map((w) => w.text).join()).toMatch(/außerhalb des Referenzbereichs/);
    expect(r.text).toContain('Regelrechte Aggregat- und Sondenfunktion.');
    expect(r.text).not.toContain('Hinweis');
  });
  it('no warning when all values are inside the reference ranges', () => {
    expect(runDevice({ device_type: 'DDD-SM', sensing_rv: 9, conclusion: 'Regelrechte Aggregat- und Sondenfunktion' }).ev.warnings).toEqual([]);
  });
  it('patient sentence follows the sex; none without it (D-40)', () => {
    const v = { patient_condition: 'berichtet über Schwindel' };
    expect(runDevice(v, 'weiblich').text).toContain('Die Patientin berichtet über Schwindel.');
    expect(runDevice(v, 'männlich').text).toContain('Der Patient berichtet über Schwindel.');
    expect(runDevice(v, null).text).not.toContain('berichtet');
  });
  it('follow-up is a plain fact, only when filled (D-63)', () => {
    expect(runDevice({}).text).not.toContain('Kontrolle');
    expect(runDevice({ next_follow_up: 'in 6 Monaten' }).text).toContain('Nächste Kontrolle: in 6 Monaten.');
  });
  it('free text ending with a period gets no second period', () => {
    expect(runDevice({ reprogramming: 'Modus DDD.' }).text).toContain('Folgende Umprogrammierung wurde vorgenommen: Modus DDD.\n');
  });
  it('serial number is stored but not printed', () => {
    expect(runDevice({ device_type: 'VVI-SM', device_serial: 'ABC123' }).text).not.toContain('ABC123');
  });
});
