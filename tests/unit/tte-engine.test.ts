// Behaviour of the TTE schema through the generic engine: D-18 (empty → no
// text), D-15 pre-selection, TTE-R20 HFpEF, TTE-R30, TTE-P, sentence edits.
import { describe, expect, it } from 'vitest';
import { line, run } from '../helpers/tte';

const HF = { rhythm: 'Sinusrhythmus', lvef: 60, lvmi: 90, rwt: 0.4, laesvi: 30, e_e_prime: 8 };

describe('empty is safe (D-18)', () => {
  it('an empty study produces only the title', () => {
    expect(run({}).text).toBe('Transthorakale Echokardiographie:\n');
  });
  it('no normal sentence without an entered value', () => {
    const { text } = run({ lvef: 60 });
    expect(text).not.toMatch(/Perikarderguss|Aortenklappe|Vorhof|pulmonale Hypertonie/);
  });
  it('"nicht beurteilbar" writes an explicit sentence', () => {
    expect(line(run({ ak_stenose: 'nicht beurteilbar' }).model, 'ak')).toBe('Stenose: nicht beurteilbar.');
    expect(line(run({ pk_funktion: 'nicht beurteilbar' }).model, 'pk')).toBe('Die Pulmonalklappe ist nicht beurteilbar.');
  });
  it('hidden fields never contribute text', () => {
    // AI details are entered, then the grade is lowered: details are hidden and ignored.
    const { model } = run({ ak_insuffizienz: 'leichte', ak_pht: 300, ak_jet: 'klein zentral' });
    expect(line(model, 'ak')).toBe('Es besteht eine leichte Aortenklappeninsuffizienz.');
  });
  it('sex missing → no sex-dependent category', () => {
    const { model } = run({ lvef: 45, lvedd: 70 }, null);
    expect(line(model, 'lv')).toBe('');
  });
});

describe('pre-selection from measurements (D-15)', () => {
  it('auto category, overridden by the physician', () => {
    expect(run({ lvedd: 61 }).ev.values.get('lvedd_dim')).toBe('leicht dilatiert');
    const r = run({ lvedd: 61, lvedd_dim: 'normal dimensioniert' });
    expect(r.ev.values.get('lvedd_dim')).toBe('normal dimensioniert');
    expect(r.ev.suggestions.get('lvedd_dim')).toBe('leicht dilatiert');
  });
  it('"Alles normal" presets give way to a computed category', () => {
    const r = run({ lvedd: 61, lvedd_dim: 'normal dimensioniert' }, 'männlich', { presets: ['lvedd_dim'] });
    expect(r.ev.values.get('lvedd_dim')).toBe('leicht dilatiert');
  });
  it('explicitly emptied select stops the pre-selection', () => {
    expect(run({ lvedd: 61, lvedd_dim: null }).ev.values.has('lvedd_dim')).toBe(false);
  });
  it('out-of-range highlight is neutral and does not block', () => {
    const r = run({ tapse: 15, lvef: 30 });
    expect([...r.ev.outOfRange].sort()).toEqual(['lvef', 'tapse']);
  });
});

describe('TTE-R30 sentences', () => {
  it('R30-4b one part per wall', () => {
    expect(line(run({ ivsd: 12, pwd: 9 }).model, 'lv')).toBe('Das Septum ist leicht hypertrophiert, die Hinterwand ist normwertig.');
    expect(line(run({ pwd: 15 }).model, 'lv')).toBe('Die Hinterwand ist mittelgradig hypertrophiert.');
  });
  it('R30-6 RVD1/RVD2 only when RV Länge is dilated', () => {
    expect(line(run({ rv: 34, rvd1: 44, rvd2: 30 }).model, 'vorhoefe')).toBe(
      'Der rechte Ventrikel ist dilatiert (RVD1 44 mm, dilatiert; RVD2 30 mm, normwertig).',
    );
    expect(line(run({ rv: 28, rvd1: 44 }).model, 'vorhoefe')).toBe('Der rechte Ventrikel ist normwertig.');
  });
  it('R30-7 RV function needs TAPSE and TASV; TASV decides', () => {
    const rvf = (v: Record<string, number>) => line(run(v).model, 'vorhoefe');
    expect(rvf({ tapse: 14, tasv: 10 })).toBe('Die rechtsventrikuläre systolische Funktion ist normal.');
    expect(rvf({ tapse: 20, tasv: 8 })).toBe('Die rechtsventrikuläre systolische Funktion ist eingeschränkt.');
    expect(rvf({ tasv: 8 })).toBe('');
  });
  it('R30-8 VCI sentence variants', () => {
    const vci = (v: Record<string, string | number>) => line(run(v).model, 'aorta');
    expect(vci({ vci: 18, vci_kollaps: '> 50 %' })).toBe('Die V. cava inferior ist normalkalibrig (18 mm) mit atemabhängiger Kaliberschwankung > 50 %.');
    expect(vci({ vci: 24 })).toBe('Die V. cava inferior ist dilatiert (24 mm).');
    expect(vci({ vci_kollaps: '< 50 %' })).toBe('Die V. cava inferior zeigt eine atemabhängige Kaliberschwankung < 50 %.');
  });
});

describe('TTE-R20 HFpEF (count line and conclusion)', () => {
  const lv = (v: Record<string, string | number>, sex: 'männlich' | 'weiblich' = 'männlich') => line(run(v, sex).model, 'lv');
  it('0 criteria → kein Hinweis', () => {
    expect(lv(HF)).toContain('0 von 4 Kriterien für eine HFpEF sind erfüllt. Kein Hinweis auf eine HFpEF.');
  });
  it('criterion fulfilled, peptide elevated → HFpEF', () => {
    expect(lv({ ...HF, e_e_prime: 12, nt_probnp: 300 })).toContain('1 von 4 Kriterien für eine HFpEF sind erfüllt. Hinweis auf eine HFpEF.');
  });
  it('criterion fulfilled, peptide not elevated or not entered → diastolische Dysfunktion', () => {
    expect(lv({ ...HF, e_e_prime: 12, nt_probnp: 200 })).toContain('Hinweis auf eine diastolische Dysfunktion.');
    expect(lv({ ...HF, e_e_prime: 12 })).toContain('Hinweis auf eine diastolische Dysfunktion.');
  });
  it('AF cut-offs apply to Vorhofflattern', () => {
    expect(lv({ ...HF, rhythm: 'Vorhofflattern', laesvi: 38, nt_probnp: 600 })).toContain('0 von 4 Kriterien');
    expect(lv({ ...HF, rhythm: 'Vorhofflattern', laesvi: 41, nt_probnp: 700 })).toContain('Hinweis auf eine HFpEF.');
  });
  it('OR criteria count once', () => {
    expect(lv({ ...HF, lvmi: 120, rwt: 0.5 })).toContain('1 von 4 Kriterien');
    expect(lv({ ...HF, lvmi: 120, rwt: 0.5, laesvi: 40, e_e_prime: 10, rvsp: 40 })).toContain('4 von 4 Kriterien');
  });
  it('fewer than 4 of the 6 measurements → no HFpEF text', () => {
    expect(lv({ rhythm: 'Sinusrhythmus', lvef: 60, lvmi: 120, rwt: 0.5, laesvi: 40 })).not.toContain('HFpEF');
  });
  it('AV-Block III → no HFpEF text', () => {
    expect(lv({ ...HF, rhythm: 'AV-Block III' })).not.toMatch(/HFpEF|Dysfunktion/);
  });
  it('LVEF < 50 % or not entered → count line only', () => {
    const t = lv({ ...HF, lvef: 45, e_e_prime: 12 });
    expect(t).toContain('1 von 4 Kriterien');
    expect(t).not.toMatch(/Hinweis auf eine/);
    const { lvef: _l, ...noLvef } = HF;
    expect(lv(noLvef)).toContain('0 von 4');
    expect(lv(noLvef)).not.toContain('Kein Hinweis');
  });
  it('rhythm unknown while LAVI entered → no HFpEF text (empty is safe)', () => {
    const { rhythm: _r, ...noRhythm } = HF;
    expect(lv(noRhythm)).not.toContain('HFpEF');
  });
  it('sex unknown while LVMI entered → no HFpEF text', () => {
    expect(line(run(HF, null).model, 'lv')).not.toContain('HFpEF');
  });
});

describe('valves', () => {
  it('prosthesis sentence (TTE-P, D-70 a)', () => {
    const { model } = run({
      ak_prothese: 'Ja', ak_prothese_typ: 'Edwards Magna 23 mm', ak_prothese_funktion: 'regelrecht',
      ak_vmax: 2.4, ak_dp_max: 23, ak_dp_mean: 12,
    });
    expect(line(model, 'ak')).toBe('Prothese Typ Edwards Magna 23 mm, in loco typico und fest sitzend, regelrecht (Vmax 2,4 m/s; dp max/mean 23/12 mmHg).');
    expect(line(run({ mk_prothese: 'Ja' }).model, 'mk')).toBe('Prothese, in loco typico und fest sitzend.');
  });
  it('stenosis measurements only when the lesion is present (TTE-M)', () => {
    expect(line(run({ ak_stenose: 'keine', ak_insuffizienz: 'keine', ak_vmax: 1.2 }).model, 'ak')).toBe(
      'Hämodynamisch zeigt sich keine relevante Pathologie.',
    );
    expect(line(run({ ak_stenose: 'hochgradige', ak_dp_mean: 45 }).model, 'ak')).toBe('Es liegt eine hochgradige Aortenstenose vor (dp mean 45 mmHg).');
  });
  it('summary uses ° grades incl. intermediate grades (D-69 a)', () => {
    const { model } = run({ mk_insuffizienz: 'mittel- bis hochgradige', tk_insuffizienz: 'massive', ak_stenose: 'leichtgradige', ak_aoef: 1.6 });
    expect(line(model, 'zusammenfassung')).toBe('MI II–III°, TI IV°, AS I°, AÖF 1,6 cm².');
  });
});

describe('sentence edits (CLAUDE.md rule 6)', () => {
  const base = { perikarderguss: 'kein Perikarderguss' };
  it('the physician edit wins', () => {
    const r = run(base, 'männlich', { overrides: { 'ao.perikard': { text: 'Kein Erguss.', basis: 'Kein Perikarderguss.' } } });
    expect(line(r.model, 'aorta')).toBe('Kein Erguss.');
    expect(r.model.body.flatMap((s) => s.lines).find((l) => l.id === 'aorta')!.sentences[0]!.stale).toBe(false);
  });
  it('an edit stays when the generated text changes, flagged as stale', () => {
    const r = run({ perikarderguss: 'geringer Perikarderguss' }, 'männlich', {
      overrides: { 'ao.perikard': { text: 'Kein Erguss.', basis: 'Kein Perikarderguss.' } },
    });
    const s = r.model.body.flatMap((x) => x.lines).find((l) => l.id === 'aorta')!.sentences[0]!;
    expect(s.text).toBe('Kein Erguss.');
    expect(s.stale).toBe(true);
    expect(s.generated).toBe('Es zeigt sich ein geringer Perikarderguss.');
  });
  it('removed sentences are not in the text; HFpEF sentence is removable', () => {
    const r = run({ ...HF, e_e_prime: 12 }, 'männlich', {
      overrides: { 'lv.hfpef.schluss': { text: '', basis: 'Hinweis auf eine diastolische Dysfunktion.' } },
    });
    expect(line(r.model, 'lv')).not.toContain('diastolische Dysfunktion');
    expect(line(r.model, 'lv')).toContain('1 von 4 Kriterien');
  });
  it('free text is appended to its line', () => {
    expect(line(run(base, 'männlich', { extras: { aorta: 'Pleuraerguss rechts.' } }).model, 'aorta')).toBe(
      'Kein Perikarderguss. Pleuraerguss rechts.',
    );
  });
  it('library blocks appear only when inserted', () => {
    expect(run(base).text).not.toContain('Empfehlung');
    const r = run(base, 'männlich', { blocks: [{ id: 'LIB-HI-01', text: 'Block.' }] });
    expect(r.text).toContain('Empfehlung:\nBlock.');
  });
});

describe('footer', () => {
  it('names the rule sets that produced text', () => {
    const ids = run({ lvef: 60, tapse: 15, tk_vc: 5 }).model.rulesUsed.map((r) => r.id);
    expect(ids).toEqual(['tte-lvef']); // reference ranges and criteria tables only highlight
  });
});

describe('stored data', () => {
  it('a bad entry is dropped, the rest is kept', async () => {
    const { parseStudyData } = await import('../../src/core/studyData');
    const d = parseStudyData({ values: { lvef: 55, bad: { x: 1 }, lvedd: Infinity }, overrides: 'broken' });
    expect(d.values).toEqual({ lvef: 55 });
    expect(d.overrides).toEqual({});
  });
});
