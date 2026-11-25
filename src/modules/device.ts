// Module 2: Device-Abfrage (SM / ICD / CRT-P / CRT-D / S-ICD).
// Data only. Clinical content follows spec/SPEC-modules.md (Modul 2),
// spec/SPEC-textgen.md (DEV-T, DEV-REF, DEV-EP, LIB-DEV-01) and decisions
// D-55 … D-64, D-72 b/c/f, D-74 d. The prototype's automatic "Regelrechte …"
// texts are removed (F-01, CLAUDE.md rule 5): the conclusion is physician-
// selected (D-62). Details drafted in M3 await review: SPEC-decisions D-75.
import type { Cond } from '../core/conditions';
import { NB, type ModuleSchema } from '../core/schema';

const DEVICE_TYPES = ['VVI-SM', 'DDD-SM', 'VVI-ICD', 'DDD-ICD', 'CRT-P', 'CRT-D', 'S-ICD'];
const WITH_RA = ['DDD-SM', 'DDD-ICD', 'CRT-P', 'CRT-D'];
const WITH_LEADS = DEVICE_TYPES.filter((t) => t !== 'S-ICD');
const ICD = ['VVI-ICD', 'DDD-ICD', 'CRT-D', 'S-ICD'];
const ICD_ATP = ['VVI-ICD', 'DDD-ICD', 'CRT-D'];
const CRT = ['CRT-P', 'CRT-D'];

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
    'Initial', 'Final', 'Anfänglich', 'Letzte', 'Vorher', 'Aktuell',
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
  ['^Pacemaker Model .*\\bDR\\b', 'DDD-SM'],
  ['^Pacemaker Model .*\\bSR\\b', 'VVI-SM'],
  ['^Schrittmachermodell .*\\b[A-Z]*DR[A-Z]*\\d*\\b', 'DDD-SM'], // Medtronic model code, e.g. ADDRL1
  ['^Schrittmachermodell .*\\b[A-Z]*SR[A-Z]*\\d*\\b', 'VVI-SM'],
  [`^Implantat .*\\b${BIOTRONIK_SM}\\b.*\\bDR`, 'DDD-SM'],
  [`^Implantat .*\\b${BIOTRONIK_SM}\\b.*\\bSR`, 'VVI-SM'],
  ['^ICD .*\\bVR\\b', 'VVI-ICD'],
  ['^ICD .*\\bDR\\b', 'DDD-ICD'],
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
        { key: 'device_type', label: 'Gerätetyp', type: 'select', allowNb: false, options: DEVICE_TYPES, extractable: true, extraction: { kind: 'choice', labels: MODEL_LABELS, column: ['Modell'], columnOptional: true, stopAt: SERIAL_STOP, map: DEVICE_TYPE_RULES } },
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
        { key: 'device_serial', label: 'Seriennummer', type: 'text', help: 'Nur manuelle Eingabe, nie extrahiert (Gateway §2.6.4).' },
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
          normal: 'ist in gutem Allgemeinzustand und beschwerdefrei',
          options: ['ist in gutem Allgemeinzustand und beschwerdefrei', 'berichtet über Schwindel', 'berichtet über Palpitationen', 'berichtet über Synkopen'],
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
        { key: 'battery_status', label: 'Batteriestatus', type: 'select', normal: 'OK', options: ['OK', 'RRT/ERI erreicht', 'EOS'] },
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
        { key: 'threshold_ra_v', label: 'Reizschwelle RA', type: 'number', unit: 'V', decimals: 2, referenceRule: 'dev-threshold-ra', visibleIf: forTypes(WITH_RA), extractable: true, extraction: { labels: ['Measured Threshold', 'Gemessener Reizschwellenwert', 'Reizschwelle [V]'], unit: 'V', column: ['A'], section: A_THRESHOLD, range: [0.1, 10] } },
        { key: 'threshold_ra_ms', label: 'Impulsdauer RA', type: 'number', unit: 'ms', decimals: 2, visibleIf: forTypes(WITH_RA), extractable: true, extraction: { labels: ['Measured Threshold', 'Gemessener Reizschwellenwert', 'Impulsdauer [ms]'], unit: 'ms', second: true, column: ['A'], section: A_THRESHOLD, range: [0.03, 2] } },
        { key: 'threshold_rv_v', label: 'Reizschwelle RV', type: 'number', unit: 'V', decimals: 2, referenceRule: 'dev-threshold-rv', visibleIf: forTypes(WITH_LEADS), extractable: true, extraction: { labels: ['Measured Threshold', 'Gemessener Reizschwellenwert', 'Reizschwelle [V]', 'V'], unit: 'V', column: ['V', 'Reizschw.'], section: V_THRESHOLD, range: [0.1, 10] } },
        { key: 'threshold_rv_ms', label: 'Impulsdauer RV', type: 'number', unit: 'ms', decimals: 2, visibleIf: forTypes(WITH_LEADS), extractable: true, extraction: { labels: ['Measured Threshold', 'Gemessener Reizschwellenwert', 'Impulsdauer [ms]', 'V'], unit: 'ms', second: true, column: ['V', 'Reizschw.'], section: V_THRESHOLD, range: [0.03, 2] } },
      ],
    },
    {
      key: 'icd',
      title: 'ICD',
      fields: [
        { key: 'icd_vt_zone', label: 'VT-Zone', type: 'number', unit: 'bpm', decimals: 0, qualified: true, visibleIf: onlyTypes(ICD), extractable: true },
        // Abbott: row "Detektionsparameter", column "VF" ("240 min-1"); the VT zone waits for a decision (VT-1 or VT-2).
        { key: 'icd_vf_zone', label: 'VF-Zone', type: 'number', unit: 'bpm', decimals: 0, qualified: true, visibleIf: onlyTypes(ICD), extractable: true, extraction: { labels: ['Detektionsparameter'], column: ['VF'], unit: 'bpm', alternatives: [{ unit: 'min-1', factor: 1 }, { unit: 'min⁻¹', factor: 1 }, { unit: '/min', factor: 1 }], range: [100, 300] } },
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
        { key: 'crt_lv_threshold_v', label: 'Reizschwelle LV', type: 'number', unit: 'V', decimals: 2, referenceRule: 'dev-threshold-lv', visibleIf: onlyTypes(CRT), extractable: true },
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
      fields: [{ key: 'reprogramming', label: 'Umprogrammierung', type: 'text', multiline: true }],
    },
    {
      key: 'beurteilung',
      title: 'Beurteilung',
      fields: [
        // Physician-selected, never preset (D-62).
        { key: 'conclusion', label: 'Beurteilung', type: 'select', allowNb: false, options: [REGELRECHT, 'Auffälligkeit'] },
        { key: 'conclusion_text', label: 'Auffälligkeit', type: 'text', visibleIf: { eq: ['conclusion', 'Auffälligkeit'] } },
        { key: 'next_follow_up', label: 'Nächste Kontrolle', type: 'text', help: 'z. B. "in 6 Monaten" (D-63)' },
      ],
    },
  ],

  derived: [
    // D-72 c: up to 5 episodes one EGM sentence each, more than 5 one general sentence.
    { key: 'episodes_total', label: 'Episoden gesamt', source: 'D-72 c: AT/AF-Episoden + VT/VF-Episoden', kind: 'sum', fields: ['at_af_episodes', 'vt_vf_episodes'] },
  ],
  displays: [],
  tables: [],
  warnings: [
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
    title: 'Device-Abfrage:',
    head: [],
    measurementsHeading: 'Messwerte:',
    measurements: [],
    body: [
      {
        id: 'geraet',
        lines: [
          {
            id: 'geraet',
            items: [
              {
                id: 'dev.typ',
                choose: [
                  { id: 'a', text: ['Abfrage eines {device_type}', { join: ' ', before: ' (', after: ')', items: ['{device_company}', '{device_model}'] }, '.'] },
                  { id: 'b', when: { any: [{ filled: 'device_company' }, { filled: 'device_model' }] }, text: ['Abfrage eines Aggregats', { join: ' ', before: ' (', after: ')', items: ['{device_company}', '{device_model}'] }, '.'] },
                ],
              },
              {
                id: 'dev.modus',
                choose: [
                  { id: 'a', when: { eq: ['pacing_mode', 'Andere'] }, text: 'Programmierter Modus: {pacing_mode_text}.' },
                  { id: 'b', when: { not: { eq: ['pacing_mode', 'Andere'] } }, text: 'Programmierter Modus: {pacing_mode}.' },
                ],
              },
              {
                id: 'dev.implantation',
                choose: [
                  { id: 'a', when: { eq: ['device_indication', 'Andere'] }, text: 'Das Aggregat wurde am {implantation_date} bei {other_indication_text} implantiert.' },
                  { id: 'b', when: { not: { eq: ['device_indication', 'Andere'] } }, text: 'Das Aggregat wurde am {implantation_date} bei {device_indication} implantiert.' },
                  { id: 'c', text: 'Das Aggregat wurde am {implantation_date} implantiert.' },
                  { id: 'd', when: { eq: ['device_indication', 'Andere'] }, text: 'Implantationsindikation: {other_indication_text}.' },
                  { id: 'e', when: { not: { eq: ['device_indication', 'Andere'] } }, text: 'Implantationsindikation: {device_indication}.' },
                ],
              },
            ],
          },
          {
            id: 'klinik',
            items: [
              {
                id: 'dev.tasche',
                choose: [
                  { id: 'a', when: { eq: ['pocket_finding', 'reizlos, unauffällig'] }, text: 'Klinisch zeigt sich die Aggregattasche reizlos, unauffällig.' },
                  { id: 'b', when: { eq: ['pocket_finding', 'Infektzeichen'] }, text: 'Klinisch zeigen sich Infektzeichen an der Aggregattasche.' },
                  { id: 'c', when: { eq: ['pocket_finding', 'Hämatom'] }, text: 'Klinisch zeigt sich ein Hämatom an der Aggregattasche.' },
                  { id: 'd', when: { eq: ['pocket_finding', 'Druckstelle'] }, text: 'Klinisch zeigt sich eine Druckstelle an der Aggregattasche.' },
                  { id: 'e', when: { eq: ['pocket_finding', NB] }, text: 'Die Aggregattasche ist nicht beurteilbar.' },
                ],
              },
              {
                id: 'dev.zustand', // D-40: wording follows the patient's sex; empty sex → no sentence
                choose: [
                  { id: 'a', when: { eq: ['sex', 'weiblich'] }, text: 'Die Patientin {patient_condition}.' },
                  { id: 'b', when: { eq: ['sex', 'männlich'] }, text: 'Der Patient {patient_condition}.' },
                ],
              },
            ],
          },
          {
            id: 'ekg',
            items: [
              { id: 'ekg.rhythmus', text: 'Grundrhythmus: {base_rhythm}.' },
              { id: 'ekg.nativ', text: 'EKG-Befund ohne Stimulation: {ecg_native}.' },
              { id: 'ekg.stimulation', text: 'EKG-Befund mit Stimulation: {ecg_pacing}.' },
            ],
          },
        ],
      },
      {
        id: 'messwerte',
        lines: [
          {
            id: 'messwerte',
            label: 'Messwerte:',
            items: [
              {
                id: 'mw.batterie',
                choose: [
                  { id: 'a', text: 'Batteriestatus: {battery_status}[, Restlaufzeit {battery_remaining} {battery_remaining_unit}].' },
                  { id: 'b', text: 'Restlaufzeit der Batterie: {battery_remaining} {battery_remaining_unit}.' },
                ],
              },
              { id: 'mw.stimulationsanteile', text: [{ join: ' / ', before: 'Stimulationsanteile: ', after: '.', items: ['AP {ap_anteil} %', 'VP {vp_anteil} %'] }] },
              { id: 'mw.wahrnehmung', text: [{ join: ' / ', before: 'Wahrnehmung: ', after: '.', items: ['RA {sensing_ra} mV', 'RV {sensing_rv} mV'] }] },
              {
                id: 'mw.reizschwellen',
                text: [
                  {
                    join: ' / ',
                    before: 'Reizschwellen: ',
                    after: '.',
                    items: [
                      ['RA {threshold_ra_v} V bei {threshold_ra_ms} ms', 'RA {threshold_ra_v} V'],
                      ['RV {threshold_rv_v} V bei {threshold_rv_ms} ms', 'RV {threshold_rv_v} V'],
                    ],
                  },
                ],
              },
              { id: 'mw.impedanzen', text: [{ join: ' / ', before: 'Impedanzen: ', after: '.', items: ['RA {impedance_ra} Ω', 'RV {impedance_rv} Ω'] }] },
            ],
          },
          {
            id: 'icd',
            label: 'ICD-spezifische Parameter:',
            items: [
              { id: 'icd.zonen', text: [{ join: '; ', after: '.', items: ['VT-Zone {icd_vt_zone} bpm', 'VF-Zone {icd_vf_zone} bpm'] }] },
              { id: 'icd.schock', text: [{ join: '; ', after: '.', items: ['Schockimpedanz {icd_shock_impedance} Ω', 'Ladezeit {icd_charge_time} s'] }] },
            ],
          },
          {
            id: 'crt',
            label: 'CRT-spezifische Parameter:',
            items: [
              {
                id: 'crt.werte',
                text: [
                  {
                    join: '; ',
                    after: '.',
                    items: [
                      'LV-Vektor: {crt_lv_vector}',
                      'BiV-Stimulation {crt_lv_pacing_pct} %',
                      'LV-Impedanz {crt_lv_impedance} Ω',
                      'LV-Wahrnehmung {crt_lv_sensing} mV',
                      ['LV-Reizschwelle {crt_lv_threshold_v} V bei {crt_lv_threshold_ms} ms', 'LV-Reizschwelle {crt_lv_threshold_v} V'],
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'beobachtungen',
        lines: [
          {
            id: 'beobachtungen',
            label: 'Beobachtungen:',
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
          {
            id: 'programmierung',
            items: [{ id: 'prog', text: 'Folgende Umprogrammierung wurde vorgenommen: {reprogramming}.' }],
          },
        ],
      },
      {
        id: 'zusammenfassung',
        heading: 'Zusammenfassung:',
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
              { id: 'zf.kontrolle', text: 'Nächste Kontrolle: {next_follow_up}.' }, // D-63
            ],
          },
        ],
      },
    ],
  },
};
