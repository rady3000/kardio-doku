// Module 1: Transthorakale Echokardiographie (TTE).
// Data only — fields, rule references and sentence templates. Clinical
// content follows spec/SPEC-modules.md (Modul 1), spec/SPEC-textgen.md
// (TTE-R20, TTE-R30, TTE-R40, TTE-P, TTE-M, TTE-T, TTE-S) and the decisions in
// spec/SPEC-decisions.md. Details drafted during M2 await review: SPEC-decisions D-73.
import type { Cond } from '../core/conditions';
import { NB, type ModuleSchema, type SelectOption } from '../core/schema';

// ---- Option sets -----------------------------------------------------------

/** Valve grades with ° notation and intermediate grades for every valve (D-69 a). */
const grades = (first: string): (string | SelectOption)[] => [
  'keine',
  { value: first, short: 'I°' },
  { value: 'leicht- bis mittelgradige', short: 'I–II°' },
  { value: 'mittelgradige', short: 'II°' },
  { value: 'mittel- bis hochgradige', short: 'II–III°' },
  { value: 'hochgradige', short: 'III°' },
];

/** TR: five grades (Hahn & Zamorano 2017, D-17) with intermediate grades. */
const TR_GRADES: (string | SelectOption)[] = [
  'keine',
  'physiologisch',
  { value: 'leichte', short: 'I°' },
  { value: 'leicht- bis mittelgradige', short: 'I–II°' },
  { value: 'mittelgradige', short: 'II°' },
  { value: 'mittel- bis hochgradige', short: 'II–III°' },
  { value: 'hochgradige', short: 'III°' },
  { value: 'hochgradige bis massive', short: 'III–IV°' },
  { value: 'massive', short: 'IV°' },
  { value: 'massive bis torrentielle', short: 'IV–V°' },
  { value: 'torrentielle', short: 'V°' },
];

const SKLEROSE = ['zart', 'leicht sklerosiert', 'mäßig sklerosiert', 'schwer sklerosiert'];
/** Prosthesis function (TTE-P, D-19, D-69 b). */
const PROTHESE_FUNKTION = [
  'regelrecht',
  'erhöhter transprothetischer Gradient',
  'paravalvuläres Leck',
  'transvalvuläre Insuffizienz',
  NB,
];
const JA_NEIN = ['Nein', 'Ja'];
const AF = ['Vorhofflimmern', 'Vorhofflattern'];
const CHEMO = ['vor Chemotherapie', 'Verlaufskontrolle unter / nach Chemotherapie'];
const AI_DETAILS = ['mittelgradige', 'mittel- bis hochgradige', 'hochgradige'];

// ---- Conditions --------------------------------------------------------------

const prothese = (v: string): Cond => ({ eq: [`${v}_prothese`, 'Ja'] });
const nativ = (v: string): Cond => ({ not: prothese(v) });
const path = (key: string, normal: readonly string[] = ['keine']): Cond => ({ notIn: [key, [...normal, NB]] });

/** HFpEF text preconditions (TTE-R20.3, D-65 m/n). Sex and rhythm must be known where a criterion depends on them. */
const HFPEF_BASE: Cond = {
  all: [
    { gte: ['hfpef_inputs', 4] },
    { not: { eq: ['rhythm', 'AV-Block III'] } },
    { any: [{ empty: 'lvmi' }, { filled: 'sex' }] },
    {
      any: [
        { all: [{ empty: 'laesvi' }, { empty: 'nt_probnp' }, { empty: 'bnp' }] },
        { in: ['rhythm', ['Sinusrhythmus', ...AF]] },
      ],
    },
  ],
};
const HFPEF_CONCLUSION: Cond = { all: [HFPEF_BASE, { gte: ['lvef', 50] }] };
const HFPEF_ITEMS = [
  { label: 'R20-1 LV-Hypertrophie (LVMI oder RWT)', when: { any: [{ cat: ['tte-hfpef-lvmi', 'erfüllt'] }, { cat: ['tte-hfpef-rwt', 'erfüllt'] }] } as Cond },
  { label: 'R20-2 LA-Dilatation (LAVI)', when: { cat: ['tte-hfpef-lavi', 'erfüllt'] } as Cond },
  { label: "R20-3 E/e' > 9", when: { cat: ['tte-hfpef-ee', 'erfüllt'] } as Cond },
  { label: 'R20-4 sPAP > 35 mmHg oder TR-Geschwindigkeit > 2,8 m/s', when: { any: [{ cat: ['tte-hfpef-spap', 'erfüllt'] }, { cat: ['tte-hfpef-trv', 'erfüllt'] }] } as Cond },
];

const dpAlternatives = (v: string) => [
  `dp max/mean {${v}_dp_max}/{${v}_dp_mean} mmHg`,
  `dp max {${v}_dp_max} mmHg`,
  `dp mean {${v}_dp_mean} mmHg`,
];
const prosthesisSentence = (v: string, measurements: (string | string[])[]) => ({
  id: `${v}.prothese`,
  when: prothese(v),
  text: [
    `Prothese[ Typ {${v}_prothese_typ}], in loco typico und fest sitzend[, {${v}_prothese_funktion}]`,
    { join: '; ', before: ' (', after: ')', items: measurements },
    '.',
  ],
});
const prosthesisFields = (v: string, typLabel: string) =>
  [
    { key: `${v}_prothese`, label: 'Prothese', type: 'select', options: JA_NEIN, allowNb: false, normal: 'Nein' },
    { key: `${v}_prothese_typ`, label: typLabel, type: 'text', visibleIf: prothese(v) },
    { key: `${v}_prothese_funktion`, label: 'Prothesenfunktion', type: 'select', options: PROTHESE_FUNKTION, visibleIf: prothese(v) },
    { key: `${v}_prothese_text`, label: 'Zusatz zur Prothese', type: 'text', visibleIf: prothese(v) },
  ] as const;

// ---- Schema ------------------------------------------------------------------

export const tte: ModuleSchema = {
  key: 'tte',
  title: 'Transthorakale Echokardiographie (TTE)',
  version: 1,
  library: 'tte',
  rules: [
    'tte-lvef', 'tte-lavi', 'tte-lvedd', 'tte-ivsd', 'tte-pwd', 'tte-lvesd', 'tte-rv-laenge', 'tte-rvd1',
    'tte-rvd2', 'tte-rv-funktion', 'tte-tapse', 'tte-tasv', 'tte-vci', 'tte-aorta-asc', 'tte-hfpef-lvmi',
    'tte-hfpef-rwt', 'tte-hfpef-lavi', 'tte-hfpef-ee', 'tte-hfpef-spap', 'tte-hfpef-trv', 'tte-ntprobnp',
    'tte-bnp', 'tte-eprime-septal', 'tte-eprime-lateral', 'tte-tr-vc', 'tte-tr-eroa', 'tte-ph-zusammenfassung',
  ],

  sections: [
    {
      key: 'untersuchung',
      title: 'Untersuchungsdaten',
      fields: [
        {
          key: 'indication',
          label: 'Klinische Indikation',
          type: 'select',
          allowNb: false,
          // D-24 and D-69 e
          options: [
            'Status praesens', 'Myokardinfarkt', 'Dyspnoe', 'Synkope', 'Schwindel / Präsynkope', 'Angina pectoris',
            'vor Chemotherapie', 'Vitienkontrolle', 'Vorhofflimmern (Erstdiagnose)', 'Präoperativ',
            'V.a. Lungenembolie / Rechtsherzbelastung', 'Perikarderguss (Verlaufskontrolle)',
            'Verlaufskontrolle unter / nach Chemotherapie', 'Z.n. Herzklappen-OP / Klappenersatz', 'Palpitationen',
            'Sonstige (Freitext)',
          ],
        },
        { key: 'indication_text', label: 'Indikation (Freitext)', type: 'text', visibleIf: { eq: ['indication', 'Sonstige (Freitext)'] } },
        { key: 'rhythm', label: 'EKG-Rhythmus', type: 'select', allowNb: false, normal: 'Sinusrhythmus', options: ['Sinusrhythmus', 'Vorhofflimmern', 'Vorhofflattern', 'AV-Block III'] },
        { key: 'schallbedingungen', label: 'Schallbedingungen', type: 'select', allowNb: false, normal: 'gut', options: ['gut', 'mäßig', 'deutlich eingeschränkt'] },
      ],
    },
    {
      key: 'lv',
      title: 'Linker Ventrikel',
      fields: [
        { key: 'lvedd', label: 'LVEDD', type: 'number', unit: 'mm', decimals: 1, referenceRule: 'tte-lvedd', extractable: true },
        { key: 'lvesd', label: 'LVESD', type: 'number', unit: 'mm', decimals: 1, referenceRule: 'tte-lvesd', extractable: true },
        { key: 'ivsd', label: 'IVSd', type: 'number', unit: 'mm', decimals: 1, referenceRule: 'tte-ivsd', extractable: true },
        { key: 'pwd', label: 'PWd', type: 'number', unit: 'mm', decimals: 1, referenceRule: 'tte-pwd', extractable: true },
        { key: 'lvef', label: 'LVEF', type: 'number', unit: '%', decimals: 1, referenceRule: 'tte-lvef', extractable: true },
        { key: 'lvmi', label: 'LVMI', type: 'number', unit: 'g/m²', decimals: 1, referenceRule: 'tte-hfpef-lvmi', extractable: true },
        { key: 'rwt', label: 'RWT', type: 'number', unit: '', decimals: 2, referenceRule: 'tte-hfpef-rwt', extractable: true },
        { key: 'gls', label: '2D-GLS', type: 'number', unit: '%', decimals: 1, extractable: true },
        {
          key: 'lvedd_dim',
          label: 'LV-Größe (LVEDD)',
          type: 'select',
          autoFrom: 'tte-lvedd',
          normal: 'normal dimensioniert',
          options: ['normal dimensioniert', 'leicht dilatiert', 'mittelgradig dilatiert', 'hochgradig dilatiert'],
        },
        {
          key: 'lvesd_dim',
          label: 'LV-Größe (LVESD)',
          type: 'select',
          normal: 'normal dimensioniert',
          options: ['normal dimensioniert', 'leicht dilatiert', 'mittelgradig dilatiert', 'hochgradig dilatiert'],
        },
        {
          key: 'lv_kinetik',
          label: 'Kinetik / Motilität',
          type: 'select',
          normal: 'keine Kinetikstörungen',
          options: ['keine Kinetikstörungen', 'globale Hypokinesie', 'regionale Wandbewegungsstörungen'],
        },
        { key: 'lv_kinetik_text', label: 'Wandbewegungsstörung', type: 'text', visibleIf: { eq: ['lv_kinetik', 'regionale Wandbewegungsstörungen'] } },
      ],
    },
    {
      key: 'diastole',
      title: 'Diastolische Funktion',
      fields: [
        { key: 'mitral_e', label: 'Mitral E', reportLabel: 'E', type: 'number', unit: 'm/s', decimals: 2, extractable: true },
        { key: 'mitral_a', label: 'Mitral A', reportLabel: 'A', type: 'number', unit: 'm/s', decimals: 2, extractable: true },
        { key: 'e_a_ratio', label: 'E/A', type: 'number', unit: '', decimals: 2, extractable: true },
        { key: 'e_prime_septal', label: "e' septal", type: 'number', unit: 'cm/s', decimals: 1, referenceRule: 'tte-eprime-septal' },
        { key: 'e_prime_lateral', label: "e' lateral", type: 'number', unit: 'cm/s', decimals: 1, referenceRule: 'tte-eprime-lateral' },
        { key: 'e_e_prime', label: "E/e' (Mittelwert)", reportLabel: "E/e'", type: 'number', unit: '', decimals: 1, referenceRule: 'tte-hfpef-ee', extractable: true, help: 'Wert des Echogeräts (Mittelwert), wird nicht berechnet (D-10).' },
      ],
    },
    {
      key: 'vorhoefe',
      title: 'Vorhöfe, rechter Ventrikel, Pulmonaldruck',
      fields: [
        { key: 'la', label: 'LA', type: 'number', unit: 'mm', decimals: 1, extractable: true },
        { key: 'laesvi', label: 'LAVI (LAESVI)', reportLabel: 'LAVI', type: 'number', unit: 'ml/m²', decimals: 1, referenceRule: 'tte-lavi', extractable: true },
        {
          key: 'la_diameter_qualitativ',
          label: 'LA-Größe',
          type: 'select',
          autoFrom: 'tte-lavi',
          normal: 'normal dimensioniert',
          options: ['normal dimensioniert', 'leichtgradig dilatiert', 'mittelgradig dilatiert', 'hochgradig dilatiert'],
        },
        { key: 'ra_diameter', label: 'RA-Größe', type: 'select', normal: 'normwertig', options: ['normwertig', 'leicht dilatiert', 'mittelgradig dilatiert', 'hochgradig dilatiert'] },
        { key: 'rv', label: 'RV Länge (PLAX)', reportLabel: 'RV Länge', type: 'number', unit: 'mm', decimals: 1, referenceRule: 'tte-rv-laenge', extractable: true },
        { key: 'rvd1', label: 'RVD1 basal', reportLabel: 'RVD1', type: 'number', unit: 'mm', decimals: 1, referenceRule: 'tte-rvd1', visibleIf: { cat: ['tte-rv-laenge', 'dilatiert'] } },
        { key: 'rvd2', label: 'RVD2 mittventrikulär', reportLabel: 'RVD2', type: 'number', unit: 'mm', decimals: 1, referenceRule: 'tte-rvd2', visibleIf: { cat: ['tte-rv-laenge', 'dilatiert'] } },
        {
          key: 'rv_diameter',
          label: 'RV-Größe',
          type: 'select',
          autoFrom: 'tte-rv-laenge',
          normal: 'normwertig',
          options: ['normwertig', 'dilatiert', 'leicht dilatiert', 'mittelgradig dilatiert', 'hochgradig dilatiert'],
        },
        { key: 'tapse', label: 'TAPSE', type: 'number', unit: 'mm', decimals: 1, referenceRule: 'tte-tapse', extractable: true },
        { key: 'tasv', label: 'TASV (S′)', reportLabel: 'TASV', type: 'number', unit: 'cm/s', decimals: 1, referenceRule: 'tte-tasv', extractable: true },
        {
          key: 'rv_funktion',
          label: 'RV-Funktion',
          type: 'select',
          autoFrom: 'tte-rv-funktion',
          normal: 'normal',
          options: [
            { value: 'normal', forms: { adj: 'normale' } },
            { value: 'eingeschränkt', forms: { adj: 'eingeschränkte' } },
          ],
          help: 'Automatisch aus TASV, wenn TAPSE und TASV eingegeben sind (TTE-R30-7).',
        },
        { key: 'tr_vmax', label: 'TR-Geschwindigkeit', reportLabel: 'TR Vmax', type: 'number', unit: 'm/s', decimals: 2, referenceRule: 'tte-hfpef-trv', extractable: true },
        { key: 'rvsp', label: 'sPAP (RVSP)', reportLabel: 'sPAP', type: 'number', unit: 'mmHg', decimals: 1, referenceRule: 'tte-hfpef-spap', extractable: true, help: 'Wert aus dem Echobefund; wird nicht berechnet (D-16).' },
        { key: 'pulm_hypertonie', label: 'Pulmonale Hypertonie', type: 'select', normal: 'kein Hinweis', options: ['kein Hinweis', 'Hinweis'] },
      ],
    },
    {
      key: 'ak',
      title: 'Aortenklappe',
      fields: [
        ...prosthesisFields('ak', 'Klappenprothesentyp'),
        { key: 'ak_taschen', label: 'Anatomie', type: 'select', normal: 'trikuspid', options: ['trikuspid', 'bikuspid', 'nicht bestimmbar'], visibleIf: nativ('ak') },
        { key: 'ak_sklerose', label: 'Sklerose', type: 'select', normal: 'zart', options: SKLEROSE, visibleIf: nativ('ak') },
        { key: 'ak_stenose', label: 'Stenose', reportLabel: 'Stenose', type: 'select', normal: 'keine', options: grades('leichtgradige'), visibleIf: nativ('ak') },
        { key: 'ak_vmax', label: 'Vmax', type: 'number', unit: 'm/s', decimals: 2, extractable: true },
        { key: 'ak_dp_max', label: 'dp max', type: 'number', unit: 'mmHg', decimals: 1, extractable: true },
        { key: 'ak_dp_mean', label: 'dp mean', type: 'number', unit: 'mmHg', decimals: 1, extractable: true },
        { key: 'ak_aoef', label: 'AÖF', type: 'number', unit: 'cm²', decimals: 2, extractable: true },
        { key: 'ak_insuffizienz', label: 'Insuffizienz', reportLabel: 'Insuffizienz', type: 'select', normal: 'keine', options: grades('leichte'), visibleIf: nativ('ak') },
        { key: 'ak_jet', label: 'Jetrichtung', type: 'select', options: ['klein zentral', 'zentral bis Mitte LV', 'zentral bis LV-Spitze', 'exzentrisch bis Mitte LV', 'exzentrisch bis LV-Spitze'], visibleIf: { in: ['ak_insuffizienz', AI_DETAILS] } },
        { key: 'ak_pht', label: 'PHT', type: 'number', unit: 'ms', decimals: 0, visibleIf: { in: ['ak_insuffizienz', AI_DETAILS] } },
        { key: 'ak_vc', label: 'Vena contracta', type: 'number', unit: 'mm', decimals: 1, visibleIf: { in: ['ak_insuffizienz', AI_DETAILS] } },
        { key: 'ak_jet_breite', label: 'Jet/LVOT-Breite', type: 'select', options: ['<30%', '30-50%', '>50%'], visibleIf: { in: ['ak_insuffizienz', AI_DETAILS] } },
        { key: 'ak_suprasternal', label: 'Aortic Flow', type: 'select', options: ['kein holodiastolischer Rückfluss', 'holodiastolischer Rückfluss'], visibleIf: { in: ['ak_insuffizienz', AI_DETAILS] } },
      ],
    },
    {
      key: 'mk',
      title: 'Mitralklappe',
      fields: [
        ...prosthesisFields('mk', 'Klappenprothesentyp'),
        { key: 'mk_segel', label: 'Segel', type: 'select', normal: 'zart', options: SKLEROSE, visibleIf: nativ('mk') },
        { key: 'mk_insuffizienz', label: 'Insuffizienz', reportLabel: 'Insuffizienz', type: 'select', normal: 'keine', options: grades('leichte'), visibleIf: nativ('mk') },
        { key: 'mk_jet', label: 'Jetrichtung', type: 'select', options: ['zentral', 'exzentrisch medial', 'exzentrisch lateral'], visibleIf: path('mk_insuffizienz') },
        { key: 'mk_mechanismus', label: 'Pathomechanismus', type: 'select', options: ['unbeurteilbar', 'Mitralklappenprolaps', 'Flail Leaflet', 'Tethering / Tenting', 'Großer Koaptationsdefekt / schweres Tenting'], allowNb: false, visibleIf: path('mk_insuffizienz') },
        { key: 'mk_konvergenzzone', label: 'PISA-Konvergenzzone', type: 'select', options: ['nicht groß', 'große holosystolische'], visibleIf: path('mk_insuffizienz') },
        { key: 'mk_e_welle_dominant', label: 'Mitralis-Einstrom', type: 'select', options: ['nicht E-dominant', 'E-Welle dominant (>1.2 m/s)'], visibleIf: path('mk_insuffizienz') },
        { key: 'mk_vc', label: 'Vena contracta', type: 'number', unit: 'mm', decimals: 1, visibleIf: path('mk_insuffizienz') },
        { key: 'mk_pisa', label: 'PISA-Radius', type: 'number', unit: 'mm', decimals: 1, visibleIf: path('mk_insuffizienz') },
        { key: 'mk_eroa', label: 'EROA', type: 'number', unit: 'cm²', decimals: 2, visibleIf: path('mk_insuffizienz') },
        { key: 'mk_stenose', label: 'Stenose', reportLabel: 'Stenose', type: 'select', normal: 'keine', options: grades('leichte'), visibleIf: nativ('mk') },
        { key: 'mk_dp_max', label: 'dp max', type: 'number', unit: 'mmHg', decimals: 1, visibleIf: { any: [path('mk_stenose'), prothese('mk')] } },
        { key: 'mk_dp_mean', label: 'dp mean', type: 'number', unit: 'mmHg', decimals: 1, visibleIf: { any: [path('mk_stenose'), prothese('mk')] } },
      ],
    },
    {
      key: 'tk',
      title: 'Trikuspidal- und Pulmonalklappe',
      fields: [
        ...prosthesisFields('tk', 'Prothesentyp'),
        { key: 'tk_segel', label: 'Segel', type: 'select', normal: 'zart', options: SKLEROSE, visibleIf: nativ('tk') },
        { key: 'tk_insuffizienz', label: 'Insuffizienz (TI)', reportLabel: 'Insuffizienz', type: 'select', normal: 'physiologisch', options: TR_GRADES, visibleIf: nativ('tk'), help: 'Grad ärztlich festgelegt; Kriterientabelle Hahn & Zamorano 2017 (TTE-R40).' },
        { key: 'tk_vc', label: 'Vena contracta', type: 'number', unit: 'mm', decimals: 1, visibleIf: nativ('tk') },
        { key: 'tk_eroa', label: 'EROA (PISA)', type: 'number', unit: 'mm²', decimals: 0, visibleIf: nativ('tk') },
        { key: 'tk_jet', label: 'Jet', type: 'select', options: ['zentral', 'exzentrisch medial', 'exzentrisch lateral'], visibleIf: path('tk_insuffizienz', ['keine', 'physiologisch']) },
        { key: 'tk_stenose', label: 'Stenose', reportLabel: 'Stenose', type: 'select', normal: 'keine', options: grades('leichte'), visibleIf: nativ('tk') },
        { key: 'tk_dp_max', label: 'dp max', type: 'number', unit: 'mmHg', decimals: 1, visibleIf: { any: [path('tk_stenose'), prothese('tk')] } },
        { key: 'tk_dp_mean', label: 'dp mean', type: 'number', unit: 'mmHg', decimals: 1, visibleIf: { any: [path('tk_stenose'), prothese('tk')] } },
        { key: 'pk_funktion', label: 'Pulmonalklappe', type: 'select', normal: 'normal', options: ['normal', 'leichte Insuffizienz', 'mittelgradige Insuffizienz', 'hochgradige Insuffizienz'] },
      ],
    },
    {
      key: 'aorta',
      title: 'Aorta, V. cava inferior, Perikard',
      fields: [
        { key: 'aortenwurzel', label: 'Aortenwurzel', type: 'number', unit: 'mm', decimals: 1, extractable: true },
        { key: 'aorta_ascendens_val', label: 'Aorta ascendens', type: 'number', unit: 'mm', decimals: 1, referenceRule: 'tte-aorta-asc', extractable: true },
        { key: 'aorta_ascendens', label: 'Aorta ascendens (Beurteilung)', type: 'select', autoFrom: 'tte-aorta-asc', normal: 'normwertig', options: ['normwertig', 'dilatiert'] },
        { key: 'vci', label: 'VCI', type: 'number', unit: 'mm', decimals: 1, referenceRule: 'tte-vci', extractable: true },
        { key: 'vci_kollaps', label: 'Atemabhängige Kaliberschwankung', reportLabel: 'Atemabhängige Kaliberschwankung der V. cava inferior', type: 'select', options: ['> 50 %', '< 50 %'] },
        { key: 'perikarderguss', label: 'Perikarderguss', type: 'select', normal: 'kein Perikarderguss', options: ['kein Perikarderguss', 'geringer Perikarderguss', 'mittelgroßer Perikarderguss', 'großer Perikarderguss'] },
        { key: 'perikard_text', label: 'Ergussbeschreibung', type: 'text', visibleIf: path('perikarderguss', ['kein Perikarderguss']) },
        { key: 'herzhoehlen', label: 'Kompression', type: 'select', options: ['Herzhöhlen entfaltet', 'RA komprimiert', 'RV komprimiert', 'LV komprimiert'], visibleIf: path('perikarderguss', ['kein Perikarderguss']) },
        { key: 'relevanz', label: 'Hämodynamik', type: 'select', options: ['keine hämodynamische Relevanz', 'beginnende hämodynamische Relevanz', 'Swinging Heart Zeichen'], visibleIf: path('perikarderguss', ['kein Perikarderguss']) },
      ],
    },
    {
      key: 'bio',
      title: 'Laborchemische Biomarker',
      fields: [
        { key: 'nt_probnp', label: 'NT-proBNP', type: 'number', unit: 'pg/ml', decimals: 1, referenceRule: 'tte-ntprobnp', extractable: true },
        { key: 'bnp', label: 'BNP', type: 'number', unit: 'pg/ml', decimals: 1, referenceRule: 'tte-bnp', extractable: true },
      ],
    },
  ],

  derived: [
    // ESC 2026 HF guideline Table 10: six echo measurements; text only with ≥ 4 entered (D-65 n).
    { key: 'hfpef_inputs', label: 'HFpEF-Messwerte eingegeben', source: 'ESC 2026 HF, Tabelle 10; D-65 n', kind: 'countFilled', fields: ['lvmi', 'rwt', 'laesvi', 'e_e_prime', 'rvsp', 'tr_vmax'] },
    // ESC 2026 HF guideline Table 10: number of fulfilled criteria R20-1 … R20-4 (0–4).
    { key: 'hfpef_count', label: 'HFpEF-Kriterien erfüllt', source: 'ESC 2026 HF, Tabelle 10 (SPEC-textgen TTE-R20.1)', kind: 'countTrue', items: HFPEF_ITEMS },
    // Pieske 2019 cut-offs: elevated if NT-proBNP or BNP above the rhythm-specific cut-off (TTE-R20.2).
    { key: 'peptide_elevated', label: 'Natriuretisches Peptid erhöht', source: 'Pieske et al. 2019 (SPEC-textgen TTE-R20.2)', kind: 'countTrue', items: [{ label: 'NT-proBNP erhöht', when: { cat: ['tte-ntprobnp', 'erhöht'] } }, { label: 'BNP erhöht', when: { cat: ['tte-bnp', 'erhöht'] } }] },
  ],

  displays: [
    {
      section: 'diastole',
      label: 'HFpEF-Kriterien (ESC 2026, Tabelle 10)',
      template: '{hfpef_count} von 4 erfüllt · Messwerte {hfpef_inputs} von 6 (mind. 4 für den Befundtext)',
      details: [...HFPEF_ITEMS, { label: 'Natriuretisches Peptid erhöht (Pieske 2019)', when: { gte: ['peptide_elevated', 1] } }],
      inputs: ['lvmi', 'rwt', 'laesvi', 'e_e_prime', 'rvsp', 'tr_vmax', 'nt_probnp', 'bnp'],
    },
  ],

  tables: [
    {
      section: 'tk',
      title: 'Kriterien Trikuspidalinsuffizienz (Hahn & Zamorano 2017)',
      source: 'Hahn RT, Zamorano JL. Eur Heart J Cardiovasc Imaging 2017;18:1342–1343, Tabelle 1',
      columns: ['I leicht', 'II mittelgradig', 'III hochgradig', 'IV massiv', 'V torrentiell'],
      rows: [
        { label: 'VC (biplan)', field: 'tk_vc', rule: 'tte-tr-vc', cells: ['< 3 mm', '3–6,9 mm', '7–13 mm', '14–20 mm', '≥ 21 mm'] },
        { label: 'EROA (PISA)', field: 'tk_eroa', rule: 'tte-tr-eroa', cells: ['< 20 mm²', '20–39 mm²', '40–59 mm²', '60–79 mm²', '≥ 80 mm²'] },
        { label: '3D VCA / quant. EROA', cells: ['—', '—', '75–94 mm²', '95–114 mm²', '≥ 115 mm²'] },
      ],
    },
  ],

  report: {
    title: 'Transthorakale Echokardiographie:',
    head: [
      {
        id: 'kopf',
        lines: [
          {
            id: 'indikation',
            label: 'Indikation:',
            items: [
              {
                id: 'kopf.indikation',
                choose: [
                  { id: 'a', when: { eq: ['indication', 'Sonstige (Freitext)'] }, text: '{indication_text}' },
                  { id: 'b', when: { not: { eq: ['indication', 'Sonstige (Freitext)'] } }, text: '{indication}' },
                ],
              },
            ],
          },
          { id: 'rhythmus', label: 'Rhythmus:', items: [{ id: 'kopf.rhythmus', text: '{rhythm}' }] },
        ],
      },
    ],
    measurementsHeading: 'Messwerte:',
    // TTE-M (D-23, D-69 d)
    measurements: [
      { label: 'Linker Ventrikel:', fields: ['lvedd', 'lvesd', 'ivsd', 'pwd', 'lvef', 'lvmi', 'rwt', 'gls'] },
      { label: 'Diastolische Funktion:', fields: ['mitral_e', 'mitral_a', 'e_a_ratio', 'e_prime_septal', 'e_prime_lateral', 'e_e_prime'] },
      { label: 'Vorhöfe / rechter Ventrikel:', fields: ['la', 'laesvi', 'rv', 'rvd1', 'rvd2', 'tapse', 'tasv', 'tr_vmax', 'rvsp'] },
      { label: 'Aorta / VCI:', fields: ['aortenwurzel', 'aorta_ascendens_val', 'vci'] },
      { label: 'Biomarker:', fields: ['nt_probnp', 'bnp'] },
    ],
    body: [
      {
        id: 'befund',
        heading: 'BEFUND:',
        lines: [
          {
            id: 'lv',
            label: 'Linker Ventrikel:',
            items: [
              {
                id: 'lv.groesse',
                choose: [
                  { id: 'a', when: { all: [{ eq: ['lvedd_dim', 'normal dimensioniert'] }, { eq: ['lvesd_dim', 'normal dimensioniert'] }] }, text: 'Der linke Ventrikel ist normal dimensioniert.' },
                  { id: 'b', text: 'Der LVEDD ist {lvedd_dim}, der LVESD ist {lvesd_dim}.' },
                  { id: 'c', text: 'Der LVEDD ist {lvedd_dim}.' },
                  { id: 'd', text: 'Der LVESD ist {lvesd_dim}.' },
                ],
              },
              {
                id: 'lv.wand', // TTE-R30-4b (D-68)
                choose: [
                  { id: 'a', text: 'Das Septum ist {cat:tte-ivsd}, die Hinterwand ist {cat:tte-pwd}.' },
                  { id: 'b', text: 'Das Septum ist {cat:tte-ivsd}.' },
                  { id: 'c', text: 'Die Hinterwand ist {cat:tte-pwd}.' },
                ],
              },
              { id: 'lv.lvef', text: 'Die globale systolische Pumpfunktion ist {cat:tte-lvef}.' },
              {
                id: 'lv.kinetik',
                choose: [
                  { id: 'a', when: { eq: ['lv_kinetik', 'regionale Wandbewegungsstörungen'] }, text: 'Regionale Wandbewegungsstörungen[: {lv_kinetik_text}].' },
                  { id: 'b', when: { eq: ['lv_kinetik', 'globale Hypokinesie'] }, text: 'Es zeigt sich eine globale Hypokinesie.' },
                  { id: 'c', when: { eq: ['lv_kinetik', 'keine Kinetikstörungen'] }, text: 'Es zeigen sich keine regionalen Wandbewegungsstörungen.' },
                  { id: 'd', when: { eq: ['lv_kinetik', NB] }, text: 'Die Wandbewegung ist nicht beurteilbar.' },
                ],
              },
              {
                id: 'lv.gls', // TTE-T04
                choose: [
                  { id: 'a', when: { all: [{ in: ['indication', CHEMO] }, { filled: 'gls' }] }, text: 'Der globale longitudinale Strain (GLS) beträgt {gls} %.' },
                  { id: 'b', when: { all: [{ in: ['indication', CHEMO] }, { eq: ['schallbedingungen', 'mäßig'] }] }, text: 'Aufgrund der mäßigen Schallbedingungen war die Bestimmung der GLS unmöglich.' },
                  { id: 'c', when: { all: [{ in: ['indication', CHEMO] }, { eq: ['schallbedingungen', 'deutlich eingeschränkt'] }] }, text: 'Aufgrund der deutlich eingeschränkten Schallbedingungen war die Bestimmung der GLS unmöglich.' },
                ],
              },
              // TTE-R20.3 (D-65): count line and conclusion; CLAUDE.md rule 5 exception, editable and removable.
              { id: 'lv.hfpef.anzahl', when: HFPEF_BASE, text: '{hfpef_count} von 4 Kriterien für eine HFpEF sind erfüllt.' },
              {
                id: 'lv.hfpef.schluss',
                choose: [
                  { id: 'a', when: { all: [HFPEF_CONCLUSION, { gte: ['hfpef_count', 1] }, { gte: ['peptide_elevated', 1] }] }, text: 'Hinweis auf eine HFpEF.' },
                  { id: 'b', when: { all: [HFPEF_CONCLUSION, { gte: ['hfpef_count', 1] }] }, text: 'Hinweis auf eine diastolische Dysfunktion.' },
                  { id: 'c', when: { all: [HFPEF_CONCLUSION, { lt: ['hfpef_count', 1] }] }, text: 'Kein Hinweis auf eine HFpEF.' },
                ],
              },
            ],
          },
          {
            id: 'vorhoefe',
            label: 'Vorhöfe und Rechter Ventrikel:',
            items: [
              { id: 'vh.la', text: 'Der linke Vorhof ist {la_diameter_qualitativ}.' },
              { id: 'vh.ra', text: 'Der rechte Vorhof ist {ra_diameter}.' },
              {
                id: 'vh.rv', // TTE-R30-6 / 6b (D-70)
                text: ['Der rechte Ventrikel ist {rv_diameter}', { join: '; ', before: ' (', after: ')', items: ['RVD1 {rvd1} mm, {cat:tte-rvd1}', 'RVD2 {rvd2} mm, {cat:tte-rvd2}'] }, '.'],
              },
              { id: 'vh.rvf', text: 'Die rechtsventrikuläre systolische Funktion ist {rv_funktion}.' }, // TTE-R30-7
              {
                id: 'vh.ph',
                choose: [
                  { id: 'a', when: { eq: ['pulm_hypertonie', 'Hinweis'] }, text: 'Es besteht ein indirekter Hinweis auf eine pulmonale Hypertonie[ (sPAP {rvsp} mmHg)].' },
                  { id: 'b', when: { eq: ['pulm_hypertonie', 'kein Hinweis'] }, text: 'Es besteht kein Hinweis auf eine pulmonale Hypertonie.' },
                ],
              },
              { nb: ['pulm_hypertonie'] },
            ],
          },
        ],
      },
      {
        id: 'klappen',
        heading: 'Klappenbefund:',
        lines: [
          {
            id: 'ak',
            label: 'Aortenklappe:',
            items: [
              prosthesisSentence('ak', ['Vmax {ak_vmax} m/s', dpAlternatives('ak'), 'AÖF {ak_aoef} cm²']),
              { id: 'ak.prothese_text', when: prothese('ak'), text: '{ak_prothese_text}' },
              {
                id: 'ak.morphologie',
                choose: [
                  { id: 'a', text: 'Die Aortenklappe ist {ak_taschen}, die Taschen sind {ak_sklerose}.' },
                  { id: 'b', text: 'Die Aortenklappe ist {ak_taschen}.' },
                  { id: 'c', text: 'Die Taschen sind {ak_sklerose}.' },
                ],
              },
              {
                id: 'ak.stenose',
                when: path('ak_stenose'),
                text: ['Es liegt eine {ak_stenose} Aortenstenose vor', { join: '; ', before: ' (', after: ')', items: ['Vmax {ak_vmax} m/s', dpAlternatives('ak'), 'AÖF {ak_aoef} cm²'] }, '.'],
              },
              {
                id: 'ak.insuffizienz',
                when: path('ak_insuffizienz'),
                text: ['Es besteht eine {ak_insuffizienz} Aortenklappeninsuffizienz', { join: '; ', before: ' (', after: ')', items: ['Jet: {ak_jet}', 'PHT {ak_pht} ms', 'VC {ak_vc} mm', 'Jet/LVOT {ak_jet_breite}', '{ak_suprasternal}'] }, '.'],
              },
              { id: 'ak.unauffaellig', when: { all: [{ eq: ['ak_stenose', 'keine'] }, { eq: ['ak_insuffizienz', 'keine'] }] }, text: 'Hämodynamisch zeigt sich keine relevante Pathologie.' },
              { nb: ['ak_stenose', 'ak_insuffizienz'] },
            ],
          },
          {
            id: 'mk',
            label: 'Mitralklappe:',
            items: [
              prosthesisSentence('mk', ['dp mean {mk_dp_mean} mmHg']),
              { id: 'mk.prothese_text', when: prothese('mk'), text: '{mk_prothese_text}' },
              { id: 'mk.segel', text: 'Die Mitralklappensegel sind {mk_segel}.' },
              {
                id: 'mk.insuffizienz',
                when: path('mk_insuffizienz'),
                text: ['Es zeigt sich eine {mk_insuffizienz} Mitralklappeninsuffizienz', { join: '; ', before: ' (', after: ')', items: ['Jet: {mk_jet}', 'Mechanismus: {mk_mechanismus}', 'Konvergenzzone: {mk_konvergenzzone}', 'Mitralis-Einstrom: {mk_e_welle_dominant}', 'VC {mk_vc} mm', 'PISA-Radius {mk_pisa} mm', 'EROA {mk_eroa} cm²'] }, '.'],
              },
              {
                id: 'mk.stenose',
                when: path('mk_stenose'),
                text: ['Es liegt eine {mk_stenose} Mitralklappenstenose vor', { join: '; ', before: ' (', after: ')', items: [dpAlternatives('mk')] }, '.'],
              },
              { id: 'mk.unauffaellig', when: { all: [{ eq: ['mk_stenose', 'keine'] }, { eq: ['mk_insuffizienz', 'keine'] }] }, text: 'Keine hämodynamisch relevante Stenose oder Insuffizienz.' },
              { nb: ['mk_insuffizienz', 'mk_stenose'] },
            ],
          },
          {
            id: 'tk',
            label: 'Trikuspidalklappe:',
            items: [
              prosthesisSentence('tk', ['dp mean {tk_dp_mean} mmHg']),
              { id: 'tk.prothese_text', when: prothese('tk'), text: '{tk_prothese_text}' },
              { id: 'tk.segel', text: 'Die Segel sind {tk_segel}.' },
              {
                id: 'tk.insuffizienz',
                when: path('tk_insuffizienz', ['keine', 'physiologisch']),
                text: ['Es besteht eine {tk_insuffizienz} Trikuspidalklappeninsuffizienz', { join: '; ', before: ' (', after: ')', items: ['Jet: {tk_jet}', 'VC {tk_vc} mm', 'EROA {tk_eroa} mm²'] }, '.'],
              },
              { id: 'tk.unauffaellig', when: { in: ['tk_insuffizienz', ['keine', 'physiologisch']] }, text: 'Keine hämodynamisch relevante Insuffizienz.' },
              {
                id: 'tk.stenose',
                when: path('tk_stenose'),
                text: ['Es liegt eine {tk_stenose} Trikuspidalklappenstenose vor', { join: '; ', before: ' (', after: ')', items: [dpAlternatives('tk')] }, '.'],
              },
              { nb: ['tk_insuffizienz', 'tk_stenose'] },
            ],
          },
          {
            id: 'pk',
            label: 'Pulmonalklappe:',
            items: [
              {
                id: 'pk.funktion',
                choose: [
                  { id: 'a', when: { eq: ['pk_funktion', 'normal'] }, text: 'Die Funktion ist normal.' },
                  { id: 'b', when: { eq: ['pk_funktion', NB] }, text: 'Die Pulmonalklappe ist nicht beurteilbar.' },
                  { id: 'c', text: 'Es besteht eine {pk_funktion}.' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'aorta_perikard',
        lines: [
          {
            id: 'aorta',
            label: 'Aorta und Perikard:',
            items: [
              { id: 'ao.ascendens', text: 'Die Aorta ascendens ist {aorta_ascendens}.' },
              {
                id: 'ao.perikard',
                choose: [
                  { id: 'a', when: { eq: ['perikarderguss', 'kein Perikarderguss'] }, text: 'Kein Perikarderguss.' },
                  { id: 'b', when: path('perikarderguss', ['kein Perikarderguss']), text: ['Es zeigt sich ein {perikarderguss}.', '[ {perikard_text}]', '[ Herzhöhlen: {herzhoehlen}.]', '[ Hämodynamik: {relevanz}.]'] },
                ],
              },
              {
                id: 'ao.vci', // TTE-R30-8 (D-16)
                choose: [
                  { id: 'a', when: path('vci_kollaps', []), text: 'Die V. cava inferior ist {cat:tte-vci} ({vci} mm) mit atemabhängiger Kaliberschwankung {vci_kollaps}.' },
                  { id: 'b', text: 'Die V. cava inferior ist {cat:tte-vci} ({vci} mm).' },
                  { id: 'c', when: path('vci_kollaps', []), text: 'Die V. cava inferior zeigt eine atemabhängige Kaliberschwankung {vci_kollaps}.' },
                ],
              },
              { nb: ['perikarderguss', 'vci_kollaps'] },
            ],
          },
        ],
      },
      {
        id: 'zusammenfassung',
        heading: 'Zusammenfassung:',
        lines: [
          {
            id: 'zusammenfassung',
            fragments: true, // TTE-S
            items: [
              {
                id: 'zf.schall',
                choose: [
                  { id: 'a', when: { eq: ['schallbedingungen', 'mäßig'] }, text: 'mäßige Schallbedingungen' },
                  { id: 'b', when: { eq: ['schallbedingungen', 'deutlich eingeschränkt'] }, text: 'deutlich eingeschränkte Schallbedingungen' },
                ],
              },
              {
                id: 'zf.funktion',
                choose: [
                  { id: 'a', when: { all: [{ cat: ['tte-lvef', 'normal'] }, { eq: ['rv_funktion', 'normal'] }] }, text: 'normale biventrikuläre Pumpfunktion (LVEF {lvef} %)' },
                  { id: 'b', text: '{cat:tte-lvef:adj} LV-Funktion (LVEF {lvef} %)' },
                ],
              },
              { id: 'zf.rv', when: { eq: ['rv_funktion', 'eingeschränkt'] }, text: 'eingeschränkte RV-Funktion' },
              {
                id: 'zf.hfpef',
                choose: [
                  { id: 'a', when: { all: [HFPEF_CONCLUSION, { gte: ['hfpef_count', 1] }, { gte: ['peptide_elevated', 1] }] }, text: 'Hinweis auf eine HFpEF' },
                  { id: 'b', when: { all: [HFPEF_CONCLUSION, { gte: ['hfpef_count', 1] }] }, text: 'Hinweis auf eine diastolische Dysfunktion' },
                  { id: 'c', when: { all: [HFPEF_CONCLUSION, { lt: ['hfpef_count', 1] }] }, text: 'kein Hinweis auf eine HFpEF' },
                ],
              },
              { id: 'zf.la', when: path('la_diameter_qualitativ', ['normal dimensioniert']), text: 'LA-Dilatation' },
              // D-74: sPAP ≥ 35 mmHg → summary fragment (single-value rule tte-ph-zusammenfassung).
              { id: 'zf.ph', when: { cat: ['tte-ph-zusammenfassung', 'Hinweis auf eine pulmonale Hypertonie in Ruhe'] }, text: '{cat:tte-ph-zusammenfassung} (sPAP {rvsp} mmHg)' },
              { id: 'zf.ai', when: path('ak_insuffizienz'), text: 'AI {ak_insuffizienz:short}' },
              { id: 'zf.mi', when: path('mk_insuffizienz'), text: 'MI {mk_insuffizienz:short}' },
              { id: 'zf.ti', when: path('tk_insuffizienz', ['keine', 'physiologisch']), text: 'TI {tk_insuffizienz:short}' },
              { id: 'zf.ms', when: path('mk_stenose'), text: 'MS {mk_stenose:short}' },
              { id: 'zf.as', when: path('ak_stenose'), text: 'AS {ak_stenose:short}[, AÖF {ak_aoef} cm²]' },
              // D-74: prostheses in the summary (wording DRAFT).
              { id: 'zf.ak_prothese', when: prothese('ak'), text: ['Z. n. Aortenklappenersatz', { join: '; ', before: ' (', after: ')', items: ['{ak_prothese_typ}', '{ak_prothese_funktion}'] }] },
              { id: 'zf.mk_prothese', when: prothese('mk'), text: ['Z. n. Mitralklappenersatz', { join: '; ', before: ' (', after: ')', items: ['{mk_prothese_typ}', '{mk_prothese_funktion}'] }] },
              { id: 'zf.tk_prothese', when: prothese('tk'), text: ['Z. n. Trikuspidalklappenersatz', { join: '; ', before: ' (', after: ')', items: ['{tk_prothese_typ}', '{tk_prothese_funktion}'] }] },
              {
                id: 'zf.perikard',
                choose: [
                  { id: 'a', when: { eq: ['perikarderguss', 'kein Perikarderguss'] }, text: 'kein Perikarderguss' },
                  { id: 'b', when: path('perikarderguss', ['kein Perikarderguss']), text: '{perikarderguss}[ ({relevanz})]' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'empfehlung',
        heading: 'Empfehlung:',
        lines: [{ id: 'empfehlung', library: true, items: [] }],
      },
    ],
  },
};
