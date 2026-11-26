// Module 2: Device-Abfrage (1-/2-/3-Kammer-Schrittmacher, 1-/2-/3-Kammer-ICD, S-ICD; D-84).
// Data only. Clinical content follows spec/SPEC-modules.md (Modul 2),
// spec/SPEC-textgen.md (DEV-T, DEV-REF, DEV-EP, LIB-DEV-01) and decisions
// D-55 … D-64, D-72 b/c/f, D-74 d. The prototype's automatic "Regelrechte …"
// texts are removed (F-01, CLAUDE.md rule 5): the conclusion is physician-
// selected (D-62). Details drafted in M3 await review: SPEC-decisions D-75.
import type { Cond } from '../core/conditions';
import { NB, type ModuleSchema } from '../core/schema';

// D-84: device types by chamber count, independent of the programmed mode; "gen" is the genitive
// for "Z. n. Implantation eines …" (S-ICD wording DRAFT).
const DEVICE_TYPE_OPTIONS = [
  { value: '1-Kammer-Schrittmacher', forms: { gen: '1-Kammer-Schrittmachers' } },
  { value: '2-Kammer-Schrittmacher', forms: { gen: '2-Kammer-Schrittmachers' } },
  { value: '1-Kammer-ICD', forms: { gen: '1-Kammer-ICD' } },
  { value: '2-Kammer-ICD', forms: { gen: '2-Kammer-ICD' } },
  { value: '3-Kammer-Schrittmacher', forms: { gen: '3-Kammer-Schrittmachers' } },
  { value: '3-Kammer-ICD', forms: { gen: '3-Kammer-ICD' } },
  { value: 'S-ICD', forms: { gen: 'subkutanen ICD' } },
];
const DEVICE_TYPES = DEVICE_TYPE_OPTIONS.map((o) => o.value);
const PACEMAKER = ['1-Kammer-Schrittmacher', '2-Kammer-Schrittmacher'];
const WITH_RA = ['2-Kammer-Schrittmacher', '2-Kammer-ICD', '3-Kammer-Schrittmacher', '3-Kammer-ICD'];
const WITH_LEADS = DEVICE_TYPES.filter((t) => t !== 'S-ICD');
const ICD = ['1-Kammer-ICD', '2-Kammer-ICD', '3-Kammer-ICD', 'S-ICD'];
const ICD_ATP = ['1-Kammer-ICD', '2-Kammer-ICD', '3-Kammer-ICD'];
const CRT = ['3-Kammer-Schrittmacher', '3-Kammer-ICD'];

/** Shown for these device types, and while no device type is entered. */
const forTypes = (types: string[]): Cond => ({ any: [{ empty: 'device_type' }, { in: ['device_type', types] }] });
/** Shown only for these device types. */
const onlyTypes = (types: string[]): Cond => ({ in: ['device_type', types] });

const REGELRECHT = 'Regelrechte Aggregat- und Sondenfunktion';
const MAX_EGM = 5; // D-72 c

const egmFields = Array.from({ length: MAX_EGM }, (_, i) => ({
  key: `egm_${i + 1}`,
  label: `EGM Episode ${i + 1}: am ehesten`,
  type: 'text' as const,
  visibleIf: { all: [{ gte: ['episodes_total', i + 1] }, { lte: ['episodes_total', MAX_EGM] }] } as Cond,
}));

// Document extraction (D-79, verified on Vitatron and Medtronic printouts). Final-report
// pages win over the initial interrogation (physician decision D-80); sensing is taken from
// the in-office test, printed as a range or with ">" (D-72 b).
// "Testergebnisse": Biotronik follow-up and Abbott test results (A/V columns), D-83.
const A_THRESHOLD = ['A. Output Management', 'A. Capture', 'Testergebnisse'];
const V_THRESHOLD = ['V. Output Management', 'V. Capture', 'Testergebnisse'];
const EXTRACTION = {
  preferPages: ['Final Report', 'Abschlussbericht', 'Nachsorge', 'Wrap-up™ Report', 'Wrap-up Report'],
  sections: [
    ...A_THRESHOLD,
    ...V_THRESHOLD,
    'Atrial Sensing Threshold', 'Atriale Wahrnehmungsschwelle', 'Ventricular Sensing Threshold', 'Ventrikuläre Wahrnehmungsschwelle',
    'Testergebnisse',
    'Sensing Assurance', 'In-Office Threshold Test Results', 'Bei der Schrittmacherkontrolle', 'Lead Status', 'Elektrodenstatus',
    'Pacemaker Status', 'Schrittmacherstatus',
  ],
  columns: [
    'Atrial Lead', 'Ventricular Lead', 'Atrial', 'Ventricular', 'A. Elektrode', 'V. Elektrode', 'Ventrikulär',
    'Initial', 'Final', 'Endgültig', 'Anfänglich', 'Letzte', 'Vorher', 'Aktuell',
    'Aggregat', 'Hersteller', 'Modell', 'Impl.datum',
    'A', 'V', 'Reizschw.', 'Signalamplitude', 'Elektrodenimpedanz', 'VT-1', 'VT-2', 'VF',
  ],
};

// ---- Rules for choice, text and date fields (D-83, DRAFT for physician review) ----
// Built from the Vitatron, Medtronic, Biotronik and Abbott samples. Every value still
// enters unconfirmed with its source; a text that matches no rule is discarded.

/** The model line or cell: "Pacemaker Model: Vitatron G70A2 DR" (Vitatron), "Schrittmachermodell: Medtronic
 * Adapta L ADDRL1" (Medtronic), "Implantat: Effecta DR" (Biotronik), table row "ICD | Abbott | Ellipse™ VR 1377-36QC" (Abbott). */
const MODEL_LABELS = ['Pacemaker Model', 'Schrittmachermodell', 'Implantat', 'ICD'];
/** A serial number printed after the model is never taken along (gateway §2.6.4). */
const SERIAL_STOP = ['Serial', 'Seriennummer', 'S/N', 'SN:'];
/** Biotronik pacemaker families (brand names; ICDs have other names). */
const BIOTRONIK_SM = '(Effecta|Enitra|Edora|Evity|Eluna|Etrinsa|Enticos|Amvia)';

const DEVICE_TYPE_RULES: [string, string][] = [
  ['^Pacemaker Model .*\\bDR\\b', '2-Kammer-Schrittmacher'],
  ['^Pacemaker Model .*\\bSR\\b', '1-Kammer-Schrittmacher'],
  ['^Schrittmachermodell .*\\b[A-Z]*DR[A-Z]*\\d*\\b', '2-Kammer-Schrittmacher'], // Medtronic model code, e.g. ADDRL1
  ['^Schrittmachermodell .*\\b[A-Z]*SR[A-Z]*\\d*\\b', '1-Kammer-Schrittmacher'],
  [`^Implantat .*\\b${BIOTRONIK_SM}\\b.*\\bDR`, '2-Kammer-Schrittmacher'],
  [`^Implantat .*\\b${BIOTRONIK_SM}\\b.*\\bSR`, '1-Kammer-Schrittmacher'],
  ['^ICD .*\\bVR\\b', '1-Kammer-ICD'],
  ['^ICD .*\\bDR\\b', '2-Kammer-ICD'],
];

const MODE_RULES: [string, string][] = [
  ['^AAIR\\s*(<=>|<->|<>|-|–)\\s*DDDR$', 'AAIR-DDDR'],
  ...['DDDR', 'DDD', 'DDIR', 'DDI', 'VVIR', 'VVI', 'AAIR', 'AAI', 'VDD'].map((m): [string, string] => [`^${m}$`, m]),
];

/** Printed indication → choice. Order matters: the first matching rule wins. */
const INDICATION_RULES: [string, string][] = [
  ['Kammerflimmern|\\bVF\\b', 'Z.n. Kammerflimmern'],
  ['AV[- ]?Block\\s*(III|3)', 'AV-Block III°'],
  ['Mobitz|AV[- ]?Block\\s*(II|2)\\b', 'AV-Block II° Mobitz'],
  ['Brady[- ]?Tachy|Tachy[- ]?Brady', 'Tachy-Brady-Syndrom'],
  ['\\bSSS\\b|Sick[- ]?Sinus|Sinusknoten|SA[- ](Exit[- ])?Block', 'Sick-Sinus-Syndrom'],
];

// ---- ICD detection zones and the consensus programming check (D-84) -------------------
// Source: Stiles MK, Fauchier L, Morillo CA, Wilkoff BL. 2019 HRS/EHRA/APHRS/LAHRS focused update to
// 2015 expert consensus statement on optimal implantable cardioverter-defibrillator programming and
// testing. Europace 2019;21:1442–1443 (manufacturer-specific translations 1443a–e). doi:10.1093/europace/euz065
// Neutral notices on screen only, never in the report (CLAUDE.md exception 2); switchable in the settings.
const KONSENSUS_GROUP = 'icd-konsensus';
const KONSENSUS_SOURCE = 'Stiles et al. 2019';
type Company = 'Medtronic' | 'Abbott' | 'Biotronik' | 'Boston Scientific' | 'Microport';
const COMPANIES: Company[] = ['Medtronic', 'Abbott', 'Biotronik', 'Boston Scientific', 'Microport'];
const isCompany = (c: Company): Cond => ({ eq: ['device_company', c] });

/** Zone names as printed by each manufacturer (slowest zone first). */
const ZONE1: Partial<Record<Company, string>> = { Medtronic: 'VT Monitor', Abbott: 'VT-1', Biotronik: 'VT1', 'Boston Scientific': 'VT-1', Microport: 'Slow VT' };
const ZONE2: Partial<Record<Company, string>> = { Medtronic: 'VT', Abbott: 'VT-2', Biotronik: 'VT2', 'Boston Scientific': 'VT', Microport: 'VT' };
const ZONE3: Partial<Record<Company, string>> = { Medtronic: 'FVT', Microport: 'FVT' };
const ZONE4: Partial<Record<Company, string>> = { Medtronic: 'VF', Abbott: 'VF', Biotronik: 'VF', 'Boston Scientific': 'VF', Microport: 'VF' };
/** How each manufacturer counts detection (number entered: intervals, seconds or cycles). */
const DETECTION: Record<Company, string> = {
  Medtronic: 'Erkennung (Intervalle, erste Zahl von x/y)',
  Abbott: 'Erkennung (Intervalle)',
  Biotronik: 'Erkennung (Intervalle, erste Zahl von x/y)',
  'Boston Scientific': 'Erkennung (s)',
  Microport: 'Erkennung (Zyklen)',
};
const S_ICD_ZONE: Record<number, string> = { 3: 'Bedingte Schockzone', 4: 'Schockzone' };
const BPM_UNITS = [{ unit: 'min-1', factor: 1 }, { unit: 'min⁻¹', factor: 1 }, { unit: '/min', factor: 1 }];

function zoneFields(
  n: 1 | 2 | 3 | 4,
  names: Partial<Record<Company, string>>,
  types: string[],
  o: { rateKey: string; detKey: string; column: readonly string[]; visibleIf?: Cond },
) {
  const visible: Cond = o.visibleIf ? { all: [onlyTypes(types), o.visibleIf] } : onlyTypes(types);
  const fallback = n === 4 ? 'VF' : `Zone ${n}`;
  const sIcd = S_ICD_ZONE[n] ? [{ when: { eq: ['device_type', 'S-ICD'] } as Cond, label: `${S_ICD_ZONE[n]}: Frequenz` }] : [];
  return [
    {
      key: o.rateKey,
      label: `${fallback}: Frequenz`,
      labelWhen: [...sIcd, ...COMPANIES.filter((c) => names[c]).map((c) => ({ when: isCompany(c), label: `${names[c]}: Frequenz` }))],
      type: 'number' as const,
      unit: 'bpm',
      decimals: 0,
      qualified: true,
      visibleIf: visible,
      extractable: true,
      // Abbott Wrap-up: "Detektionsparameter | 171 min-1 | 187 min-1 | 240 min-1" under VT-1 / VT-2 / VF.
      extraction: { labels: ['Detektionsparameter'], column: o.column, unit: 'bpm', alternatives: BPM_UNITS, pattern: '^(\\d+)\\s*min', range: [100, 300] as const },
    },
    {
      key: o.detKey,
      label: `${fallback}: Erkennung`,
      labelWhen: COMPANIES.filter((c) => names[c]).map((c) => ({ when: isCompany(c), label: `${names[c]}: ${DETECTION[c]}` })),
      type: 'number' as const,
      unit: '',
      decimals: 1,
      visibleIf: { all: [visible, { not: { eq: ['device_type', 'S-ICD'] } }] } as Cond,
      extractable: true,
      // Abbott parameter page: "171 min-1/350 ms 40 Intervalle".
      extraction: { labels: ['Detektionsparameter'], column: o.column, unit: '', unitOptional: true, pattern: '(\\d+)\\s*Intervalle', range: [1, 100] as const },
    },
  ];
}

/** "Z. n. Implantation eines <type> (<company> <model>) am <date> bei <indication>." (D-84) */
function implantation(type: string, indication: string | null) {
  return [
    `Z. n. Implantation eines ${type}`,
    { join: ' ', before: ' (', after: ')', items: ['{device_company}', '{device_model}'] },
    '[ am {implantation_date}]',
    indication ? `[ bei ${indication}]` : '',
    '.',
  ];
}

/** Report zones per manufacturer, slowest first; detection count with its unit (D-84, wording DRAFT). */
const ZONE_KEYS = [
  { n: 1, rate: 'icd_z1_rate', det: 'icd_z1_det', names: ZONE1 },
  { n: 2, rate: 'icd_vt_zone', det: 'icd_z2_det', names: ZONE2 },
  { n: 3, rate: 'icd_z3_rate', det: 'icd_z3_det', names: ZONE3 },
  { n: 4, rate: 'icd_vf_zone', det: 'icd_z4_det', names: ZONE4 },
] as const;
const DETECTION_UNIT: Record<Company, string> = { Medtronic: 'Intervalle', Abbott: 'Intervalle', Biotronik: 'Intervalle', 'Boston Scientific': 's', Microport: 'Zyklen' };
const zoneLine = (items: (string | string[])[]) => [{ join: ' / ', before: 'Detektionszonen: ', items }];
const ZONE_REPORT = [
  {
    id: 's-icd',
    when: { eq: ['device_type', 'S-ICD'] } as Cond,
    text: zoneLine(ZONE_KEYS.filter((z) => S_ICD_ZONE[z.n]).map((z) => `${S_ICD_ZONE[z.n]} {${z.rate}} bpm`)),
  },
  ...COMPANIES.map((c) => ({
    id: c.toLowerCase().replace(/\s+/g, '-'),
    when: isCompany(c),
    text: zoneLine(
      ZONE_KEYS.filter((z) => z.names[c]).map((z) => [`${z.names[c]} {${z.rate}} bpm ({${z.det}} ${DETECTION_UNIT[c]})`, `${z.names[c]} {${z.rate}} bpm`]),
    ),
  })),
  {
    id: 'ohne-hersteller',
    text: zoneLine(ZONE_KEYS.map((z) => `${z.n === 4 ? 'VF' : `Zone ${z.n}`} {${z.rate}} bpm`)),
  },
];

const transvenous = onlyTypes(ICD_ATP);
const NO_VT: Cond = { eq: ['vt_history', 'keine VT bekannt'] };
const KNOWN_VT: Cond = { eq: ['vt_history', 'VT bekannt'] };
const oneOf = (key: string, vals: readonly number[]): Cond => ({ any: vals.map((v) => ({ eq: [key, v] }) as Cond) });
/** Filled and not one of the recommended values. */
const notOneOf = (key: string, vals: readonly number[]): Cond => ({ all: [{ filled: key }, { not: oneOf(key, vals) }] });
/** The zone lies 10–20 bpm below the known VT rate (derived difference). */
const belowVt = (diffKey: string): Cond => ({ all: [{ gte: [diffKey, 10] }, { lte: [diffKey, 20] }] });
const filled = (key: string): Cond => ({ filled: key });
const atpOff: Cond = { eq: ['icd_vf_atp', 'aus'] };

interface Check {
  label: string;
  when: Cond;
}
function checks(company: Company, history: 'keine VT bekannt' | 'VT bekannt', list: [string, Cond][]): Check[] {
  const base: Cond[] = [isCompany(company), transvenous, history === 'VT bekannt' ? KNOWN_VT : NO_VT];
  return list.map(([text, cond]) => ({
    label: `Abweichung vom Konsensus-Vorschlag (${KONSENSUS_SOURCE}, ${company}, ${history}): ${text}.`,
    when: { all: [...base, cond] },
  }));
}

const VF = 'icd_vf_zone';
const VF_DET = 'icd_z4_det';
const Z2 = 'icd_vt_zone';
const Z2_DET = 'icd_z2_det';
const Z3 = 'icd_z3_rate';
const Z3_DET = 'icd_z3_det';

/** Each entry: the consensus value for one programmed parameter (1443a–e). */
const KONSENSUS_CHECKS: Check[] = [
  // Abbott (1443a)
  ...checks('Abbott', 'keine VT bekannt', [
    ['VF 240 oder 250 bpm', notOneOf(VF, [240, 250])],
    ['VF-Erkennung 30 Intervalle', notOneOf(VF_DET, [30])],
    ['VT-2 187 bpm', notOneOf(Z2, [187])],
    ['VT-2-Erkennung 30 Intervalle', notOneOf(Z2_DET, [30])],
    ['ATP während des Ladens in der VF-Zone ein', atpOff],
  ]),
  ...checks('Abbott', 'VT bekannt', [
    ['VF 240 oder 250 bpm', notOneOf(VF, [240, 250])],
    ['VF-Erkennung 30 Intervalle', notOneOf(VF_DET, [30])],
    ['VT-2 187 bpm oder 10–20 bpm unter der VT-Frequenz', { all: [notOneOf(Z2, [187]), { not: belowVt('vt_minus_z2') }] }],
    ['VT-2-Erkennung 30 Intervalle', notOneOf(Z2_DET, [30])],
    ['ATP während des Ladens in der VF-Zone ein', atpOff],
  ]),
  // BIOTRONIK (1443b); footnote 1: alternatively VF 250, VT2 231, VT1 188 bpm.
  ...checks('Biotronik', 'keine VT bekannt', [
    ['VF 231 bpm (alternativ 250 bpm)', notOneOf(VF, [231, 250])],
    ['VF-Erkennung 30/40 (sonst 24/30) Intervalle', notOneOf(VF_DET, [30, 24])],
    ['VT2 188 bpm (alternativ 231 bpm)', notOneOf(Z2, [188, 231])],
    ['VT2-Erkennung 30 Intervalle', notOneOf(Z2_DET, [30])],
    ['ATP One-Shot in der VF-Zone ein', atpOff],
  ]),
  ...checks('Biotronik', 'VT bekannt', [
    ['VF 231 bpm', notOneOf(VF, [231])],
    ['VF-Erkennung 24/30 Intervalle', notOneOf(VF_DET, [24])],
    ['VT2 188 bpm oder 10–20 bpm unter der VT-Frequenz', { all: [notOneOf(Z2, [188]), { not: belowVt('vt_minus_z2') }] }],
    ['VT2-Erkennung 30 Intervalle', notOneOf(Z2_DET, [30])],
    ['ATP One-Shot in der VF-Zone ein', atpOff],
  ]),
  // Boston Scientific (1443c): option 1 VF 250 bpm / 5 s with VT 185 bpm / 12 s, option 2 VF 200 bpm / 2.5 s without VT zone.
  ...checks('Boston Scientific', 'keine VT bekannt', [
    ['VF 250 bpm (Option 1) oder 200 bpm (Option 2)', notOneOf(VF, [250, 200])],
    ['VF-Erkennung 5 s bei 250 bpm bzw. 2,5 s bei 200 bpm', { all: [filled(VF_DET), { not: { any: [{ all: [{ eq: [VF, 250] }, { eq: [VF_DET, 5] }] }, { all: [{ eq: [VF, 200] }, { eq: [VF_DET, 2.5] }] }] } }] }],
    ['VT 185 bpm (Option 1); bei Option 2 keine VT-Zone', { all: [filled(Z2), { any: [{ eq: [VF, 200] }, { not: { eq: [Z2, 185] } }] }] }],
    ['VT-Erkennung 12 s', notOneOf(Z2_DET, [12])],
    ['QuickConvert (ATP in der VF-Zone) ein', atpOff],
  ]),
  ...checks('Boston Scientific', 'VT bekannt', [
    ['VF 250 bpm', notOneOf(VF, [250])],
    ['VF-Erkennung 5 s', notOneOf(VF_DET, [5])],
    ['VT 185 bpm oder 10–20 bpm unter der VT-Frequenz', { all: [notOneOf(Z2, [185]), { not: belowVt('vt_minus_z2') }] }],
    ['VT-Erkennung 12 s', notOneOf(Z2_DET, [12])],
    ['QuickConvert (ATP in der VF-Zone) ein', atpOff],
  ]),
  // Medtronic (1443d): FVT off (ATP before charging in the VF zone gives the same function).
  ...checks('Medtronic', 'keine VT bekannt', [
    ['VF 188 bpm', notOneOf(VF, [188])],
    ['VF-Erkennung 30/40 Intervalle', notOneOf(VF_DET, [30])],
    ['FVT aus (ATP vor dem Laden in der VF-Zone)', filled(Z3)],
    ['VT-Zone aus', filled(Z2)],
    ['ATP vor dem Laden in der VF-Zone ein', atpOff],
  ]),
  ...checks('Medtronic', 'VT bekannt', [
    ['VF 188 bpm', notOneOf(VF, [188])],
    ['VF-Erkennung 30/40 Intervalle', notOneOf(VF_DET, [30])],
    ['FVT aus (ATP vor dem Laden in der VF-Zone)', filled(Z3)],
    ['VT 10–20 bpm unter der VT-Frequenz', { all: [filled(Z2), { not: belowVt('vt_minus_z2') }] }],
    ['VT-Erkennung 24 Intervalle', notOneOf(Z2_DET, [24])],
    ['ATP vor dem Laden in der VF-Zone ein', atpOff],
  ]),
  // MicroPort CRM (1443e)
  ...checks('Microport', 'keine VT bekannt', [
    ['VF > 255 bpm', { lt: [VF, 255] }],
    ['VF-Erkennung 20 Zyklen', notOneOf(VF_DET, [20])],
    ['FVT 230 bpm', notOneOf(Z3, [230])],
    ['FVT-Erkennung 20 Zyklen', notOneOf(Z3_DET, [20])],
    ['VT 185 bpm', notOneOf(Z2, [185])],
    ['VT-Erkennung 20 oder 30 Zyklen', notOneOf(Z2_DET, [20, 30])],
  ]),
  ...checks('Microport', 'VT bekannt', [
    ['VF > 255 bpm', { lt: [VF, 255] }],
    ['VF-Erkennung 20 Zyklen', notOneOf(VF_DET, [20])],
    ['FVT 230 bpm', notOneOf(Z3, [230])],
    ['FVT-Erkennung 20 Zyklen', notOneOf(Z3_DET, [20])],
    ['VT 185 bpm oder 10–20 bpm unter der VT-Frequenz', { all: [notOneOf(Z2, [185]), { not: belowVt('vt_minus_z2') }] }],
    ['VT-Erkennung ≥ 20 Zyklen', { lt: [Z2_DET, 20] }],
  ]),
  // Subcutaneous ICD (Boston Scientific, 1443c)
  {
    label: `Abweichung vom Konsensus-Vorschlag (${KONSENSUS_SOURCE}, S-ICD): Schockzone ≥ 230 bpm.`,
    when: { all: [{ eq: ['device_type', 'S-ICD'] }, { lt: [VF, 230] }] },
  },
  {
    label: `Abweichung vom Konsensus-Vorschlag (${KONSENSUS_SOURCE}, S-ICD): bedingte Schockzone ≥ 200 bpm oder 10–20 bpm unter der VT-Frequenz.`,
    when: { all: [{ eq: ['device_type', 'S-ICD'] }, { filled: 'vt_history' }, { lt: [Z3, 200] }, { not: belowVt('vt_minus_z3') }] },
  },
];

export const device: ModuleSchema = {
  key: 'device',
  title: 'Device-Abfrage',
  version: 1,
  extraction: EXTRACTION,
  rules: [
    'dev-sensing-ra', 'dev-sensing-rv', 'dev-sensing-lv', 'dev-impedance-ra', 'dev-impedance-rv', 'dev-impedance-lv',
    'dev-threshold-ra', 'dev-threshold-rv', 'dev-threshold-lv', 'dev-shock-impedance', 'dev-charge-time', 'dev-biv-pacing',
  ],

  // Form order follows the mnemonic workflow without its labels (D-64).
  sections: [
    {
      key: 'geraet',
      title: 'Gerät und Patient',
      fields: [
        { key: 'device_type', label: 'Gerätetyp', type: 'select', allowNb: false, options: DEVICE_TYPE_OPTIONS, extractable: true, extraction: { kind: 'choice', labels: MODEL_LABELS, column: ['Modell'], columnOptional: true, stopAt: SERIAL_STOP, map: DEVICE_TYPE_RULES } },
        {
          key: 'pacing_mode',
          label: 'Programmierter Modus',
          type: 'select',
          allowNb: false,
          options: ['AAI', 'AAIR', 'VVI', 'VVIR', 'DDD', 'DDDR', 'DDI', 'DDIR', 'VDD', 'AAIR-DDDR', 'Andere'], // AAIR-DDDR: D-83
          visibleIf: forTypes(WITH_LEADS),
          extractable: true,
          // Programmed (final) mode: Vitatron "Mode | Initial | Final", Medtronic "Betriebsart | Anfänglich | Letzte",
          // Biotronik "Modus | Vorher | Aktuell", Abbott "Betriebsart VVI".
          extraction: { kind: 'choice', labels: ['Mode', 'Betriebsart', 'Modus'], column: ['Final', 'Letzte', 'Aktuell'], columnOptional: true, mapOn: 'value', map: MODE_RULES },
        },
        { key: 'pacing_mode_text', label: 'Modus (Freitext)', type: 'text', visibleIf: { eq: ['pacing_mode', 'Andere'] } },
        {
          key: 'device_company',
          label: 'Hersteller',
          type: 'select',
          allowNb: false,
          options: ['Medtronic', 'Abbott', 'Vitatron', 'Boston Scientific', 'Biotronik', 'Microport'],
          extractable: true,
          extraction: {
            kind: 'choice',
            labels: [...MODEL_LABELS, 'BIOTRONIK'],
            presence: ['BIOTRONIK'],
            column: ['Hersteller'],
            columnOptional: true,
            stopAt: SERIAL_STOP,
            map: [['\\bVitatron\\b', 'Vitatron'], ['\\bMedtronic\\b', 'Medtronic'], ['\\bBiotronik\\b', 'Biotronik'], ['\\bAbbott\\b', 'Abbott'], ['\\bBoston Scientific\\b', 'Boston Scientific']],
          },
        },
        {
          key: 'device_model',
          label: 'Modell',
          type: 'text',
          extractable: true,
          extraction: { kind: 'text', labels: MODEL_LABELS, column: ['Modell'], columnOptional: true, stopAt: SERIAL_STOP, strip: ['^(Vitatron|Medtronic|Biotronik|Abbott|St\\.? ?Jude( Medical)?|Boston Scientific)\\s+', '™', '®'] },
        },
        {
          key: 'device_serial',
          label: 'Seriennummer',
          type: 'text',
          help: 'Wird nur im ECHTBETRIEB mit lokaler Texterkennung aus dem Dokument gelesen (D-84, Gateway §2.6.4).',
          // D-84: built, but inactive until ECHTBETRIEB with a local provider (no cloud provider ever reads it).
          extraction: {
            kind: 'text',
            labels: ['Serial Number', 'Seriennummer', 'SN', 'ICD'],
            column: ['S/N'],
            columnOptional: true,
            localOnly: true,
            stopAt: ['Date of Visit', 'Nachsorgedatum', 'RAM-ID', 'Patient'],
          },
        },
        // Device implant date only where it is unambiguous (Biotronik "Implantationsdatum", Abbott row "ICD" column
        // "Impl.datum"); Vitatron and Medtronic print "Implanted:" also for each lead, so they are not read (D-83).
        { key: 'implantation_date', label: 'Implantationsdatum', type: 'date', extractable: true, extraction: { kind: 'date', labels: ['Implantationsdatum', 'ICD'], column: ['Impl.datum'], columnOptional: false } },
        { key: 'device_indication', label: 'Indikation', type: 'select', allowNb: false, options: ['AV-Block III°', 'AV-Block II° Mobitz', 'Sick-Sinus-Syndrom', 'Tachy-Brady-Syndrom', 'Z.n. Kammerflimmern', 'Primärprävention bei LVEF < 35 %', 'LVEF < 35 % und LSB', 'Andere'], extractable: true, extraction: { kind: 'choice', labels: ['Indikationen für die Implantation', 'EKG-Indikation', 'Verlauf'], below: true, map: INDICATION_RULES } }, // D-75 d, D-83
        { key: 'other_indication_text', label: 'Indikation (Freitext)', type: 'text', visibleIf: { eq: ['device_indication', 'Andere'] } },
        { key: 'pocket_finding', label: 'Aggregattasche', type: 'select', normal: 'reizlos, unauffällig', options: ['reizlos, unauffällig', 'Infektzeichen', 'Hämatom', 'Druckstelle'] },
        {
          key: 'patient_condition',
          label: 'Allgemeinzustand',
          type: 'select',
          allowNb: false,
          // D-84 wording: "Patient in gutem Allgemeinzustand und kardial beschwerdefrei."
          normal: 'in gutem Allgemeinzustand und kardial beschwerdefrei',
          options: ['in gutem Allgemeinzustand und kardial beschwerdefrei', 'berichtet über Schwindel', 'berichtet über Palpitationen', 'berichtet über Synkopen'],
        },
      ],
    },
    {
      key: 'ekg',
      title: 'EKG',
      fields: [
        { key: 'base_rhythm', label: 'Grundrhythmus', type: 'select', options: ['Sinusrhythmus', 'Vorhofflimmern', 'Vorhofflattern', 'Ektop. atrialer Rhythmus'], extractable: true },
        { key: 'ecg_native', label: 'EKG ohne Stimulation', type: 'text' },
        { key: 'ecg_pacing', label: 'EKG mit Stimulation', type: 'text', visibleIf: forTypes(WITH_LEADS) },
      ],
    },
    {
      key: 'batterie',
      title: 'Batterie',
      fields: [
        {
          key: 'battery_remaining',
          label: 'Restlaufzeit',
          type: 'number',
          unit: '',
          decimals: 1,
          qualified: true,
          extractable: true,
          // D-83: Vitatron "Estimated remaining longevity: 9 years, 7 - 10.5 years", Medtronic "Geschätzte verbleibende
          // Laufzeit: 25 Mon., …", Biotronik "Erwarteter ERI 8 J. 5 Mo." (→ 8,4 Jahre), Abbott "Laufzeit: 5,3-6,6 Jahre".
          extraction: {
            labels: ['Estimated remaining longevity', 'Geschätzte verbleibende Laufzeit', 'Erwarteter ERI', 'Errechneter ERI', 'Laufzeit'],
            unit: '',
            trailing: true,
            unitField: { key: 'battery_remaining_unit', units: { Jahre: ['years', 'year', 'Jahre', 'Jahr', 'J.', 'J'], Monate: ['months', 'month', 'Monate', 'Monat', 'Mon.', 'Mon', 'Mo.', 'Mo'] } },
            compound: { units: ['Mo.', 'Mo', 'Mon.', 'Monate'], factor: 1 / 12, decimals: 1 },
            range: [0, 240],
          },
        },
        { key: 'battery_remaining_unit', label: 'Einheit', type: 'select', allowNb: false, options: ['Jahre', 'Monate'] },
        // Physician decision, never extracted (D-83).
        {
          key: 'battery_status',
          label: 'Batteriestatus',
          type: 'select',
          normal: 'OK',
          // Report wording D-84: "Batteriestatus: Regelrecht (geschätzte Restlaufzeit: 12 Jahre)".
          options: [
            { value: 'OK', forms: { bericht: 'Regelrecht' } },
            { value: 'RRT/ERI erreicht', forms: { bericht: 'RRT/ERI erreicht' } },
            { value: 'EOS', forms: { bericht: 'EOS' } },
          ],
        },
      ],
    },
    {
      key: 'impedanz',
      title: 'Elektroden (Impedanz)',
      fields: [
        { key: 'impedance_ra', label: 'Impedanz RA', type: 'number', unit: 'Ω', decimals: 0, qualified: true, referenceRule: 'dev-impedance-ra', visibleIf: forTypes(WITH_RA), extractable: true, extraction: { labels: ['Measured Impedance', 'Gemessene Impedanz', 'Elektrodenimpedanz [Ω]'], unit: 'Ω', column: ['Atrial Lead', 'Atrial', 'A. Elektrode', 'A'], range: [100, 3000] } },
        { key: 'impedance_rv', label: 'Impedanz RV', type: 'number', unit: 'Ω', decimals: 0, qualified: true, referenceRule: 'dev-impedance-rv', visibleIf: forTypes(WITH_LEADS), extractable: true, extraction: { labels: ['Measured Impedance', 'Gemessene Impedanz', 'Elektrodenimpedanz [Ω]', 'V'], unit: 'Ω', column: ['Ventricular Lead', 'Ventricular', 'V. Elektrode', 'Ventrikulär', 'V', 'Elektrodenimpedanz'], range: [100, 3000] } },
      ],
    },
    {
      key: 'sensing',
      title: 'Wahrnehmung',
      fields: [
        { key: 'sensing_ra', label: 'P-Welle (RA)', type: 'number', unit: 'mV', decimals: 1, qualified: true, referenceRule: 'dev-sensing-ra', visibleIf: forTypes(WITH_RA), extractable: true, extraction: { labels: ['P-wave', 'P-Welle', 'P-/R-Wellenamplitude [mV]', 'Wahrnehmungsampl. [mV]'], unit: 'mV', column: ['A'], section: ['Atrial Sensing Threshold', 'Atriale Wahrnehmungsschwelle', 'Testergebnisse'], range: [0.1, 20] }, help: 'Aus den In-Office-Testergebnissen, als Bereich oder mit „>“ (D-80).' },
        { key: 'sensing_rv', label: 'R-Zacke (RV)', type: 'number', unit: 'mV', decimals: 1, qualified: true, referenceRule: 'dev-sensing-rv', visibleIf: forTypes(WITH_LEADS), extractable: true, extraction: { labels: ['R-wave', 'R-Welle', 'P-/R-Wellenamplitude [mV]', 'Wahrnehmungsampl. [mV]', 'V'], unit: 'mV', column: ['V', 'Signalamplitude'], section: ['Ventricular Sensing Threshold', 'Ventrikuläre Wahrnehmungsschwelle', 'Testergebnisse'], range: [0.3, 40] }, help: 'Aus den In-Office-Testergebnissen, als Bereich oder mit „>“ (D-80).' },
      ],
    },
    {
      key: 'stimulation',
      title: 'Stimulation (Reizschwelle)',
      fields: [
        { key: 'threshold_ra_v', label: 'Reizschwelle RA', type: 'number', unit: 'V', decimals: 3, referenceRule: 'dev-threshold-ra', visibleIf: forTypes(WITH_RA), extractable: true, extraction: { labels: ['Measured Threshold', 'Gemessener Reizschwellenwert', 'Reizschwelle [V]'], unit: 'V', column: ['A'], section: A_THRESHOLD, range: [0.1, 10] } },
        { key: 'threshold_ra_ms', label: 'Impulsdauer RA', type: 'number', unit: 'ms', decimals: 2, visibleIf: forTypes(WITH_RA), extractable: true, extraction: { labels: ['Measured Threshold', 'Gemessener Reizschwellenwert', 'Impulsdauer [ms]'], unit: 'ms', second: true, column: ['A'], section: A_THRESHOLD, range: [0.03, 2] } },
        { key: 'threshold_rv_v', label: 'Reizschwelle RV', type: 'number', unit: 'V', decimals: 3, referenceRule: 'dev-threshold-rv', visibleIf: forTypes(WITH_LEADS), extractable: true, extraction: { labels: ['Measured Threshold', 'Gemessener Reizschwellenwert', 'Reizschwelle [V]', 'V'], unit: 'V', column: ['V', 'Reizschw.'], section: V_THRESHOLD, range: [0.1, 10] } },
        { key: 'threshold_rv_ms', label: 'Impulsdauer RV', type: 'number', unit: 'ms', decimals: 2, visibleIf: forTypes(WITH_LEADS), extractable: true, extraction: { labels: ['Measured Threshold', 'Gemessener Reizschwellenwert', 'Impulsdauer [ms]', 'V'], unit: 'ms', second: true, column: ['V', 'Reizschw.'], section: V_THRESHOLD, range: [0.03, 2] } },
      ],
    },
    {
      key: 'icd',
      title: 'ICD',
      fields: [
        // D-84: VT history (ICD only) decides which consensus table applies (Stiles et al. 2019).
        { key: 'vt_history', label: 'VT-Anamnese', type: 'select', allowNb: false, options: ['keine VT bekannt', 'VT bekannt'], visibleIf: onlyTypes(ICD) },
        { key: 'vt_rate', label: 'Frequenz der bekannten VT', type: 'number', unit: 'bpm', decimals: 0, visibleIf: { all: [onlyTypes(ICD), { eq: ['vt_history', 'VT bekannt'] }] } },
        {
          key: 'tachy_therapy',
          label: 'Tachykardie-Therapie',
          type: 'select',
          allowNb: false,
          options: ['aktiviert', 'deaktiviert'],
          visibleIf: onlyTypes(ICD),
          extractable: true,
          // Abbott: "Therapie (AKTIVIERT)" / "(DEAKTIVIERT)", "Tachy-Therapie | Initial | Endgültig".
          extraction: { kind: 'choice', labels: ['Tachy-Therapie', 'Therapie'], column: ['Endgültig'], columnOptional: true, map: [['DEAKTIVIERT', 'deaktiviert'], ['AKTIVIERT', 'aktiviert']] },
        },
        // Detection zones, slowest to fastest; labels follow the manufacturer's names (D-84).
        ...zoneFields(1, ZONE1, ICD_ATP, { rateKey: 'icd_z1_rate', detKey: 'icd_z1_det', column: ['VT-1', 'VT1'] }),
        ...zoneFields(2, ZONE2, ICD_ATP, { rateKey: 'icd_vt_zone', detKey: 'icd_z2_det', column: ['VT-2', 'VT2'] }),
        ...zoneFields(3, ZONE3, ICD, { rateKey: 'icd_z3_rate', detKey: 'icd_z3_det', column: ['FVT'], visibleIf: { any: [{ in: ['device_company', ['Medtronic', 'Microport']] }, { eq: ['device_type', 'S-ICD'] }, { empty: 'device_company' }] } }),
        ...zoneFields(4, ZONE4, ICD, { rateKey: 'icd_vf_zone', detKey: 'icd_z4_det', column: ['VF'] }),
        { key: 'icd_vf_atp', label: 'ATP in der VF-Zone (vor/während Laden)', type: 'select', allowNb: false, options: ['ein', 'aus'], visibleIf: onlyTypes(ICD_ATP) },
        {
          key: 'icd_konsensus_entscheidung',
          label: 'Abweichung vom Konsensus-Vorschlag',
          type: 'select',
          allowNb: false,
          options: ['bewusst so belassen', 'umprogrammiert'],
          group: KONSENSUS_GROUP,
          help: 'Wird nur gespeichert, nicht im Befund ausgegeben (D-84).',
          visibleIf: { gte: ['icd_konsensus_abweichungen', 1] },
        },
        // Abbott: row "HV", column "Elektrodenimpedanz" ("80 Ω (RV zu Gehäuse)").
        { key: 'icd_shock_impedance', label: 'Schockimpedanz', type: 'number', unit: 'Ω', decimals: 0, qualified: true, referenceRule: 'dev-shock-impedance', visibleIf: onlyTypes(ICD), extractable: true, extraction: { labels: ['HV'], column: ['Elektrodenimpedanz'], unit: 'Ω', range: [10, 200] } },
        // Abbott: "Letzte max. Aufladung 7,1 s".
        { key: 'icd_charge_time', label: 'Ladezeit', type: 'number', unit: 's', decimals: 1, referenceRule: 'dev-charge-time', visibleIf: onlyTypes(ICD), extractable: true, extraction: { labels: ['Letzte max. Aufladung'], unit: 's', range: [1, 40] } },
      ],
    },
    {
      key: 'crt',
      title: 'CRT',
      fields: [
        {
          key: 'crt_lv_vector',
          label: 'LV-Vektor',
          type: 'select',
          options: ['Bipolar: LV an RV', 'Quadripolar: LV1 zu LV2', 'Quadripolar: LV2 zu LV4', 'Quadripolar: LV1 zu Gehäuse', 'Multisite-Pacing aktiv'],
          visibleIf: onlyTypes(CRT),
          extractable: true,
        },
        { key: 'crt_lv_pacing_pct', label: 'BiV-Stimulation', type: 'number', unit: '%', decimals: 1, qualified: true, referenceRule: 'dev-biv-pacing', visibleIf: onlyTypes(CRT), extractable: true },
        { key: 'crt_lv_impedance', label: 'Impedanz LV', type: 'number', unit: 'Ω', decimals: 0, qualified: true, referenceRule: 'dev-impedance-lv', visibleIf: onlyTypes(CRT), extractable: true },
        { key: 'crt_lv_sensing', label: 'Wahrnehmung LV', type: 'number', unit: 'mV', decimals: 1, qualified: true, referenceRule: 'dev-sensing-lv', visibleIf: onlyTypes(CRT), extractable: true },
        { key: 'crt_lv_threshold_v', label: 'Reizschwelle LV', type: 'number', unit: 'V', decimals: 3, referenceRule: 'dev-threshold-lv', visibleIf: onlyTypes(CRT), extractable: true },
        { key: 'crt_lv_threshold_ms', label: 'Impulsdauer LV', type: 'number', unit: 'ms', decimals: 2, visibleIf: onlyTypes(CRT), extractable: true },
      ],
    },
    {
      key: 'beobachtungen',
      title: 'Beobachtungen (Diagnostik-Speicher)',
      fields: [
        { key: 'ap_anteil', label: 'AP-Anteil', type: 'number', unit: '%', decimals: 1, qualified: true, visibleIf: forTypes(WITH_RA), extractable: true, extraction: { labels: ['A. Paced', 'Stimulation A [%]', 'Stimulation in A/V [%]'], parts: { 'Stimulation in A/V [%]': 0 }, unit: '%', unitOptional: true, range: [0, 100] } },
        { key: 'vp_anteil', label: 'VP-Anteil', type: 'number', unit: '%', decimals: 1, qualified: true, visibleIf: forTypes(WITH_LEADS), extractable: true, extraction: { labels: ['V. Paced', 'Stimulation V [%]', 'Stimulation in A/V [%]', 'VP'], parts: { 'Stimulation in A/V [%]': 1 }, unit: '%', unitOptional: true, range: [0, 100] } },
        // Biotronik: "Atriale Arrhythmielast [%] 2".
        { key: 'af_burden', label: 'AF-Burden', type: 'number', unit: '%', decimals: 1, qualified: true, extractable: true, extraction: { labels: ['Atriale Arrhythmielast [%]'], unit: '%', unitOptional: true, range: [0, 100] } },
        { key: 'at_af_episodes', label: 'AT/AF-Episoden', type: 'number', unit: 'n', decimals: 0 },
        { key: 'at_af_longest', label: 'Längste AT/AF-Episode', type: 'text', visibleIf: { gt: ['at_af_episodes', 0] } },
        { key: 'vt_vf_episodes', label: 'VT/VF-Episoden', type: 'number', unit: 'n', decimals: 0 },
        { key: 'atp_count', label: 'ATP-Abgaben', type: 'number', unit: 'n', decimals: 0, visibleIf: onlyTypes(ICD_ATP) },
        { key: 'shock_count', label: 'Schockabgaben', type: 'number', unit: 'n', decimals: 0, visibleIf: onlyTypes(ICD) },
        ...egmFields,
        { key: 'egm_alle', label: 'EGMs (alle Episoden): am ehesten', type: 'text', visibleIf: { gt: ['episodes_total', MAX_EGM] } },
        { key: 'egm_zusatz', label: 'Abweichende Episode (Freitext)', type: 'text', visibleIf: { gt: ['episodes_total', MAX_EGM] } },
      ],
    },
    {
      key: 'programmierung',
      title: 'Programmierung',
      fields: [{ key: 'reprogramming', label: 'Programmänderung', type: 'text', multiline: true }],
    },
    {
      key: 'beurteilung',
      title: 'Beurteilung und Procedere',
      fields: [
        // Physician-selected, never preset (D-62).
        { key: 'conclusion', label: 'Beurteilung', type: 'select', allowNb: false, options: [REGELRECHT, 'Auffälligkeit'] },
        { key: 'conclusion_text', label: 'Auffälligkeit', type: 'text', visibleIf: { eq: ['conclusion', 'Auffälligkeit'] } },
        // D-84 (CLAUDE.md exception 1): free text, only the physician fills it; may contain recommendations.
        { key: 'assessment_text', label: 'Beurteilung und Procedere (Freitext)', type: 'text', multiline: true },
        { key: 'next_follow_up', label: 'Nächste Kontrolle', type: 'text', help: 'z. B. "in 6 Monaten" (D-63)' },
      ],
    },
  ],

  derived: [
    // D-72 c: up to 5 episodes one EGM sentence each, more than 5 one general sentence.
    { key: 'episodes_total', label: 'Episoden gesamt', source: 'D-72 c: AT/AF-Episoden + VT/VF-Episoden', kind: 'sum', fields: ['at_af_episodes', 'vt_vf_episodes'] },
    // D-84: distance of a zone below the known VT rate ("10–20 bpm < VT rate", Stiles et al. 2019).
    { key: 'vt_minus_z2', label: 'VT-Frequenz minus Zone 2', source: 'Stiles et al. 2019 (1443a–e)', kind: 'difference', fields: ['vt_rate', 'icd_vt_zone'] },
    { key: 'vt_minus_z3', label: 'VT-Frequenz minus Zone 3', source: 'Stiles et al. 2019 (1443c)', kind: 'difference', fields: ['vt_rate', 'icd_z3_rate'] },
    { key: 'icd_konsensus_abweichungen', label: 'Abweichungen vom Konsensus-Vorschlag', source: 'Stiles et al. 2019 (1443a–e), D-84', kind: 'countTrue', items: KONSENSUS_CHECKS },
  ],
  displays: [],
  tables: [],
  warnings: [
    // D-84: neutral notice, always shown (not switchable).
    { section: 'icd', when: { eq: ['tachy_therapy', 'deaktiviert'] }, text: 'Hinweis: Die Tachykardie-Therapie ist deaktiviert.' },
    ...KONSENSUS_CHECKS.map((c) => ({ section: 'icd', when: c.when, text: c.label, group: KONSENSUS_GROUP })),
    {
      section: 'beurteilung',
      when: { all: [{ eq: ['conclusion', REGELRECHT] }, { outOfRange: [] }] },
      text: 'Hinweis: Mindestens ein Messwert liegt außerhalb des Referenzbereichs, die Beurteilung lautet „regelrecht“.',
    },
    // D-75 l: battery status and pocket findings also trigger the warning.
    {
      section: 'beurteilung',
      when: { all: [{ eq: ['conclusion', REGELRECHT] }, { in: ['battery_status', ['RRT/ERI erreicht', 'EOS']] }] },
      text: 'Hinweis: Batteriestatus RRT/ERI bzw. EOS, die Beurteilung lautet „regelrecht“.',
    },
    {
      section: 'beurteilung',
      when: { all: [{ eq: ['conclusion', REGELRECHT] }, { in: ['pocket_finding', ['Infektzeichen', 'Hämatom', 'Druckstelle']] }] },
      text: 'Hinweis: Befund an der Aggregattasche, die Beurteilung lautet „regelrecht“.',
    },
  ],

  report: {
    // D-84: title by device class.
    title: 'Device-Abfrage',
    titleWhen: [
      { when: { in: ['device_type', PACEMAKER] }, text: 'Schrittmacherabfrage' },
      { when: { in: ['device_type', ['1-Kammer-ICD', '2-Kammer-ICD', 'S-ICD']] }, text: 'ICD-Abfrage' },
      { when: { in: ['device_type', CRT] }, text: 'CRT-Abfrage' },
    ],
    head: [],
    measurementsHeading: 'Messwerte:',
    measurements: [],
    body: [
      {
        id: 'implantation',
        heading: 'Implantation & Programmierung:',
        lines: [
          {
            id: 'geraet',
            items: [
              {
                id: 'dev.implantation', // D-84: "Z. n. Implantation eines 2-Kammer-Schrittmachers (Vitatron Q70) am … bei …."
                choose: [
                  { id: 'a', when: { eq: ['device_indication', 'Andere'] }, text: implantation('{device_type:gen}', '{other_indication_text}') },
                  { id: 'b', when: { not: { eq: ['device_indication', 'Andere'] } }, text: implantation('{device_type:gen}', '{device_indication}') },
                  { id: 'c', when: { any: [{ filled: 'device_company' }, { filled: 'device_model' }, { filled: 'implantation_date' }] }, text: implantation('Aggregats', null) },
                ],
              },
              {
                id: 'dev.modus',
                choose: [
                  { id: 'a', when: { eq: ['pacing_mode', 'Andere'] }, text: 'Programmierter Betriebsmodus: {pacing_mode_text}.' },
                  { id: 'b', when: { not: { eq: ['pacing_mode', 'Andere'] } }, text: 'Programmierter Betriebsmodus: {pacing_mode}.' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'klinik',
        heading: 'Klinischer Befund:',
        lines: [
          {
            id: 'klinik',
            items: [
              {
                id: 'dev.tasche',
                choose: [
                  { id: 'a', when: { eq: ['pocket_finding', 'reizlos, unauffällig'] }, text: 'Reizlose, unauffällige Aggregattasche.' },
                  { id: 'b', when: { eq: ['pocket_finding', 'Infektzeichen'] }, text: 'Infektzeichen an der Aggregattasche.' },
                  { id: 'c', when: { eq: ['pocket_finding', 'Hämatom'] }, text: 'Hämatom an der Aggregattasche.' },
                  { id: 'd', when: { eq: ['pocket_finding', 'Druckstelle'] }, text: 'Druckstelle an der Aggregattasche.' },
                  { id: 'e', when: { eq: ['pocket_finding', NB] }, text: 'Aggregattasche nicht beurteilbar.' },
                ],
              },
              {
                id: 'dev.zustand', // D-40: wording follows the patient's sex; empty sex → no sentence
                choose: [
                  { id: 'a', when: { eq: ['sex', 'weiblich'] }, text: 'Patientin {patient_condition}.' },
                  { id: 'b', when: { eq: ['sex', 'männlich'] }, text: 'Patient {patient_condition}.' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'ekg',
        heading: 'EKG-Befund:',
        lines: [
          {
            id: 'ekg',
            bullets: true,
            items: [
              {
                id: 'ekg.spontan',
                choose: [
                  { id: 'a', text: 'Spontanrhythmus: {base_rhythm}[ ({ecg_native})]' },
                  { id: 'b', text: 'Spontanrhythmus: {ecg_native}' },
                ],
              },
              { id: 'ekg.stimulation', text: 'Unter Stimulation: {ecg_pacing}' },
            ],
          },
        ],
      },
      {
        id: 'messwerte',
        heading: 'Geräte- und Sondenmesswerte:',
        lines: [
          {
            id: 'messwerte',
            bullets: true,
            items: [
              {
                id: 'mw.batterie', // D-84: the status is the physician's entry, the longevity as printed
                choose: [
                  { id: 'a', text: 'Batteriestatus: {battery_status:bericht}[ (geschätzte Restlaufzeit: {battery_remaining} {battery_remaining_unit})]' },
                  { id: 'b', text: 'Geschätzte Restlaufzeit: {battery_remaining} {battery_remaining_unit}' },
                ],
              },
              { id: 'mw.stimulationsanteile', text: [{ join: ' / ', before: 'Stimulationsanteile: ', items: ['AP {ap_anteil} %', 'VP {vp_anteil} %', 'BiV {crt_lv_pacing_pct} %'] }] },
              { id: 'mw.wahrnehmung', text: [{ join: ' / ', before: 'Wahrnehmung (Sensing): ', items: ['RA {sensing_ra} mV', 'RV {sensing_rv} mV', 'LV {crt_lv_sensing} mV'] }] },
              {
                id: 'mw.reizschwellen',
                text: [
                  {
                    join: ' / ',
                    before: 'Reizschwellen: ',
                    items: [
                      ['RA {threshold_ra_v} V / {threshold_ra_ms} ms', 'RA {threshold_ra_v} V'],
                      ['RV {threshold_rv_v} V / {threshold_rv_ms} ms', 'RV {threshold_rv_v} V'],
                      ['LV {crt_lv_threshold_v} V / {crt_lv_threshold_ms} ms', 'LV {crt_lv_threshold_v} V'],
                    ],
                  },
                ],
              },
              { id: 'mw.impedanzen', text: [{ join: ' / ', before: 'Sondenimpedanzen: ', items: ['RA {impedance_ra} Ω', 'RV {impedance_rv} Ω', 'LV {crt_lv_impedance} Ω'] }] },
              { id: 'crt.vektor', text: 'LV-Vektor: {crt_lv_vector}' },
              // ICD lines (D-84, wording DRAFT): zones with the manufacturer's names.
              { id: 'icd.therapie', text: 'Tachykardie-Therapie: {tachy_therapy}' },
              { id: 'icd.zonen', choose: ZONE_REPORT },
              { id: 'icd.vf_atp', text: 'ATP in der VF-Zone: {icd_vf_atp}' },
              { id: 'icd.schock', text: 'Schockimpedanz: {icd_shock_impedance} Ω' },
              { id: 'icd.ladezeit', text: 'Ladezeit: {icd_charge_time} s' },
            ],
          },
        ],
      },
      {
        id: 'beobachtungen',
        heading: 'Beobachtungen:',
        lines: [
          {
            id: 'beobachtungen',
            items: [
              { id: 'ep.burden', text: 'AF-Burden: {af_burden} %.' },
              {
                id: 'ep.at_af',
                choose: [
                  { id: 'a', when: { eq: ['at_af_episodes', 0] }, text: 'Keine AT/AF-Episoden.' },
                  { id: 'b', text: 'AT/AF-Episoden: {at_af_episodes}[ (längste Episode {at_af_longest})].' },
                ],
              },
              {
                id: 'ep.vt_vf',
                choose: [
                  { id: 'a', when: { eq: ['vt_vf_episodes', 0] }, text: 'Keine VT/VF-Episoden.' },
                  { id: 'b', text: ['VT/VF-Episoden: {vt_vf_episodes}', { join: '; ', before: ' (', after: ')', items: ['ATP: {atp_count}', 'Schocks: {shock_count}'] }, '.'] },
                ],
              },
              // D-60, D-72 c: one sentence per episode up to 5, otherwise one general sentence.
              ...Array.from({ length: MAX_EGM }, (_, i) => ({
                id: `ep.egm${i + 1}`,
                text: `Nach Sichtung des EGMs handelt es sich am ehesten um {egm_${i + 1}}.`,
              })),
              { id: 'ep.egm_alle', text: 'Nach Sichtung der EGMs handelt es sich am ehesten um {egm_alle}.' },
              { id: 'ep.egm_zusatz', text: '{egm_zusatz}' },
            ],
          },
        ],
      },
      {
        id: 'programmierung',
        lines: [{ id: 'programmierung', label: 'Programmänderung:', items: [{ id: 'prog', text: '{reprogramming}.' }] }],
      },
      {
        id: 'zusammenfassung',
        heading: 'Beurteilung und Procedere:',
        lines: [
          {
            id: 'zusammenfassung',
            items: [
              {
                id: 'zf.beurteilung', // D-62: physician-selected
                choose: [
                  { id: 'a', when: { eq: ['conclusion', REGELRECHT] }, text: `${REGELRECHT}.` },
                  { id: 'b', when: { eq: ['conclusion', 'Auffälligkeit'] }, text: 'Auffälligkeit: {conclusion_text}.' },
                  { id: 'c', when: { eq: ['conclusion', 'Auffälligkeit'] }, text: 'Auffälligkeit.' },
                ],
              },
              // D-84 (CLAUDE.md exception 1): the physician's own text, never pre-filled or suggested.
              { id: 'zf.freitext', text: '{assessment_text}' },
              { id: 'zf.kontrolle', text: 'Nächste Kontrolle: {next_follow_up}.' }, // D-63
            ],
          },
        ],
      },
    ],
  },
};
