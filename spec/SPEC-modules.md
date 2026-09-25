# SPEC-modules — Module specifications

Status: **Draft v0.1 (Session 1, audit only)**. Every statement describes the
prototype as found (commit hashes below). Nothing has been corrected; ⚠ marks
a flag. Rule IDs (`TTE-R…`, `TEE-T…`, …) point to SPEC-textgen.md; `D-xx`
points to SPEC-decisions.md.

> **Structure note.** The brief says to mirror `spec/SPEC-carotis.md`. That
> file does not exist in the repository (the repo was empty at session start,
> and there was no CLAUDE.md either — D-02). Every module below uses the same
> structure: **1 Scope & source · 2 Technical profile · 3 Model usage ·
> 4 Fields · 5 Derived values · 6 Report order & layout · 7 Normal ranges &
> highlight bands · 8 Flags**. I will re-map it once SPEC-carotis.md exists.

Field-table columns: **ID** (prototype id) · **Label** (German, as shown) ·
**Type** · **Unit** · **Allowed values** · **Default** · **Notes**.
"–" = none. Dropdowns labelled "Auswählen…" in the UI start as `null`.

---

# TTE — Transthorakale Echokardiographie

## TTE-1 Scope & source

- Repo `rady3000/TTE_V2026`, HEAD `df72c6d` (2026-09-23), earlier `d1086cb` (2026-03-10).
- Files: `index.html` (1134 lines, all markup and dropdown options), `index.tsx` (1139 lines, all logic).
- UI title: "Echokardiographie-Befundarbeitsplatz — Befundmaske & HF-PEFF Score Diagnostik-Modul".

## TTE-2 Technical profile

| Aspect | Finding |
|---|---|
| Framework | **Not React.** Vanilla TypeScript that manipulates the DOM directly (`document.getElementById`, custom dropdowns built from `<a>` elements). Vite 6 build. |
| Styling | Tailwind v4 (`@tailwindcss/vite`), Google Fonts (Inter, JetBrains Mono) from CDN. |
| Dependencies | `@google/genai` **"latest"** (unpinned) — also loaded through an importmap from `esm.run`, so there are two sources for the same package; `jspdf` ^4.2, `jspdf-autotable` ^5.0. |
| State | A `state` object keyed by dropdown `data-id`, whose values are **the display strings themselves** (e.g. `"leichtgradig"`); report wording is coupled to UI labels. Numeric values are read back from DOM inputs on each use. |
| Persistence | None. |
| Secrets | `GEMINI_API_KEY` is inlined into the client bundle through `vite.config.ts` `define`. `.env.example` has an empty value. |
| Tests | None. `npm run lint` = `tsc --noEmit`. |
| Quality | **2 / 5** — a single-file script; threshold logic duplicated three times (text, highlight, score); clinical text built by string concatenation, with grammar bugs; deprecated `execCommand('copy')`. |

## TTE-3 Model usage ⚠ (report prominently)

| Item | Finding |
|---|---|
| Model | `gemini-3.8-flash` (HEAD); `gemini-3-flash-preview` in `d1086cb`. Called **from the browser**. |
| Trigger | Button "Extraktion starten" after choosing a file (`accept="image/*,application/pdf"`). |
| Sent | The whole uploaded file (image or PDF) as base64 `inlineData` + the German prompt (verbatim in SPEC-textgen §X-1). Whatever the document contains — including patient identifiers — goes to Google (D-06). |
| Config | `responseMimeType: 'application/json'`. No schema object, no temperature setting. |
| Returned | JSON object; each key → `{ value: number, unit: string }`. Keys: `ivsd, lvedd, lvesd, lvef, la, rv, tapse, tasv, rvsp, laesvi, mitral_e, mitral_a, e_a_ratio, e_e_prime, aortenwurzel, aorta_ascendens_val, vci, gls, tr_max_pg, av_vmax, av_max_pg, av_mean_pg, av_area, rwt, lvmi, bnp, nt_probnp`. |
| Post-processing | Deterministic (SPEC-textgen §X-2): unit conversion, RVSP derivation, the AV fields merged into `ak_dp`. |
| **Clinical wording from the model?** | **No.** The model returns only numbers and units. All report text comes from code. ✅ Complies with the extraction-only design. |
| Deviations to note | (a) Values are written straight into the fields with no "unconfirmed" marking; only a count is shown ("{n} Felder wurden erfolgreich ausgefüllt und ausgewertet."). (b) The prompt asks the model to **convert** TASV from m/s to cm/s — a calculation delegated to the model, and the code then applies its own conversion again (risk of converting twice, see TEXTGEN X-2). (c) The prompt contains clinically wrong mappings (see TTE-8 F-03). (d) The key is exposed in the client. |

## TTE-4 Fields

### 4.1 Patientendaten & Bedingungen

| ID | Label | Type | Unit | Allowed values | Default | Notes |
|---|---|---|---|---|---|---|
| `patientInfo` | Patient | text | – | free ("Name, Vorname, Geburtsdatum...") | – | PDF only |
| `queryDate` | Datum der Untersuchung | date | – | – | today | PDF only |
| `gender` | Geschlecht | dropdown | – | weiblich, männlich | **weiblich** | drives LVEF/IVSd/LVEDD/LVESD/LVMI cut-offs |
| `indication` | Klinische Indikation | dropdown | – | Status präsens, Myokardinfarkt, Dyspnoe, Synkope, Schwindel / Präsynkope, Angina pectoris, vor Chemotherapie | Status präsens | "vor Chemotherapie" turns on the GLS rules and a red GLS highlight |
| `rhythm` | EKG Rhythmus | dropdown | – | Sinusrhythmus, VHF / Vorhofflattern, AV-Block III | Sinusrhythmus | "VHF / Vorhofflattern" switches the biomarker cut-offs |
| `schallbedingungen` | Schallbedingungen | dropdown | – | gut, mäßig, deutlich eingeschränkt | gut | |

### 4.2 Quantitative Messwerte (all `type=number`, empty = not measured)

| ID | Label | Unit | Step | Report name | Notes |
|---|---|---|---|---|---|
| `ivsd` | IVSd | mm | 1 | IVSd | |
| `lvedd` | LVEDD | mm | 1 | LVEDD | |
| `lvesd` | LVESD | mm | 1 | LVESD | |
| `lvef` | LVEF | % | 1 | LVEF | |
| `rwt` | RWT | – | 0.01 | RWT | |
| `lvmi` | LVMI | g/m² | 1 | LVMI | |
| `gls` | 2D-GLS | % | 0.1 | 2D-GLS | sign ignored (`abs`) |
| `mitral_e` | Mitral E | m/s | 0.01 | Mitral E | |
| `mitral_a` | Mitral A | m/s | 0.01 | Mitral A | |
| `e_a_ratio` | E/A Verhältn. | – | 0.1 | E/A Verhältnis | ⚠ entered separately, not computed from E and A |
| `e_e_prime` | E/E' | – | 0.1 | E/E' | ⚠ average vs septal not defined (D-10) |
| `la` | LA | mm | 1 | LA | |
| `laesvi` | LAESVI | ml/m² | 1 | LAESVI | used as LAVI in the score |
| `rv` | RV | mm | 1 | RV | ⚠ which RV dimension is meant is unclear (D-21) |
| `tapse` | TAPSE | mm | 1 | TAPSE | |
| `tasv` | TASV | cm/s | 1 | TASV | = tricuspid annular S' (TDI) |
| `rvsp` | RVSP | mmHg | 1 | RVSP | can be derived (TTE-5) |
| `aortenwurzel` | Aortenwurzel | ⚠ no unit shown in UI | 1 | Aortenwurzel … mm | |
| `aorta_ascendens_val` | Aorta asc. | ⚠ no unit shown in UI | 1 | Aorta ascendens … mm | |
| `vci` | VCI | mm | 1 | VCI | |
| `bnp` | BNP | pg/ml | 1 | BNP | |
| `nt_probnp` | NT-proBNP | ⚠ no unit in UI | 1 | NT-proBNP … pg/ml | |

Report measurement list order (the `measurements` array): IVSd, LVEDD, LVESD,
LVEF, LA, RV, TAPSE, TASV, RVSP, LAESVI, Mitral E, Mitral A, E/A Verhältnis,
E/E', Aortenwurzel, Aorta ascendens, VCI, 2D-GLS, RWT, LVMI, BNP, NT-proBNP.

### 4.3 Qualitative Beurteilungen — Linker Ventrikel

| ID | Label | Allowed values | Default |
|---|---|---|---|
| `lvedd_dim` | LVEDD Dimension | normal dimensioniert, leicht dilatiert, mittelgradig dilatiert, hochgradig dilatiert | null |
| `lvesd_dim` | LVESD Dimension | same as above | null |
| `lv_kinetik` | Kinetik / Motilität | keine Kinetikstörungen, globale Hypokinesie, regionale Wandbewegungsstörungen | null |
| (textarea) | Lokalisierte Wandbewegungsstörung spezifizieren | free text; shown only when "regionale Wandbewegungsstörungen" is chosen | – |
| `diastole` | Diastolische Dysfunktion | kein Hinweis auf diastolische Dysfunktion, Hinweis auf diastolische Dysfunktion | null ⚠ overwritten by the score on "generieren" |

### 4.4 Rechter Ventrikel & Vorhöfe

| ID | Label | Allowed values | Default | Fallback in text if null |
|---|---|---|---|---|
| `la_diameter_qualitativ` | LA Diameter (qualitativ) | normal dimensioniert, leichtgradig dilatiert, mittelgradig dilatiert, hochgradig dilatiert | null | "nicht beurteilt" |
| `ra_diameter` | RA Diameter (qualitativ) | normwertig, leicht dilatiert, mittelgradig dilatiert, hochgradig dilatiert | null | ⚠ "normwertig" |
| `rv_diameter` | RV Diameter (qualitativ) | same as RA | null | ⚠ "normwertig" |
| `rv_funktion` | RV-Systolische Funktion | normal, leicht reduziert, mittelgradig reduziert, hochgradig reduziert | null | ⚠ "normal" |
| `pulm_hypertonie` | Pulmonale Hypertonie | kein Hinweis, Hinweis | null | "kein Hinweis" branch |

### 4.5 Aortenklappe

| ID | Label | Type | Unit | Allowed values | Default | Output? |
|---|---|---|---|---|---|---|
| `ak_prothese` | Prothese | dropdown | – | Ja, Nein | Nein | yes |
| (input) | Spezifischer Klappenprothesentyp | text | – | free | – | yes, if Ja |
| `ak_sklerose` | Sklerose | dropdown | – | zart, leicht sklerosiert, mäßig sklerosiert, schwer sklerosiert | null (fallback "zart") | yes |
| `ak_taschen` | Anatomie | dropdown | – | trikuspid, bikuspid, nicht bestimmbar | null (fallback "trikuspid") | yes |
| `ak_stenose` | Stenose | dropdown | – | keine, leichtgradig, mittelgradig, hochgradig | null | yes |
| `ak_vmax` | Vmax | number 0.1 | m/s | – | – | yes |
| `ak_dp` | dp max/mean | text | mmHg | "max/mean", e.g. "40/25" | – | yes |
| `ak_aoef` | AÖF nach KG | number 0.1 | cm² | – | – | yes (only with a stenosis) |
| `ak_insuffizienz` | Aortenklappeninsuffizienz | dropdown | – | keine, leichte, mittelgradige, hochgradige | null | yes |
| `ak_jet` | Jetrichtung | dropdown | – | klein zentral, zentral bis Mitte LV, zentral bis LV-Spitze, exzentrisch bis Mitte LV, exzentrisch bis LV-Spitze | null | yes |
| `ak_jet_breite` | Jet/LVOT Breite | dropdown | – | <30%, 30-50%, >50% | null | ⚠ **never output** |
| `ak_pht` | PHT | number | ms | – | – | yes |
| `ak_suprasternal` | Aortic Flow | dropdown | – | kein holodiast. Rückfluss, holodiast. Rückfluss | null | ⚠ **never output** |

The AI detail block is visible only for "mittelgradige"/"hochgradige".

### 4.6 Mitralklappe

| ID | Label | Type | Unit | Allowed values | Default | Output? |
|---|---|---|---|---|---|---|
| `mk_prothese` | Prothese | dropdown | – | Ja, Nein | Nein | yes |
| (input) | Spezifischer Klappenprothesentyp | text | – | free | – | yes |
| `mk_segel` | Segel sklerosiert | dropdown | – | zart, leicht sklerosiert, mäßig sklerosiert, schwer sklerosiert | null (fallback "zart") | yes |
| `mk_insuffizienz` | Insuffizienz | dropdown | – | keine, leichte, mittelgradige, hochgradige | null | yes |
| `mk_stenose` | Stenose | dropdown | – | keine, leichte, mittelgradige, hochgradige | null | yes |
| `mk_jet` | Jetrichtung | dropdown | – | zentral, exzentrisch medial, exzentrisch lateral | null | yes |
| `mk_mechanismus` | Pathomechanismus | dropdown | – | unbeurteilbar, Mitralklappenprolaps, Flail Leaflet, Tethering / Tenting, Großer Koaptationsdefekt / schweres Tenting | null | yes |
| `mk_konvergenzzone` | PISA Konvergenzzone | dropdown | – | nicht groß, große holosystolische | null | yes |
| `mk_e_welle_dominant` | Mitralis Einstrom | dropdown | – | nicht E-dominant, E-Welle dominant (>1.2 m/s) | null | yes |
| `mk_vc` | Vena Contracta (VC) | number | mm | – | – | yes |
| `mk_pisa` | PISA-Radius | number | mm | – | – | yes |
| `mk_eroa` | EROA | number 0.01 | cm² | – | – | yes |
| `mk_dp` | dp max/mean | text | mmHg | "max/mean" | – | yes (with MS) |

MI details are shown for any grade other than "keine"; MS details for any grade other than "keine".

### 4.7 Trikuspidal- & Pulmonalklappe

| ID | Label | Type | Unit | Allowed values | Default |
|---|---|---|---|---|---|
| `tk_prothese` | Prothese | dropdown | – | Ja, Nein | Nein |
| (input) | Prothesentyp | text | – | free | – |
| `tk_segel` | Segelbeschaffenheit | dropdown | – | zart, leicht sklerosiert, mäßig sklerosiert, schwer sklerosiert | null (fallback "zart") |
| `tk_insuffizienz` | Insuffizienz | dropdown | – | keine, physiologisch, leichte, mittelgradige, hochgradige | null |
| `tk_jet` | Jet | dropdown | – | zentral, exzentrisch medial, exzentrisch lateral | null |
| `tk_vc` | VC | **text** | mm | – | – |
| `tk_pisa` | PISA | **text** | mm | – | – |
| `tk_stenose` | Stenose | dropdown | – | keine, leichte, mittelgradige, hochgradige | null |
| `tk_dp` | dp max/mean | text | mmHg | "max/mean" | – |
| `pk_funktion` | Klappenfunktion (Pulmonalklappe) | dropdown | – | normal, leichte Insuffizienz, mittelgradige Insuffizienz, hochgradige Insuffizienz | null (fallback "normal") |

TR details are shown only for "mittelgradige"/"hochgradige".

### 4.8 Aorta & Perikard

| ID | Label | Allowed values | Default |
|---|---|---|---|
| `aorta_ascendens` | Aorta ascendens | normwertig, dilatiert | null (fallback "normwertig dimensioniert") |
| `perikarderguss` | Perikarderguss (PE) | kein Perikarderguss, geringer Perikarderguss, mittelgroßer Perikarderguss, großer Perikarderguss | null |
| `perikard_text` | Zusätzliche Ergussbeschreibung | free text | – |
| `herzhoehlen` | Kompression | Herzhöhlen entfaltet, RA komprimiert, RV komprimiert, LV komprimiert | null |
| `relevanz` | Hämodynamik | keine hämodynamische Relevanz, beginnende hämodynamische Relevanz, Swinging Heart Zeichen | null |

### 4.9 Therapieoptimierung / Empfehlung

| ID | Label | Allowed values | Default |
|---|---|---|---|
| `empfehlung_disease` | Nachsorgepfad generieren für Krankheitsbild | Herzinsuffizienz, Vorhofflimmern, Myokardinfarkt | null |

### 4.10 Preset "Normale TTE vorbefüllen"

Sets: rhythm=Sinusrhythmus, schallbedingungen=gut, lvedd_dim=lvesd_dim=normal
dimensioniert, lv_kinetik=keine Kinetikstörungen, diastole=kein Hinweis auf
diastolische Dysfunktion, ra_diameter=normwertig, la_diameter_qualitativ=normal
dimensioniert, rv_diameter=normwertig, rv_funktion=normal,
pulm_hypertonie=kein Hinweis, ak_prothese=Nein, ak_sklerose=zart,
ak_taschen=trikuspid, ak_stenose=keine, ak_insuffizienz=keine, mk_prothese=Nein,
mk_segel=zart, mk_insuffizienz=keine, mk_stenose=keine, mk_konvergenzzone=nicht
groß, mk_e_welle_dominant=nicht E-dominant, tk_prothese=Nein, tk_segel=zart,
tk_insuffizienz=physiologisch, tk_stenose=keine, pk_funktion=normal,
aorta_ascendens=normwertig, perikarderguss=kein Perikarderguss, clears
perikard_text, then generates the report. ⚠ It does **not** clear numeric
values, so a "normal" text can sit next to pathological numbers.

## TTE-5 Derived values

| Derived | Formula / rule | Where |
|---|---|---|
| RVSP | `ceil(TR maxPG) + RAP`, with `RAP = 10 if VCI > 20 mm else 5` (VCI read from the form after extraction; empty VCI → 5). Only when the model returns `tr_max_pg`; otherwise the model's `rvsp` is used. | extraction only (TEXTGEN X-2) |
| mm from cm | `value × 10` if the returned unit is "cm", except for `tasv`, `mitral_e`, `mitral_a` | extraction |
| TASV cm/s | `× 100` if unit is "m/s" **or** 0 < value < 3.0; then rounded to 0.1 | extraction |
| `ak_dp` | `"{av_max_pg}/{av_mean_pg}"`, or just the max (no slash) or "/{mean}" | extraction |
| LVEF class | TTE-R01 | report |
| Wall thickness class | TTE-R02 (from IVSd only) | report |
| HFA-PEFF score | TTE-R10…R13 (functional + morphological + biomarker, 0–6) | live panel + report |
| `diastole` | forced to "Hinweis auf diastolische Dysfunktion" if score ≥ 2, else "kein Hinweis …" | on generate |
| Adjective form | `getAdjectiveForm()` — TEXTGEN TTE-G01 (⚠ buggy) | summary |
| **Not derived** (flag) | E/A (entered separately from E and A); RWT and LVMI (need PWd and BSA, which are not captured); LAESVI (needs BSA). Values can contradict each other. | – |

## TTE-6 Report order & layout

Plain-text report (textarea, copied as is):

```
Transthorakale Echokardiographie:
<blank>
Indikation: {indication}
Rhythmus: {rhythm}
<blank>
Messwerte:
{Name}: {Wert} {Einheit}; {Name}: …          (only filled fields, fixed order TTE-4.2)
<blank>
BEFUND:
Linker Ventrikel: {LV sentences} {GLS sentence?} {HFpEF sentence}.
<blank>
Vorhöfe und Rechter Ventrikel: {LA} {RA} {RV} {RV-Funktion} {PH}
<blank>
Klappenbefund:
Aortenklappe: {…}
Mitralklappe: {…}
Trikuspidalklappe: {…} Pulmonalklappe: {…}          ← same line
<blank>
Aorta und Perikard: {Aorta} {PE} {VCI fixed sentence}
<blank>
Zusammenfassung:
{fragment}, {fragment}, ….
[<blank>
Empfehlung:
{Textbaustein}]
```

PDF (jsPDF A4): centred title "Echokardiographie Befund" (16 pt bold) → line
"Patient: {patientInfo}" left / "Datum: {dd.mm.yyyy}" right → striped table
"Parameter | Wert" (header colour RGB 30,64,175) → "Befundtext:" (12 pt bold) →
the full text above (11 pt). File name `TTE-Befund-{patientInfo with
non-alphanumerics → _}.pdf`.

Live side panel (not in the report): "HF-PEFF Live-Score", gauge "{score}/6",
domain boxes "1. Funktionelle Kriterien", "2. Morphologische Kriterien",
"3. Biomarker Kriterien", each "{n} / 2 Pkte" plus the criteria met.

## TTE-7 Normal ranges & highlight bands

Input highlighting (amber = minor, red = major) uses its own band set,
separate from the text rules. Full tables: TEXTGEN TTE-H01…H17. Text
classifications: TTE-R01 (LVEF), TTE-R02 (IVSd). HFA-PEFF: TTE-R10…R13.

## TTE-8 Flags (clinically wrong / outdated / inconsistent — not fixed)

| # | Flag |
|---|---|
| F-01 | ⚠ **HFA-PEFF score → report sentence.** A score ≥ 2 prints "Hinweis auf diastolische Dysfunktion" and 0–1 prints "kein Hinweis …". In HFA-PEFF, 2–4 is *intermediate* (needs further testing) and does not diagnose diastolic dysfunction; the score is also not a diastolic-function grading. The live panel text "Diagnose von HFpEF ist kardiologisch gesichert" (score 5–6) overstates. (D-08) |
| F-02 | ⚠ The score is calculated and printed whatever the LVEF; HFA-PEFF applies only with LVEF ≥ 50 % and symptoms. (D-08) |
| F-03 | ⚠ Extraction prompt maps **"RVAWd"** (RV anterior wall thickness, diastolic) and **"RV Länge"** (RV length) to key `rv`, which is then banded as a basal RV *diameter* (> 41 / > 45 mm). These are three different measurements. (D-21) |
| F-04 | ⚠ The prompt maps **septal** E/e' ("E/E' Sept", "E/e' (Sep)") to `e_e_prime`; HFA-PEFF cut-offs 9/15 refer to **average** E/e'. The septal e' < 7 / lateral e' < 10 cm/s major criterion is missing. (D-10) |
| F-05 | ⚠ LAVI bands ignore rhythm: in AF, HFA-PEFF uses > 40 (major) / 34–40 (minor) ml/m²; the code always uses the SR values. The biomarker bands *are* rhythm-aware — inconsistent. (D-11) |
| F-06 | ⚠ LVMI minor criterion uses `>` 115/95; HFA-PEFF says ≥ 115/95 g/m². A value exactly on the cut-off is missed. (D-12) |
| F-07 | ⚠ Wall-thickness bands (IVSd; m ≤10 normal / ≤12 / ≤14 / >14; f ≤9 / ≤12 / ≤14 / >14) do not match ASE/EACVI 2015 (m 6–10 / 11–13 / 14–16 / ≥17; f 6–9 / 10–12 / 13–15 / ≥16). "hypertrophiert" is inferred from IVSd alone; LV hypertrophy is defined by LV mass. (D-13) |
| F-08 | ⚠ LVEF boundary disagreement: the text calls 40.x % "mittelgradig reduziert" (band 30–< 41), while the highlight treats ≤ 40 as major and 40–< cut-off as minor. (D-14) |
| F-09 | ⚠ IVSd: text says "geringgradig hypertrophiert" from > 10 (m) / > 9 (f), but the highlight and score start at ≥ 12 mm. Three thresholds for one field. |
| F-10 | ⚠ Quantitative and qualitative fields are **not linked**: LVEDD, LVESD, LA, RA, RV size, RV function, PH and valve severities are chosen by hand and can contradict the numbers next to them (e.g. LVEDD 70 mm + "normal dimensioniert"). No rule turns AV Vmax / dp / AÖF into an AS grade, or RVSP into PH. (D-15) |
| F-11 | ⚠ RAP estimate is simplified (5 or 10 mmHg by VCI > 20 mm only). ASE uses 3 / 8 / 15 mmHg with diameter ≤ 21 mm and collapse > 50 %. The VCI highlight uses > 21 mm — two cut-offs. (D-16) |
| F-12 | ⚠ Fixed sentence "Die Vena cava inferior ist normalkalibrig und zeigt atemmodulierte Kaliberschwankung." is **always** printed, even with VCI > 21 mm or no VCI assessed. (D-16) |
| F-13 | ⚠ **Unassessed = normal.** Null RA, RV, RV function, AK anatomy/sclerosis, MK/TK leaflets, PK and aorta fall back to normal wording ("normwertig", "normal", "trikuspid", "zart"). An empty form yields a largely normal report. (D-18) |
| F-14 | ⚠ Prostheses are always reported "in regelrechter Funktion" — there is no field for prosthesis function. (D-19) |
| F-15 | ⚠ Grammar: AS grades are stored uninflected ("leichtgradig"), so the text reads "Es liegt eine **leichtgradig** Aortenstenose vor". The summary maps them to "AS I/II/III" **without °**, while all other grades get °. |
| F-16 | ⚠ Grammar: `getAdjectiveForm("leicht reduziert")` → "**leichte reduzierte** LV-Funktion"; "mittelgradig reduziert" → "mittelgradige reduzierte". Should be "leicht reduzierte" etc. |
| F-17 | ⚠ AI sentence begins "Zusätzlich besteht …" even when there is no stenosis. |
| F-18 | ⚠ HFpEF sentence starts in lower case after a full stop: "… . kein Hinweis auf diastolische Dysfunktion, HF-PEFF Score (0)." |
| F-19 | ⚠ The "Herzinsuffizienz" recommendation block is a **single patient's letter**: "die Patientin klinisch sehr aktiv (täglich spazieren, regelmäßiges Schwimmen …)", referral to "Klinikum Chemnitz", "Klinik für Innere Medizin I". The "Vorhofflimmern" / "Myokardinfarkt" blocks are placeholders ("Textbaustein für Vorhofflimmern..."). (D-20) |
| F-20 | ⚠ The user's diastole selection is silently overwritten by the score on "Befundbericht generieren". |
| F-21 | ⚠ Mitral E/A: the conversion skips these keys, so values returned in cm/s (e.g. 80) stay as 80 "m/s". (D-22) |
| F-22 | ⚠ TASV is converted twice: the prompt tells the model to convert m/s → cm/s, then the code multiplies by 100 again if unit is "m/s" or 0 < value < 3. |
| F-23 | ⚠ `ak_jet_breite` and `ak_suprasternal` (holodiastolic flow reversal) are collected but never reported. |
| F-24 | "Status präsens" — Latin is "Status praesens". (D-24) |
| F-25 | The GLS sentence is produced only for "vor Chemotherapie"; with good acoustic windows and no GLS nothing is said. The two "unmöglich" sentences are strong wording ("nicht möglich"/"nicht valide beurteilbar" was in `d1086cb`). |
| F-26 | Rhythm "AV-Block III" is treated as SR for the biomarker cut-offs. |
| F-27 | Summary puts "Kein PE" capitalised mid-list; LA dilatation is summarised only as "LA-Dilatation" without grade. |
| F-28 | Earlier commit `d1086cb` had a manual diastolic-dysfunction grade sentence ("Hämodynamisch entspricht dies einer diastolischen Dysfunktion {grade}.") that was replaced by the score — the grading capability was lost. (D-09) |

---

# TEE — Transösophageale Echokardiographie

## TEE-1 Scope & source

- Repo `rady3000/TEE_2026`, HEAD `b165daf` (2026-09-23, migration to Tailwind v4 + Vite; logic unchanged vs `9972291`).
- Files: `index.html` (markup + options), `index.tsx` (460 lines).

## TEE-2 Technical profile

| Aspect | Finding |
|---|---|
| Framework | **Vanilla TypeScript, DOM-based** — the same dropdown pattern as TTE. `react` is listed in package.json but not used. |
| Styling | Tailwind v4, Inter font. |
| Persistence | None. |
| Secrets | `GEMINI_API_KEY` inlined by `vite.config.ts` `define`, although nothing uses it. `metadata.json` claims `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`. |
| Tests | None. |
| Quality | **2 / 5** — small and readable, but state is the display strings, several inputs are never output, and a visibility bug hides TR details (F-05). |

## TEE-3 Model usage

**None.** No model call and no extraction. Nothing to carry over; no deviation.

## TEE-4 Fields

### 4.1 Header, Indikation, Sedierung

| ID | Label | Type | Unit | Allowed values | Default | Notes |
|---|---|---|---|---|---|---|
| (no id) | Patient | text | – | free | – | ⚠ never used |
| `queryDate` | Datum der Untersuchung | date | – | – | today | ⚠ never used |
| `indikation` | Indikation | dropdown | – | Ausschluss intrakardiale Thromben, Kardiale Emboliequelle?, V.a. Endokarditis, Klappenvitien, Sonstige Indikation | null | "V.a. Endokarditis" shows the endocarditis checks |
| `sedierung` | Sedierung | dropdown | – | Komplikationslose Sondenführung unter lokaler Anästhesie, Erschwerte Sondenführung mit zusätzlicher Sedierung | null | |
| `sedierung_dosis` | (Propofol-Dosis) | text | – | e.g. "100 mg" | – | shown only for the second option |

### 4.2 Messwerte-Tabelle (number)

| ID | Label | Unit |
|---|---|---|
| `laa_fluss` | LAA Fluss | cm/s |
| `lvot` | LVOT | mm |
| `aortenwurzel_tee` | Aortenwurzel | mm |
| `aorta_ascendens_tee` | Aorta ascendens | mm |
| `aorta_descendens_tee` | Aorta descendens | mm |

### 4.3 Befund-Details

| ID | Label | Type | Unit | Allowed values | Default | Output? |
|---|---|---|---|---|---|---|
| `lvef` | LVEF | dropdown | – | normal, leichtgradig reduziert, mittelgradig reduziert, hochgradig reduziert | null | yes |
| `thromben` | Intrakardiale Thromben | dropdown | – | Kein Hinweis, Präthrombotische Formationen im LAA, Nachweis | null | yes |
| `thromben_beschreibung` | (Thrombus beschreiben) | textarea | – | free | – | if Nachweis |
| `laa_fluss_qualitativ` | LAA Fluss | dropdown | – | Normal, Gering reduziert, Schwer reduziert | null | yes |
| `ias_befund` | IAS | dropdown | – | Kein Hinweis auf PFO/ASD, Nachweis eines PFO, Nachweis eines ASD | null | yes |
| `ias_beschreibung` | (Defekt beschreiben) | textarea | – | free | – | if PFO/ASD |
| `ak_prothese` | Prothese | dropdown | – | Ja, Nein | Nein | yes |
| `ak_prothese_typ` | Prothesentyp | text | – | free | – | if Ja |
| `ak_taschen` | Taschen | dropdown | – | Trikuspid, Bikuspid, Nicht bestimmbar | null | yes |
| `ak_segel` | Segel | dropdown | – | Zart, Leicht sklerosiert, Mäßig sklerosiert, Schwer sklerosiert | null | yes |
| `ak_stenose` | Stenose | dropdown | – | Keine, Leichtgradig, Mittelgradig, Hochgradig | null | yes |
| `ak_3d_aoef` | 3D-AÖF | number 0.1 | cm² | – | – | if mittel/hoch |
| `ak_insuffizienz` | Schweregrad (AI) | dropdown | – | Keine, Leichtgradig, Mittelgradig, Hochgradig | null | yes |
| `ak_mechanismus` | Mechanismus | dropdown | – | Typ I (normale Segel, Aortendilatation), Typ Id (Segelperforation), Typ II (Segelprolaps), Typ III (Verkalkung/Fibrose) | null | yes (mittel/hoch) |
| `ak_jet` | Jet | dropdown | – | Zentral, Exzentrisch medial, Exzentrisch lateral | null | ⚠ **never output** |
| `ak_jet_breite` | Jetbreite/LVOT | dropdown | – | < 30%, 30-50%, > 50% | null | yes |
| `ak_vc` | VC | number | mm | – | – | yes |
| `ak_rueckfluss` | Holodiast. Rückfluss | dropdown | – | Nein, Ja | null | yes |
| `ak_endokarditis` | Hinweis auf Endokarditis | dropdown | – | Nein, Ja | Nein | only if indication V.a. Endokarditis |
| `ak_endokarditis_beschreibung` | (Vegetationen, Abszess …) | textarea | – | free | – | if Ja |
| `mk_prothese` / `mk_prothese_typ` | Prothese / Typ | dropdown / text | – | Ja, Nein | Nein | yes |
| `mk_segel` | Segel | dropdown | – | Zart, Leicht sklerosiert, Mäßig sklerosiert, Schwer sklerosiert | null | yes |
| `mk_insuffizienz` | Insuffizienz | dropdown | – | Keine, Leichtgradig, Mittelgradig, Hochgradig | null | yes |
| `mk_mechanismus` | Mechanismus | dropdown | – | Segel-/Papillarmuskelruptur, Segelprolaps, Ringdilatation, Sonstiges | null | yes |
| `mk_mechanismus_beschreibung` | (Mechanismus beschreiben) | textarea | – | free | – | yes |
| `mk_jet` | Jet | dropdown | – | Zentral, Exzentrisch medial, Exzentrisch lateral | null | ⚠ **never output** |
| `mk_2d_vc` | 2D-VC | number | mm | – | – | yes |
| `mk_2d_pisa` | 2D-PISA | number | mm | – | – | ⚠ **never output** |
| `mk_2d_eroa` | 2D-EROA | number 0.01 | cm² | – | – | ⚠ **never output** |
| `mk_3d_vca` | 3D-VCA | number 0.01 | cm² | – | – | yes |
| `mk_retrogradfluss` | Retrogradfluss Pulmonalvenen | dropdown | – | Nein, Ja | null | yes |
| `mk_teer_pathologie` | Pathologie/Lokalisation | dropdown | – | Zentrale Pathologie, Isolierte kommissurale Läsion, Kommissurale Läsion mit multiplen Jets, M. Barlow, Rheumatische Genese | null | if MI hochgradig |
| `mk_teer_verkalkung` | Verkalkung | dropdown | – | Keine, Anulär ohne Segelbeteiligung, Anulär mit Segelbeteiligung, MAC mit Stenose, In der Greifzone | null | " |
| `mk_teer_segel_integritaet` | Segelintegrität | dropdown | – | Intakt, Fibrotisch, Cleft, Tiefer Cleft, Perforation | null | " |
| `mk_teer_tethering` | Tethering | dropdown | – | Kein relevantes Tethering, Asymmetrisches Tethering | null | " |
| `mk_teer_jet_charakter` | Jet Charakteristika | dropdown | – | Keine Besonderheit, Zwei Jets (Indentationen), Breiter Jet (ges. Koaptation), Multiple/breite Jets | null | " |
| `mk_teer_vor_op` | Vor-Operationen | dropdown | – | Keine, Z.n. frustraner Anuloplastie | null | " |
| `mk_teer_mva` | MVA | number 0.1 | cm² | – | – | " |
| `mk_teer_gradient` | Mittl. Gradient | number | mmHg | – | – | " |
| `mk_teer_post_segel_laenge` | Post. Segel | number | mm | – | – | " |
| `mk_teer_tenting_hoehe` | Tenting Höhe | number | mm | – | – | " |
| `mk_teer_flail_gap` | Flail Gap | number | mm | – | – | " |
| `mk_teer_flail_weite` | Flail Weite | number | mm | – | – | " |
| `mk_teer_coapt_reserve` | Coaptation Reserve | number | ⚠ mm² | – | – | " (a length, usually mm) |
| `mk_teer_segel_anulus_index` | Segel-Anulus-Index | number 0.01 | – | – | – | " |
| `mk_teer_gesamteignung` | Gesamteignung für TEER | dropdown | – | Ideal, Geeignet, Anspruchsvoll, Schwierig / Unmöglich | null | " |
| `mk_endokarditis` (+ `_beschreibung`) | Hinweis auf Endokarditis | dropdown | – | Nein, Ja | Nein | as AK |
| `tk_prothese` / `tk_prothese_typ` | Prothese / Typ | dropdown / text | – | Ja, Nein | Nein | yes |
| `tk_segel` | Segel | dropdown | – | Zart, Leicht sklerosiert, Mäßig sklerosiert, Schwer sklerosiert | null | yes |
| `tk_insuffizienz` | Insuffizienz | dropdown | – | Keine Insuffizienz, Grad I (leicht), Grad II (moderat), Grad III (hoch), Grad IV (massiv), Grad V (torrential) | null | yes |
| `tk_mechanismus` (+ `_beschreibung`) | Mechanismus | dropdown | – | Primär, Sekundär | null | yes |
| `tk_jet` | Jet | dropdown | – | Zentral, Exzentrisch medial, Exzentrisch lateral | null | yes |
| `tk_2d_vc`, `tk_2d_pisa` | 2D-VC, 2D-PISA | number | mm | – | – | yes |
| `tk_2d_eroa`, `tk_3d_vca` | 2D-EROA, 3D-VCA | number 0.01 | cm² | – | – | yes |
| `tk_teer_geeignet` | Geeignet für TEER | dropdown | – | Ja, Nein | null | yes |
| `tk_endokarditis` (+ `_beschreibung`) | Hinweis auf Endokarditis | dropdown | – | Nein, Ja | Nein | as AK |

Preset "Normale TEE": indikation=Ausschluss intrakardiale Thromben,
sedierung=Komplikationslose Sondenführung unter lokaler Anästhesie, lvef=normal,
thromben=Kein Hinweis, laa_fluss_qualitativ=Normal, ias_befund=Kein Hinweis auf
PFO/ASD, all valves native/zart/none, endocarditis Nein; then generates.

## TEE-5 Derived values

None. No numeric rule. The summary grades are a direct mapping of dropdown labels (TEXTGEN TEE-S*).

## TEE-6 Report order & layout

```
Transösophageale Echokardiographie (TEE)
<blank>
Indikation: {indikation | "Nicht angegeben"}.
{Sedierung sentence}
<blank>
[Messwerte:
{Name}: {Wert} {Einheit}; …]
<blank>
BEFUND:
[{LVEF sentence}
<blank>]
{Thrombus sentence} {LAA flow sentence} {IAS sentence}
<blank>
Klappenbefund:
Aortenklappe: …
Mitralklappe: … [M-TEER block with "- " bullets]
Trikuspidalklappe: …
<blank>
Zusammenfassung:
{list}.  |  {normal sentence}
```

Copy only (plain text); no PDF, no header, no examiner.

## TEE-7 Normal ranges & highlight bands

None implemented. The LAA flow value (cm/s) has no band and is not linked to
the qualitative LAA flow (D-26).

## TEE-8 Flags

| # | Flag |
|---|---|
| F-01 | ⚠ **Contradiction:** "Präthrombotische Formationen im LAA" puts that phrase in the summary, while the body prints "Kein Nachweis von intrakardialen Thromben, insbesondere im linken Vorhofohr (LAA)." "Präthrombotische Formationen" is not a standard term (spontaneous echo contrast / sludge, graded). (D-25) |
| F-02 | ⚠ Patient and date are collected and discarded. |
| F-03 | ⚠ Grammar: "Es besteht eine **leichtgradig** Aortenstenose", "Zudem besteht eine **mittelgradig** Aortenklappeninsuffizienz" (uninflected). |
| F-04 | ⚠ "die Segel sind …" for the aortic valve (it has cusps/Taschen); the field labelled "Taschen" holds morphology (tri-/bicuspid). |
| F-05 | ⚠ **Bug:** TR details are hidden when `tk_insuffizienz.startsWith('Grad I')` — this is also true for Grad II, III and IV, so details appear only for Grad V. The report uses the same test, so mechanism, jet and quantification are dropped for grades II–IV. |
| F-06 | ⚠ Inputs never reported: `ak_jet`, `mk_jet`, `mk_2d_pisa`, `mk_2d_eroa`. (D-28) |
| F-07 | ⚠ AS/AI/MI grading vocabulary is 3-grade; TR is 5-grade (Hahn); TTE uses 3-grade for TR. (D-17) |
| F-08 | ⚠ LVEF wording "leichtgradig reduziert" vs TTE "leicht reduziert"; qualitative only. |
| F-09 | ⚠ Scope gaps for an embolic-source TEE: no aortic arch/descending atheroma grading, no LA/LAA morphology, no pulmonic valve, no pericardium, no bubble test (PFO shunt size) field. (D-27) |
| F-10 | ⚠ Sedation: only "Propofol" is mentioned in the text; the default sentence says "wurde gut toleriert" with no field for tolerance or complications. (D-30) |
| F-11 | ⚠ M-TEER suitability is chosen by hand; none of the entered numbers (MVA, gradient, leaflet length, flail gap/width, coaptation reserve) feeds a rule. (D-29) |
| F-12 | Mitral pulmonary-vein flow reversal is described as "holosystolischer Rückfluss" (standard: "systolische Flussumkehr"). |
| F-13 | Summary adds "Kein Nachweis von Thromben" only when some *other* finding is present; a normal study gets the fixed normal sentence. |
| F-14 | "Normale TEE" does not clear numeric inputs or textareas. |

---

# Device-Abfrage — HSM/ICD/CRT follow-up

## DEV-1 Scope & source

- Repo `rady3000/HSM_Abfrage` — **not accessible in this session.** Attaching
  it to the session was refused by a permission check, so it was not cloned and
  not audited. (D-01)

## DEV-2 … DEV-8

**Blocked.** To be written in the same structure once the source is available.
Expected content (to be verified, **not** taken from code): device/lead
identification, battery status, lead measurements (sensing, threshold,
impedance) per chamber, programmed mode and parameters, arrhythmia episodes,
percentage pacing, conclusion.

---

# SM-Implantation — Schrittmacher-/ICD-Implantation (OP-Bericht)

## SM-1 Scope & source

- Repo `rady3000/HSM_Implantationsmaske`, HEAD `8928a6d` (2026-09-23).
- Files: `App.tsx` (form), `components/ReportPreview.tsx` (three renderers), `types.ts`,
  `migrated_prompt_history/…json` (AI Studio chat log — no patient data;
  shows the OP text was written by the AI Studio model at design time, D-46).

## SM-2 Technical profile

| Aspect | Finding |
|---|---|
| Framework | **React 19 + TypeScript**, Vite 6. |
| Dependencies | `docx` 8.5.0, `file-saver` 2.0.5. **Double sourcing**: package.json *and* an importmap to `aistudiocdn.com` / `esm.sh`; Tailwind via the **CDN play script** (`cdn.tailwindcss.com`, not for production). |
| State | One typed `ReportData` object in `useState`; custom diagnosis in a separate state. |
| Persistence | None. |
| Secrets | Key inlined via `vite.config.ts` though unused. |
| Tests | None. |
| Quality | **2 / 5** — typed model and clean components, but the report exists three times (text / preview JSX / DOCX), written by hand, and they already diverge (F-01); data bug F-02. |

## SM-3 Model usage

**None** at runtime. The fixed narrative was drafted by the AI Studio model
during development (prompt history), so it needs clinical review before
reuse (D-46). No runtime deviation.

## SM-4 Fields

| ID | Label | Type | Unit | Allowed values | Default | Notes |
|---|---|---|---|---|---|---|
| `clinic` | – | fixed | – | "Klinik für Kardiologie" | fixed | not editable |
| `operator` | – | fixed | – | "Dr. med. Mohamed Rady" | fixed | not editable |
| `operationDate` | Operationsdatum | date | – | – | today | |
| `patient.lastName` | Nachname | text | – | – | "" | |
| `patient.firstName` | Vorname | text | – | – | "" | |
| `patient.dob` | Geburtsdatum | date | – | – | "" | ⚠ empty → "Invalid Date" in report |
| `diagnosis` | Diagnose | select | – | AV-Block II° Mobitz Typ, AVB III°, symptomatisches SSS, symptomatisches BTS, symptomatisches Trifaszikulärblock mit Synkopen, Aggregatwechsel, Sonstiges | Sonstiges | |
| `customDiagnosis` | Indikation (sonstiges) | text | – | free | "" | if Sonstiges |
| `initialIndication` | Initiale Indikation | text | – | free | "" | if Aggregatwechsel ⚠ F-02 |
| `procedure` | Prozedur | select | – | DDD-HSM (Zweikammer), VVI-HSM (Einkammer), CRT-P, CRT-D, VR-ICD (Einkammer-ICD), DR-ICD (Zweikammer-ICD), S-ICD | DDD-HSM (Zweikammer) | single-chamber = VVI, VR-ICD, S-ICD |
| `implantSide` | Implantationsseite | select | – | links, rechts | links | |
| `anesthetic` | Lokalanästhesie | text | – | free | "ca. 20 ml Xylocain 1%" | |
| `punctureSite` | Venenpunktion | select | – | Vena axillaris, Vena cephalica, Vena subclavia, Kein Zugang (Abbruch) | Vena axillaris | hidden for Aggregatwechsel |
| `generator.manufacturer` | Aggregat | select | – | Endurity Core PM 2512, Vitatron Q70, Vitatron G70, Vitatron Q20, Ellipse VR, Ellipse DR | "" | ⚠ holds the *model* name; `generator.model` is never editable |
| `raSonde.manufacturer` / `.model` | RA-Sonde Hersteller / Modell | text | – | free | "" | hidden if single-chamber or Aggregatwechsel |
| `rvSonde.manufacturer` / `.model` | RV-Sonde Hersteller / Modell | text | – | free | "" | hidden if Aggregatwechsel |
| `raSondeMeasurements.sensing` | P-Welle | text | (mV, in placeholder) | e.g. "5 mV" | "" | |
| `raSondeMeasurements.threshold` | Reizschwelle (V/ms) | text | V/ms | e.g. "0,8/0,4" | "" | |
| `raSondeMeasurements.impedance` | Impedanz (Ω) | text | Ω | e.g. "482" | "" | |
| `rvSondeMeasurements.*` | R-Zacke / Reizschwelle / Impedanz | text | mV / V/ms / Ω | e.g. "7,5 mV", "0,5/0,4", "650" | "" | |
| `fluoroTime` | Durchleuchtungszeit (min:sec) | text | min:sec | e.g. "10:47" | "" | ⚠ printed with unit "Minuten" |
| `dap` | Dosis-Flächen-Produkt (cGy*cm²) | text | cGy·cm² | e.g. "1935" | "" | |
| `postOpCare.sandbag` | Sandsack und Bettruhe für 6 Stunden | checkbox | – | – | true | |
| `postOpCare.xray` | Röntgen-Thorax-Kontrolle | checkbox | – | – | true | |
| `postOpCare.dischargeToday` | Entlassung heute möglich | checkbox | – | – | false | |
| `woundCare.sutureRemovalNotNeeded` | Keine Nahtentfernung nötig | checkbox | – | – | true | mutually exclusive with next |
| `woundCare.sutureRemovalByGP` | Fäden entfernen durch den Hausarzt | checkbox | – | – | false | switches suture wording |

Generator auto-fill (`handleGeneratorChange`):

| Aggregat | Prozedur set to | RA-Sonde | RV-Sonde |
|---|---|---|---|
| Vitatron Q70 / G70 | DDD | Medtronic, 5076 - 52 cm | Medtronic, 4076 - 58 cm |
| Vitatron Q20 | VVI | cleared | Medtronic, 4076 - 58 cm |
| Endurity Core PM 2512 | DDD | Tendril STS, 2088TC - 52 cm | Tendril STS, 2088TC - 58 cm |
| Ellipse VR | VR-ICD | cleared | unchanged |
| Ellipse DR | DR-ICD | unchanged | unchanged |

Presets: "Vitatron Standard" (diagnosis AVB III°, G70 + 5076/4076) and "Abbott
Standard" (diagnosis Sonstiges → "Symptomatischer, atrioventrikulärer (AV)
Block III. Grades", Endurity Core + Tendril STS). Both keep patient data and
clear measurements and radiation data.

## SM-5 Derived values

| Derived | Rule |
|---|---|
| `isSingleChamber` | procedure ∈ {VVI, VR-ICD, S-ICD} |
| Contralateral side | links ↔ rechts (failed access) |
| Suture wording | ByGP → "Einzelknopfnähten", else "einer intrakutanen Naht" |
| Prozedur prefix | punctureSite = Abbruch → "Versuchte", else "Erfolgreiche" |

## SM-6 Report order & layout

1. `{clinic}` · "Operationsbericht"
2. Datum · Patient · Operateur
3. Diagnose (+ Initiale Indikation for Aggregatwechsel)
4. Prozedur
5. Aufklärung
6. Bericht (narrative, SM-T*)
7. Messwerte (intraoperativ) — table Sonde | P-Welle/R-Zacke | Reizschwelle | Impedanz
8. Implantierte Komponenten — table Komponente | Hersteller | Modell
9. Strahlenschutzdaten — table Parameter | Wert | Einheit
10. Weiteres Vorgehen — bullets
11. Wundversorgung — bullets
12. Signature line `{operator}`

Text export uses tabs between cells and "o " bullets. DOCX: Arial 11 pt, H1
18 pt centred, H4 12 pt, grey table borders, shaded header row.

## SM-7 Normal ranges

None. Lead measurements are free text with no plausibility bands (D-33).

## SM-8 Flags

| # | Flag |
|---|---|
| F-01 | ⚠ **Three renderers diverge.** (a) X-ray bullet: text "Röntgen-Thorax-Kontrolle zum Ausschluss eines Pneumothorax."; preview "…zur Überprüfung der Sondenlage und zum Ausschluss eines Pneumothorax, Schrittmacher-Abfrage und Echokardiographie zum Ausschluss eines Perikardergusses am Folgetag."; DOCX "Röntgen-Thorax-Kontrolle." (b) DOCX ignores **Aggregatwechsel** in the narrative (prints the puncture and lead-placement text instead of SM-T13); its tables are correct (generator only). (c) DOCX Subclavia path omits the "Über eine Schleuse …" sentence. |
| F-02 | ⚠ **Bug:** "Initiale Indikation" is written to `data.patient.initialIndication`, but read from `data.initialIndication`, so it always prints "–". |
| F-03 | ⚠ **Device types vs narrative:** CRT-P/CRT-D/ICD/S-ICD can be selected, but the narrative always describes a pacemaker with one or two "Schrittmacherdrähte", RV lead + RA lead only. No LV/CS lead, no shock lead, no defibrillation test, and S-ICD (extravascular) receives a transvenous puncture text. (D-31) |
| F-04 | ⚠ Fixed claims regardless of input: RV lead "hochseptal", RA lead "an RAA … aktiv fixiert", screw-in fixation, "exzellenten Messwerte", "gute Messwerte", "problemlos", "Die Positionierung war stabil". The measurements typed in are not checked. (D-32, D-33) |
| F-05 | ⚠ "subpektoralen Bereichs" / "subpektoral eine Tasche": the standard is a subcutaneous/prepectoral pocket; a subpectoral pocket is a specific variant. (D-32) |
| F-06 | ⚠ Vena cephalica is usually reached by cut-down (Venae sectio), not punctured "unter sonographischer Kontrolle". (D-34) |
| F-07 | ⚠ Grammar: "unter sonographische Kontrolle" (→ sonographischer), "im hochseptale Lage" (→ in hochseptaler Lage), "symptomatisches Trifaszikulärblock" (→ symptomatischer), "Implantation eines CRT-D / S-ICD" works but "eines DDD-HSM (Zweikammer)" reads awkwardly; "AV-Block II° Mobitz Typ" is missing the type number. |
| F-08 | ⚠ "Der Patient wurde … aufgeklärt" — masculine fixed; no sex field. (D-40) |
| F-09 | ⚠ Durchleuchtungszeit entered as min:sec, printed with unit "Minuten". (D-37) |
| F-10 | ⚠ `generator.manufacturer` holds model names; `generator.model` is never set → "Aggregat | Endurity Core PM 2512 | –". (D-35) |
| F-11 | "Aggregatwechsel" is a procedure, stored as a diagnosis. (D-36) |
| F-12 | Operator is hard-coded. |
| F-13 | Wound-care: both boxes unchecked → the narrative still says "intrakutanen Naht" but the Wundversorgung section is empty. |
| F-14 | DOB empty → `new Date('')` → "Invalid Date" in the header. |
| F-15 | The failed-access text claims all three veins were tried under both ultrasound and fluoroscopy with contrast, whatever was actually done. |

---

# Kardioversion — Elektrische Kardioversion (Protokoll)

## CV-1 Scope & source

- Repo `rady3000/eCV_APP`, HEAD `5fb8452` (2026-09-23).
- Files: `App.tsx` (form + print preview), `services/generatorService.ts` (text), `types.ts`.

## CV-2 Technical profile

| Aspect | Finding |
|---|---|
| Framework | **React 19 + TypeScript**, Vite 6. |
| Dependencies | react, react-dom; importmap to `aistudiocdn.com` as well; Tailwind via CDN play script with inline config (`medical` colour palette). |
| State | Typed `ReportData` + `initialReportData`; report regenerated in `useEffect` on every change. |
| Structure | ✅ Text generation is a **pure function** `generateReport(data): string` in its own service — the best separation of all prototypes. |
| Persistence | None. |
| Secrets | Key inlined via vite config though unused; `metadata.json` declares no Gemini capability. |
| Tests | None. |
| Quality | **3 / 5** — the cleanest; weaknesses: CDN Tailwind, no tests, clinical rules embedded in string branches. |

## CV-3 Model usage

**None.** No deviation.

## CV-4 Fields

| ID | Label | Type | Unit | Allowed values | Default | Notes |
|---|---|---|---|---|---|---|
| `patientName` | Name | text | – | "Nachname, Vorname" | "" | |
| `gender` | Geschlecht | select | – | Männlich, Weiblich | **Männlich** | grammar |
| `dob` | Geburtsdatum | date | – | – | "" | |
| `indicationType` | Typ | select | – | Erstdiagnose, Rezidiv (value "Rezidivierend"), Vorhofflattern | Erstdiagnose | |
| `diagnosisDate` | Datum der Erstdiagnose | date | – | – | today | only for Erstdiagnose |
| `teeStatus` | Status | select | – | Mit TEE (Thrombusausschluss), Ohne TEE (Glaubhafte Einnahme) | Mit TEE | |
| `anticoagulantName` | – | – | – | – | "Apixaban" | ⚠ in the model, never shown or used |
| `sedationPropofol` | Propofol (mg) | number, step 10 | mg | – | "80" | "0"/empty omitted |
| `sedationMidazolam` | Midazolam (mg) | number, step 0.5 | mg | – | "2" | "0"/empty omitted |
| `electrodePosition` | Elektrodenposition | select | – | Anteroposterior (Standard), Anterolateral | Anteroposterior | |
| `outcome` | Erfolg | select | – | Erfolg (1. Schock), Erfolg (Weitere Schocks), Erfolglos | Erfolg (1. Schock) | |
| `sinusRate` | Sinusfrequenz (/min) | text | /min | – | "70" | success only |
| `shockCount` | Anzahl Schocks | number | – | integer | 3 | failure only ⚠ NaN if cleared |
| (energy) | "Energie: 360 J" | fixed label | J | 360 | 360 | ⚠ not editable (D-38) |
| `skinReaction` | Hautrötungen sichtbar? | checkbox | – | – | false | |
| `recAnticoagulant` | Antikoagulation Weiterhin | select | – | Apixaban, Rivaroxaban, Edoxaban, Dabigatran, Falithrom, Marcumar | Apixaban | |
| `chadsvascScore` | CHA₂DS₂-VASc Score (Optional) | number | points | – | "" | |
| `recommendRhythmControl` | Rhythmuserhaltende Medikation empfehlen | checkbox | – | – | false | success |
| `recRhythmControl` | Wirkstoff | select | – | Flecainid, Amiodaron | Flecainid | |
| `recommendWeightLoss` | Gewichtsreduktion | checkbox | – | – | false | success |
| `includeRecurrenceAdvice` | Rhythmuserhaltende Therapie ("Bei Rezidiv: Vorstellung zur Diskussion Ic vs PVI") | checkbox | – | – | false | success |
| `planPVI` | Planung PVI | checkbox | – | – | false | success |
| `failureStrategy` | Strategie bei Erfolglosigkeit | select | – | Frequenzkontrolle, Amiodaron Aufsättigung | Frequenzkontrolle | failure |

## CV-5 Derived values

| Derived | Rule |
|---|---|
| Grammatical forms | female → "die Patientin / der Patientin / der Patientin"; male → "der Patient / des Patienten / dem Patienten" |
| Electrode adjective | Anterolateral → "anterior-lateraler", else "anterior-posteriorer" |
| Arrhythmia noun | Vorhofflattern → "Vorhofflattern(s)", else "Vorhofflimmern(s)" |

## CV-6 Report order & layout

Sections (upper-case headings, numbered):
1. INDIKATION UND AUFKLÄRUNG · 2. ANTIKOAGULATION UND TEE-STATUS ·
3. PROZEDERE UND SEDIERUNG · 4. ERGEBNIS DER KARDIOVERSION ·
5. POSTPROZEDURALER VERLAUF · 6. EMPFEHLUNGEN UND WEITERES VORGEHEN.

Print preview (A4): header "KARDIOLOGIE / Befundbericht", right "Datum: {today}";
title "Protokoll: Elektrische Kardioversion"; text; footer with two signature
lines "Untersucher" and "Oberarzt/Chefarzt". Copy = plain text of sections 1–6 only.

## CV-7 Normal ranges

Only the embedded OAC rule (TEXTGEN CV-R01). Target resting rate < 110/min (fixed text).

## CV-8 Flags

| # | Flag |
|---|---|
| F-01 | ⚠ **Energy fixed at 360 J** for every shock and for atrial flutter. Many biphasic devices deliver at most 200 J; flutter usually converts at lower energy. Protocol-dependent. (D-38) |
| F-02 | ⚠ TEE text: 'keine Thromben oder **thrombogenes Kontrastmittel** ("smoke-like echo")' — the term is *spontaner Echokontrast*; "Kontrastmittel" is wrong. TEE is always negative — there is no positive-thrombus path. (D-42) |
| F-03 | ⚠ OAC rule outdated/inconsistent: "Eine lebenslange Antikoagulation ist bei einem Score von ≥2 (Männer) bzw. ≥3 (Frauen) indiziert." — ESC 2024 uses CHA₂DS₂-VA (sex removed): OAC recommended ≥ 2, considered = 1. With a score entered, the text says "darüber hinaus dauerhaft bei einem CHA₂DS₂-VASc-Score von {x}" **for any x, including 0**. The failure branch says "lebenslang fortgeführt werden" regardless of score. (D-39) |
| F-04 | ⚠ "über die letzten 4 Wochen" — guidelines require ≥ 3 weeks of therapeutic OAC; there is no early-CV (< 24 h / < 48 h) pathway. (D-39) |
| F-05 | ⚠ Indication: "Erstdiagnose" always adds "persistierendem"; "Vorhofflattern" is a third option of the same field, so flutter cannot be first-diagnosed/recurrent; recurrence advice and the PVI text say "Vorhofflimmern" even for flutter (typical flutter → CTI ablation). (D-41) |
| F-06 | ⚠ "Erfolg (Weitere Schocks)" always describes exactly **two** shocks. |
| F-07 | ⚠ No procedure date or examiner; print shows today's date. |
| F-08 | ⚠ If both sedatives are 0/empty: "… wurden  verabreicht, bis …" (broken sentence). "Die Beatmung erfolgte spontan" → Spontanatmung. |
| F-09 | ⚠ Always-on sentences: "Frequenzkontrolle: … mit ß-Blockern wird … empfohlen." (every success), "hämodynamisch stabil … ohne Komplikationen" (no complication field). |
| F-10 | `anticoagulantName` exists in the model but is unused; the pre-procedural OAC drug is not documented. |
| F-11 | Default sex "Männlich" (TTE default is "weiblich"). (D-40) |
