# SPEC-textgen — Classification rules, threshold bands, text blocks, extraction

Status: **Draft v0.2 (milestone 0, audit only)**. Everything below is copied
from the prototypes **as found** — wording, cut-offs and bugs included. Nothing
is endorsed. ⚠ = flag; `GAP` / `OVERLAP` / `INCONSISTENT` = band-set analysis.
German text in `code` or quote blocks is **verbatim** (placeholders in `{…}`).

Notation: `[a, b)` = a ≤ x < b. "m" = männlich, "f" = weiblich (and any
non-"männlich" value, since the code tests `gender === 'männlich'`).

---

## G. Conformance with CLAUDE.md and SPEC-extraction-gateway.md

The prototypes predate the gateway design. This section records where each
prototype rule would land under it. **No rule has been converted**: the
conversion to `reference/*.json` needs the physician's cut-offs, `source` and
`reviewedOn` (gateway §5.2).

### G-1 Rule inventory against the design constraints

| Rule | Type | Single value (CLAUDE.md rule 5)? | Names a guideline? | Therapy recommendation? | Status under the new design |
|---|---|---|---|---|---|
| TTE-R01 LVEF | band → sentence | yes (+ sex) | no | no | convertible once cut-offs/source are set (D-14, D-52) |
| TTE-R02 IVSd | band → sentence | yes (+ sex) | no | no | convertible (D-13) |
| TTE-H01…H17 | out-of-range highlight | yes | no | no | convertible as normal ranges |
| TTE-R10…R13 HFA-PEFF | score → sentence | **no** | no ("ESC Leitlinien" in UI text only) | no | **not allowed as auto text** (D-48) |
| TTE-T* qualitative sentences | selection → sentence | n/a (physician-chosen) | n/a | no | templates; allowed |
| TTE-B Empfehlung blocks | selection → paragraph | n/a | no | **yes** | **excluded** (D-49) |
| TEE-T*/TEE-S | selection → sentence | n/a | n/a | TEER suitability borderline | templates; D-49 for TEER sentences |
| SM-T* | selection → sentence | n/a | n/a | post-op orders (SM-T17…T22) | templates; D-49 |
| CV-R01 | score → recommendation | yes (score) | no | **yes** | **excluded** (D-39, D-49) |
| CV-T18…T24 | selection → recommendation | n/a | n/a | **yes** | **excluded** (D-49) |

### G-2 Band semantics needed before conversion

The gateway `ClassificationRule` bands use `min`/`max` without stating
inclusivity. The gateway's own LVEF example (`min 55` / `min 45, max 54` /
`min 30, max 44` / `max 29`) is contiguous only for integers: 54.5 % or
29.5 % match **no** band and would silently produce no sentence (the exact
failure §5.2.3 forbids). Prototype values are decimals (step 0.1/0.01).
The prototype rules use half-open intervals (`≥ cut-off`), which are gap-free.
→ D-52.

### G-3 Condition dimension needed

Several prototype band sets vary by sex (R01, R02, H02, H03, H04, H06) or
rhythm (R12, H16, H17). The gateway `ClassificationRule` interface has one
`field` and one band list — no condition such as `when: { sex: 'männlich' }`.
→ D-51.

### G-4 Extraction contract gap

The prototype extraction returns `{value, unit}` only. The gateway requires
`confidence`, `page`, `boundingBox`, `rawText` per field and discards anything
without them (§3.1). The prototype prompt is therefore **reference material for
label hints only** (`extractionHints`), not a reusable extraction design.

---

## X. Extraction (model) — the only model use in all prototypes

### X-1 TTE extraction prompt (verbatim, `TTE_V2026/index.tsx` @ df72c6d, lines 54–90)

Sent together with the uploaded image/PDF as `inlineData` to model
`gemini-3.8-flash`, `responseMimeType: 'application/json'`.

```text
                Du bist ein spezialisierter medizinischer Assistent. Analysiere das hochgeladene Bild eines Echokardiographie-Befundes.
                Extrahiere die folgenden Messwerte. Achte genau auf die Einheiten (cm oder mm) neben den Werten.
                
                **WICHTIGE REGEL ZUR ZAHLENERKENNUNG:** In medizinischen Dokumenten aus dem deutschsprachigen Raum wird das Komma (,) als Dezimaltrennzeichen verwendet (z.B. "22,6" bedeutet 22.6). Du musst diese Zahlen korrekt als Dezimalzahlen interpretieren. Ignoriere das Komma nicht, sonst wird aus "22,6" fälschlicherweise "226". Behandle "22,6" als "22.6".

                Achte auf die folgenden speziellen Abkürzungen und mappe sie korrekt:
                - "RV Länge" oder "RVAWd" im Dokument entspricht dem Schlüssel "rv". Priorisiere "RV Länge".
                - "LVIDs" im Dokument entspricht dem Schlüssel "lvesd".
                - "E/E' Sept" oder "E/e' (Sep)" im Dokument entspricht dem Schlüssel "e_e_prime".
                - "G peak SL(Avg)" im Dokument entspricht dem Schlüssel "gls".
                - "TR maxPG" im Dokument entspricht dem Schlüssel "tr_max_pg".
                - "TV S'" oder "TDI S'" im Dokument entspricht dem Schlüssel "tasv". Falls der Wert in m/s angegeben ist (z.B. 0.12), rechne ihn bitte in cm/s um (z.B. 12).
                - Für den Schlüssel "lvef" (LVEF), priorisiere den Wert, der als "LVEF_BiP_Q" oder "EF Biplane" bezeichnet wird. Ignoriere Werte wie "EF (Teich)" oder "EF (Cube)".
                - "MV E" -> "mitral_e" (Einheit: m/s).
                - "MV A" -> "mitral_a" (Einheit: m/s).
                - "E/A" -> "e_a_ratio".
                
                **Biomarker & Morphologische Parameter:**
                - "RWT" oder relative Wanddicke -> "rwt".
                - "LVMI" oder linksventrikulärer Massenindex -> "lvmi" (Einheit g/m²).
                - "BNP" -> "bnp" (Einheit pg/ml).
                - "NT-proBNP" -> "nt_probnp" (Einheit pg/ml).
                
                **Aortenklappe (AV) Parameter:**
                - Suche nach "AV Vmax", "Vmax Aorta", "Vmax AV" -> Schlüssel: "av_vmax" (Einheit meist m/s).
                - Suche nach "AV maxPG", "Pmax Aorta" -> Schlüssel: "av_max_pg" (Einheit mmHg).
                - Suche nach "AV meanPG", "Pmean Aorta" -> Schlüssel: "av_mean_pg" (Einheit mmHg).
                - Suche nach "AVA", "AÖF", "AV Area" -> Schlüssel: "av_area" (Einheit cm²).

                Gib das Ergebnis NUR als valides JSON-Objekt zurück. Gib KEINEN Text oder Erklärungen vor oder nach dem JSON-Objekt aus.
                Das JSON-Objekt MUSS das folgende Schema haben:
                Jeder Schlüssel muss ein Objekt mit "value" (Zahl) und "unit" (string, z.B. "cm" oder "mm") sein.
                Die Schlüssel sind: 
                ivsd, lvedd, lvesd, lvef, la, rv, tapse, tasv, rvsp, laesvi, mitral_e, mitral_a, e_a_ratio, e_e_prime, aortenwurzel, aorta_ascendens_val, vci, gls, tr_max_pg,
                av_vmax, av_max_pg, av_mean_pg, av_area, rwt, lvmi, bnp, nt_probnp.

                Wenn ein Wert nicht vorhanden ist, lasse den Schlüssel im JSON weg.
```

History: in `d1086cb` the prompt was identical except that the block
"**Biomarker & Morphologische Parameter:**" (rwt, lvmi, bnp, nt_probnp) and the
four keys at the end of the key list were missing; model `gemini-3-flash-preview`.

Prompt flags:
- ⚠ `"RV Länge" oder "RVAWd"` → `rv`: length / wall thickness mapped onto a diameter field (SPEC-modules TTE F-03, D-21).
- ⚠ `"E/E' Sept"` → `e_e_prime`: septal ratio used as the average ratio (D-10).
- ⚠ The model is told to convert TASV units (a calculation, not extraction).
- ⚠ `"G peak SL(Avg)"` → `gls`: vendor-specific label (GE EchoPAC). Label heuristics are vendor-bound (D-07).
- Key `rvsp` is requested but no mapping hint is given; `tr_max_pg` is preferred downstream.

### X-2 Deterministic post-processing of the model response (TTE)

Applied in this order:

| # | Rule |
|---|---|
| P1 | Strip code fences (```` ```json ````, ```` ``` ````), `JSON.parse`. |
| P2 | `av_vmax.value` → `ak_vmax`. |
| P3 | `av_area.value` → `ak_aoef`. |
| P4 | `ak_dp` = `"{max}"` + (`"/{mean}"` if mean) — max-only gives "40", mean-only gives "/25". |
| P5 | For every other key with a matching input id (skip `rvsp, tr_max_pg, av_*`): if `unit.toLowerCase() === 'cm'` and key ∉ {tasv, mitral_e, mitral_a} → `value × 10`. |
| P6 | `tasv`: if `unit === 'm/s'` **or** `0 < value < 3.0` → `value × 100`; then round to 0.1. ⚠ May double-convert (the prompt already asks for cm/s). |
| P7 | If `tr_max_pg` present: `RVSP = ceil(tr_max_pg) + RAP`, `RAP = 10` if the VCI field (already filled by P5) `> 20` mm, else `5`. Else if `rvsp` present → take it. |
| P8 | Status line: "`{n} Felder wurden erfolgreich ausgefüllt und ausgewertet.`" (green). Error: "`Fehler: {message}`" / "`Fehler: Kein Gemini API-Schlüssel konfiguriert. Bitte überprüfen Sie die Einstellungen.`" |
| P9 | Recalculate HFA-PEFF score. |

`GAP`: mitral E/A in cm/s are not converted (D-22). `INCONSISTENT`: RAP cut-off 20 mm here vs VCI highlight 21 mm (TTE-H15).

### X-3 Other modules

TEE, SM-Implantation, Kardioversion: **no extraction, no model call.**
Device-Abfrage: unknown (not accessible).

---

## TTE — Rules

### TTE-R01 LVEF classification (text) — `getLvefInterpretation(lvef, gender)`

| Band | m | f | Output word |
|---|---|---|---|
| invalid | NaN, ≤ 0, > 100 | same | `nicht beurteilt` (via caller) |
| normal | ≥ 52 | ≥ 54 | `normal` |
| mild | [41, 52) | [41, 54) | `leicht reduziert` |
| moderate | [30, 41) | [30, 41) | `mittelgradig reduziert` |
| severe | (0, 30) | (0, 30) | `hochgradig reduziert` |

Analysis: complete, no overlap. `INCONSISTENT` with TTE-H04 (major ≤ 40).
No "hyperdynamic" band (> 72 % m / > 74 % f per ASE 2015).

Sentence: `Die globale systolische Pumpfunktion ist {word}. `

### TTE-R02 Wall thickness (text) — `getWallThicknessInterpretation(ivsd, gender)`

| Band | m (IVSd mm) | f (IVSd mm) | Output word |
|---|---|---|---|
| invalid | NaN, ≤ 0 | same | `nicht beurteilt` |
| normal | ≤ 10 | ≤ 9 | `normwertig` |
| mild | (10, 12] | (9, 12] | `geringgradig hypertrophiert` |
| moderate | (12, 14] | (12, 14] | `mittelgradig hypertrophiert` |
| severe | > 14 | > 14 | `hochgradig hypertrophiert` |

Analysis: complete, no overlap. ⚠ Differs from ASE/EACVI 2015 (see SPEC-modules
TTE F-07). `INCONSISTENT` with TTE-H01 (≥ 12) and TTE-R11 (≥ 12).

Sentence: `Die Wanddicke ist {word}. `

### TTE-R10 HFA-PEFF — functional domain (max 2)

| Criterion | Major (2) | Minor (1) |
|---|---|---|
| E/e' (`e_e_prime`) | ≥ 15 | [9, 15) |
| RVSP (`rvsp`) | > 35 mmHg | – |
| GLS (`abs(gls)`) | – | 0 < \|GLS\| < 16 % |

Domain = 2 if any major, else 1 if any minor, else 0.
⚠ Missing: septal e' < 7 cm/s / lateral e' < 10 cm/s (major); TR velocity > 2.8 m/s is covered only indirectly via RVSP. ⚠ E/e' septal vs average (D-10).

### TTE-R11 HFA-PEFF — morphological domain (max 2)

| Criterion | Major (2) | Minor (1) |
|---|---|---|
| LAVI (`laesvi`) | > 34 ml/m² | [29, 34] ml/m² |
| LVMI + RWT | LVMI ≥ 149 (m) / ≥ 122 (f) **and** RWT > 0.42 | – |
| LVMI alone | – | LVMI **>** 115 (m) / **>** 95 (f) (only if the major rule did not fire) |
| RWT alone | – | RWT > 0.42 (only if no morph major) |
| IVSd | – | ≥ 12 mm |

⚠ `GAP`: rhythm-independent LAVI; AF values (> 40 / 34–40) missing (D-11).
⚠ Boundary: LVMI minor uses `>` instead of ≥ (D-12).
Note: if LAVI is major, the "RWT alone" minor is suppressed — harmless (score is already 2).

### TTE-R12 HFA-PEFF — biomarker domain (max 2)

| Rhythm | Marker | Major (2) | Minor (1) |
|---|---|---|---|
| not "VHF / Vorhofflattern" | NT-proBNP | > 220 pg/ml | [125, 220] |
| | BNP | > 80 pg/ml | [35, 80] |
| "VHF / Vorhofflattern" | NT-proBNP | > 660 pg/ml | [365, 660] |
| | BNP | > 240 pg/ml | [105, 240] |

Complete for each rhythm. "AV-Block III" uses the SR values.

### TTE-R13 HFA-PEFF total & wording

Total = functional + morphological + biomarker (0–6).

Live panel (UI only):

| Score | Class text | Description text |
|---|---|---|
| 0–1 | `HFpEF Unwahrscheinlich (Normal)` | `Niedrige Wahrscheinlichkeit für diastolische Dysfunktion / HFpEF nach ESC Leitlinien (Score 0-1).` |
| 2–4 | `Grenzbereich (Intermediär)` | `Intermediärer Score (2-4). Klinische Abklärung durch diastolischen Belastungstest (Stressecho) o. invasive Hämodynamik empfohlen.` |
| 5–6 | `Verdacht auf HFpEF Bestätigt (Positiv)` | `Hohe Wahrscheinlichkeit für HFpEF (Score 5-6). Diagnose von HFpEF ist kardiologisch gesichert.` |

Report (two bands only):

| Score | Body sentence (appended + `". "`) | Summary fragment |
|---|---|---|
| ≥ 2 | `Hinweis auf diastolische Dysfunktion, HF-PEFF Score ({score})` | `Hinweis auf diastolische Dysfunktion` |
| < 2 | `kein Hinweis auf diastolische Dysfunktion, HF-PEFF Score ({score})` | `kein Hinweis auf diastolische Dysfunktion` |

⚠ `INCONSISTENT`: the UI has 3 bands, the report has 2; the intermediate band
(2–4) is reported as positive. Score is applied without an LVEF ≥ 50 % check. (D-08)
The `diastole` dropdown is overwritten with the report band on generate.

Criterion labels shown in the panel (verbatim): `E/E' ≥ 15 (Major, 2P)`,
`E/E' 9-14 (Minor, 1P)`, `RVSP > 35 mmHg (Major, 2P)`, `2D-GLS < 16% (Minor, 1P)`,
`LAVI > 34 ml/m² (Major, 2P)`, `LAVI 29-34 ml/m² (Minor, 1P)`,
`LV-Hypertrophie (LVMI & RWT, Major, 2P)`, `LVMI erhöht (>{115|95} g/m², Minor, 1P)`,
`Relative Wanddicke RWT > 0.42 (Minor, 1P)`, `IVS-Wanddicke ≥ 12 mm (Minor, 1P)`,
`NT-proBNP > 220 pg/ml (SR, Major, 2P)`, `NT-proBNP 125-220 pg/ml (SR, Minor, 1P)`,
`BNP > 80 pg/ml (SR, Major, 2P)`, `BNP 35-80 pg/ml (SR, Minor, 1P)`,
`NT-proBNP > 660 pg/ml (VHF, Major, 2P)`, `NT-proBNP 365-660 pg/ml (VHF, Minor, 1P)`,
`BNP > 240 pg/ml (VHF, Major, 2P)`, `BNP 105-240 pg/ml (VHF, Minor, 1P)`,
empty: `Keine Kriterien erfüllt`.

### TTE-H01…H17 Input highlight bands (UI colour only, not in text)

| ID | Field | Condition none | minor (amber) | major (red) | Analysis |
|---|---|---|---|---|---|
| H01 | IVSd | < 12 | ≥ 12 | – | sex-independent; `INCONSISTENT` with R02 |
| H02 | LVEDD | m ≤ 58, f ≤ 52 | m (58, 64], f (52, 58] | m > 64, f > 58 | complete |
| H03 | LVESD | m ≤ 40, f ≤ 35 | m (40, 45], f (35, 40] | m > 45, f > 40 | complete |
| H04 | LVEF | ≥ 52 m / ≥ 54 f | (40, cut-off) | ≤ 40 | `INCONSISTENT` with R01 (41) |
| H05 | RWT | ≤ 0.42 | > 0.42 | – | complete |
| H06 | LVMI | m ≤ 115, f ≤ 95 | m (115, 149), f (95, 122) | m ≥ 149, f ≥ 122 | complete |
| H07 | 2D-GLS | \|x\| ≥ 16 or 0 | 0 < \|x\| < 16 | – | 0 treated as "not measured" |
| H08 | E/e' | < 9 | [9, 15) | ≥ 15 | complete |
| H09 | RVSP | ≤ 35 | – | > 35 | complete |
| H10 | LAESVI | < 29 | [29, 34] | > 34 | complete; AF not considered |
| H11 | LA | ≤ 40 | (40, 46] | > 46 | sex-independent |
| H12 | RV | ≤ 41 | (41, 45] | > 45 | see D-21 |
| H13 | TAPSE | ≥ 17 | – | < 17 | complete |
| H14 | TASV | ≥ 10 | < 10 | – | complete |
| H15 | VCI | ≤ 21 | > 21 | – | `INCONSISTENT` with X-2 P7 (20) |
| H16 | BNP | SR < 35 / AF < 105 | SR [35, 80] / AF [105, 240] | SR > 80 / AF > 240 | complete |
| H17 | NT-proBNP | SR < 125 / AF < 365 | SR [125, 220] / AF [365, 660] | SR > 220 / AF > 660 | complete |

Extra: indication "vor Chemotherapie" → GLS field outlined red (no value test).

### TTE-G01 Adjective helper `getAdjectiveForm(x)` (summary only)

| Input | Output |
|---|---|
| empty / `nicht beurteilt` | `nicht beurteilte` |
| `normal` | `normale` |
| else | `x.replace(' ', 'e ') + 'e'` → e.g. `leicht reduziert` → **`leichte reduzierte`** ⚠ bug (expected `leicht reduzierte`) |

### TTE-T Text templates (body), in output order

**Header**
```
Transthorakale Echokardiographie:

Indikation: {indication}
Rhythmus: {rhythm | "Sinusrhythmus"}

Messwerte:
{Name}: {value} {unit}; …

BEFUND:
Linker Ventrikel: 
```

**TTE-T01 LV size**
- both `lvedd_dim` and `lvesd_dim` = `normal dimensioniert` → `Der linke Ventrikel ist normal dimensioniert. `
- else → `Der LVEDD ist {lvedd_dim | "n.b."}, der LVESD ist {lvesd_dim | "n.b."}. `

**TTE-T02** `Die Wanddicke ist {R02}. Die globale systolische Pumpfunktion ist {R01}. `

**TTE-T03 Kinetik**
- `regionale Wandbewegungsstörungen` → `Regionale Wandbewegungsstörungen: {text | "n.s."}. `
- `globale Hypokinesie` → `Es zeigt sich eine globale Hypokinesie. `
- `keine Kinetikstörungen` **or null** → `Es zeigen sich keine regionalen Wandbewegungsstörungen. ` ⚠ null = normal

**TTE-T04 GLS** (only if indication = `vor Chemotherapie`)
- no GLS + `mäßig` → `Aufgrund der mäßigen Schallbedingungen war die Bestimmung der GLS unmöglich. `
- no GLS + `deutlich eingeschränkt` → `Aufgrund der deutlich eingeschränkten Schallbedingungen war die Bestimmung der GLS unmöglich. `
- GLS present → `Der globale longitudinale Strain (GLS) beträgt {gls}%. `
- ⚠ `GAP`: no GLS + `gut` → nothing.

**TTE-T05** HFA-PEFF sentence (R13) + `". "` then blank line. ⚠ lower-case start.

**TTE-T06 Vorhöfe & RV**
```
Vorhöfe und Rechter Ventrikel: Der linke Vorhof ist {la_q | "nicht beurteilt"}. Der rechte Vorhof ist {ra | "normwertig"}. Der rechte Ventrikel ist {rv | "normwertig"}. Die globale systolische rechtsventrikuläre Funktion ist {rv_funktion | "normal"}. 
```
- PH = `Hinweis` → `Es besteht ein indirekter Hinweis auf eine pulmonale Hypertonie (RVSP {rvsp | "N/A"} mmHg). `
- else (incl. null) → `Es besteht kein Hinweis auf eine pulmonale Hypertonie. `

**TTE-T07 Aortenklappe** (`Klappenbefund:\nAortenklappe: `)
- prosthesis → `Zustand nach Aortenklappenersatz durch eine {type | "n.s."} Prothese in regelrechter Funktion. `
- else `Die Aortenklappe ist {ak_taschen | "trikuspid"}, die Taschen sind {ak_sklerose | "zart"}. `
  - stenosis ≠ keine → `Es liegt eine {ak_stenose} Aortenstenose vor` + ` ({Vmax x m/s, dp max/mean y mmHg, AÖF z cm²})` if any + `. ` ⚠ `leichtgradig` uninflected
  - AI ≠ keine → `Zusätzlich besteht eine {ak_insuffizienz} Aortenklappeninsuffizienz` + ` (Jet: {ak_jet}; PHT: {pht} ms)` + `. ` ⚠ "Zusätzlich" also without AS; details printed even for "leichte" if values were entered earlier
  - neither → `Hämodynamisch zeigt sich keine relevante Pathologie. `
  - no stenosis measurements printed yet → `({Vmax x m/s, dp max/mean y mmHg}). ` (AÖF omitted)

**TTE-T08 Mitralklappe**
- prosthesis → `Zustand nach Mitralklappenersatz durch eine {type | "n.s."} Prothese in regelrechter Funktion. `
- else `Die Mitralklappensegel sind {mk_segel | "zart"}. `
  - MI ≠ keine → `Es zeigt sich eine {mk_insuffizienz} Mitralklappeninsuffizienz` + ` (Jet: …; Mechanismus: …; Konvergenzzone: …; Mitralis-Einstrom: …; VC {x} mm; PISA {x} mm; EROA {x} cm²)` + `. `
  - MS ≠ keine → `Es liegt eine {mk_stenose} Mitralklappenstenose vor` + ` (dp max/mean: {x} mmHg)` + `. `
  - neither → `Keine hämodynamisch relevante Stenose oder Insuffizienz. `

**TTE-T09 Trikuspidal-/Pulmonalklappe**
- prosthesis → `Zustand nach Trikuspidalklappenersatz durch eine {type | "n.s."} Prothese in regelrechter Funktion. `
- else `Die Segel sind {tk_segel | "zart"}. `
  - TR ∈ {leichte, mittelgradige, hochgradige} → `Es besteht eine {tk_insuffizienz} Trikuspidalklappeninsuffizienz` + (mittel/hoch only) ` (Jet: …; VC {x} mm; PISA {x} mm)` + `. `
  - TR ∈ {keine, physiologisch, null} → `Keine hämodynamisch relevante Insuffizienz. `
  - ⚠ `tk_stenose` / `tk_dp` are **never output**.
- then `Pulmonalklappe: Die Funktion ist {pk_funktion | "normal"}.` → e.g. "Die Funktion ist leichte Insuffizienz." ⚠ ungrammatical for non-normal values.

**TTE-T10 Aorta & Perikard** (`Aorta und Perikard: `)
- `Die Aorta ascendens ist {aorta_ascendens | "normwertig dimensioniert"}. `
- PE ≠ kein → `Es zeigt sich ein {perikarderguss}. ` + `{perikard_text} ` + `Herzhöhlen: {herzhoehlen}. ` + `Hämodynamik: {relevanz}. `
- else → `Kein Perikarderguss. `
- always → `Die Vena cava inferior ist normalkalibrig und zeigt atemmodulierte Kaliberschwankung.` ⚠ unconditional (D-16)

### TTE-S Zusammenfassung (fragments joined by `", "`, closed by `"."`)

Order:
1. `mäßige Schallbedingungen` / `deutlich eingeschränkte Schallbedingungen` (nothing for gut)
2. LV/RV function:
   - R01 = normal **and** RV function (null→normal) = normal → `normale biventrikuläre Pumpfunktion` + ` (LVEF {x}%)`
   - else: R01 ≠ nicht beurteilt → `{G01(R01)} LV-Funktion` + `, LVEF {x}%`; RV ≠ normal → `{G01(rv)} RV-Funktion`
3. HFA-PEFF fragment (R13)
4. `LA-Dilatation` if LA qualitative set and ≠ normal dimensioniert
5. `AI {grade}`, `MI {grade}`, `TI {grade}`, `MS {grade}`, `AS {grade}` + `, AÖF {x} cm²`
   Grade map: `leichte`→`I°`, `mittelgradige`→`II°`, `hochgradige`→`III°`, `leichtgradig`→`I`, `mittelgradig`→`II`, `hochgradig`→`III` ⚠ AS without °
6. PE: `{perikarderguss}` + ` ({relevanz})` or `Kein PE`

`GAP`: RA/RV dilatation, PH, wall thickness, regional WMA, prostheses, PK and aorta never appear in the summary.

### TTE-B Empfehlung Textbausteine (verbatim, appended as `\n\nEmpfehlung:\n{text}`)

`Herzinsuffizienz` ⚠ patient- and site-specific (D-20):
```text
Es handelt sich um eine Erstdiagnose einer Herzinsuffizienz. Da die Patientin klinisch sehr aktiv ist (täglich spazieren, regelmäßiges Schwimmen etc.), wird folgendes zielgerichtetes Vorgehen angestrebt:
Rekompensation: Fortführung der Rekompensationstherapie (i.v. Diurese, Bilanzierung der täglichen Ein- und Ausfuhr, tägliche Gewichtskontrolle sowie umtägige Elektrolytkontrollen).
Therapieoptimierung: Einleitung bzw. Optimierung der leitliniengerechten Herzinsuffizienz-Therapie (ARNI, Beta-Blocker, Spironolacton und SGLT-2-Inhibitor).
Invasive Diagnostik: Nach erfolgreicher Rekompensation Planung einer ambulanten, frühelektiven Koronarangiographie im Klinikum Chemnitz. Hierzu werden die Unterlagen an das Casemanagement der Klinik für Innere Medizin I im Klinikum Chemnitz weitergeleitet. Bei Ausschluss einer KHK wird im Verlauf die Durchführung eines Kardio-MRT zur weiteren Ätiologieklärung diskutiert.
Verlauf: Eine echokardiographische und klinische Verlaufskontrolle in 3 Monaten ist in unserer Funktionsdiagnostik geplant. Sollte sich die LV-Pumpfunktion nach Sanierung (oder Ausschluss) einer KHK und unter optimierter Medikation nicht verbessert haben, wird die Indikation für eine Device-Therapie (Defibrillator / CRT-D/P) geprüft.
```
`Vorhofflimmern`: `Textbaustein für Vorhofflimmern...` (placeholder)
`Myokardinfarkt`: `Textbaustein für Myokardinfarkt...` (placeholder)

---

## TEE — Rules (all selection → text; no numeric bands)

### TEE-T Body templates

```
Transösophageale Echokardiographie (TEE)

Indikation: {indikation | "Nicht angegeben"}.
```
**TEE-T01 Sedierung**
- `Erschwerte Sondenführung mit zusätzlicher Sedierung` → `Die Untersuchung erfolgte unter lokaler Anästhesie und Sedierung mit {dosis | "nicht spezifizierter Dosis Propofol"}.`
- else (incl. null) → `Die Untersuchung erfolgte in lokaler Anästhesie und wurde gut toleriert.`

**TEE-T02 Messwerte** `Messwerte:\n{Name}: {value} {unit}; …` (LAA Fluss cm/s, LVOT mm, Aortenwurzel mm, Aorta ascendens mm, Aorta descendens mm)

**TEE-T03** `BEFUND:` then, if LVEF set: `Die linksventrikuläre Ejektionsfraktion (LVEF) ist {lvef}.`

**TEE-T04 Thromben**
- `Nachweis` → `Es zeigt sich der Nachweis von intrakardialen Thromben: {beschreibung | "nicht näher spezifiziert"}. `
- else (incl. `Präthrombotische Formationen im LAA`, null) → `Kein Nachweis von intrakardialen Thromben, insbesondere im linken Vorhofohr (LAA). ` ⚠ contradiction
- `Der LAA-Fluss ist {laa_fluss_qualitativ lower-case | "nicht beurteilt"}. `

**TEE-T05 IAS**
- PFO/ASD → `Am interatrialen Septum zeigt sich ein {PFO|ASD}: {beschreibung | "nicht näher spezifiziert"}.`
- else (incl. null) → `Das interatriale Septum ist intakt, kein Hinweis auf ein persistierendes Foramen ovale (PFO) oder einen Vorhofseptumdefekt (ASD).` ⚠ null = normal

**TEE-T06 Aortenklappe**
- prosthesis → `Zustand nach Aortenklappenersatz ({typ | "Typ nicht spezifiziert"}). `
- else → `Die native Aortenklappe ist {taschen lower | "nicht beurteilbar"}, die Segel sind {segel lower | "nicht beurteilt"}. `
- AS ≠ Keine → `Es besteht eine {ak_stenose lower} Aortenstenose. ` + (mittel/hoch, AÖF) `(3D-AÖF: {x} cm²). `
- AI ≠ Keine → `Zudem besteht eine {ak_insuffizienz lower} Aortenklappeninsuffizienz. ` + (mittel/hoch) `Mechanismus: {…}. Jet/LVOT: {…}. VC: {x} mm. Holodiastolischer Rückfluss: {Ja|Nein}. `
- neither → `Keine hämodynamisch relevante Stenose oder Insuffizienz. `
- endocarditis → `Endokarditis-Befund: {beschreibung | "nicht spezifiziert"}. `

**TEE-T07 Mitralklappe**
- prosthesis → `Zustand nach Mitralklappenersatz ({typ | "Typ nicht spezifiziert"}). `; else `Die nativen Mitralklappensegel sind {segel lower | "nicht beurteilt"}. `
- MI ≠ Keine → `Es besteht eine {mk_insuffizienz lower} Mitralklappeninsuffizienz. ` + (mittel/hoch) `Mechanismus: {…} ({beschreibung}). ` + `Quantifizierung: 2D-VC {x} mm, 3D-VCA {x} cm². ` + retrograde flow: `Es zeigt sich ein holosystolischer Rückfluss in den Pulmonalvenen. ` / `Kein holosystolischer Rückfluss in den Pulmonalvenen nachweisbar. `
- else → `Keine hämodynamisch relevante Insuffizienz. `
- MI = Hochgradig and any TEER field → `\nBeurteilung der Eignung für eine interventionelle Mitralklappenrekonstruktion (M-TEER):\n` + lines `- Pathologie: …`, `- Verkalkung: …`, `- Segelintegrität: …`, `- Tethering: …`, `- Jet-Charakter: …`, `- Vor-Operation: …`, `- MVA: {x} cm²`, `- Mittlerer Gradient: {x} mmHg`, `- Länge post. Segel: {x} mm`, `- Tenting-Höhe: {x} mm`, `- Flail Gap: {x} mm`, `- Flail Weite: {x} mm`, `- Coaptation Reserve: {x} mm²`, `- Segel-Anulus-Index: {x}`
- TEER-Gesamteignung → `Ideal`: `Die Anatomie erscheint ideal für eine M-TEER.` · `Geeignet`: `Die Anatomie erscheint geeignet für eine M-TEER.` · `Anspruchsvoll`: `Die Anatomie ist anspruchsvoll für eine M-TEER.` · `Schwierig / Unmöglich`: `Die Anatomie ist schwierig bis unmöglich für eine M-TEER.`

**TEE-T08 Trikuspidalklappe**
- prosthesis → `Zustand nach Trikuspidalklappenersatz ({typ | "Typ nicht spezifiziert"}). `; else `Die nativen Trikuspidalklappensegel sind {segel lower | "nicht beurteilt"}. `
- TR ≠ Keine Insuffizienz → `Es besteht eine Trikuspidalklappeninsuffizienz {grade label}. ` e.g. "… Grad II (moderat)."; details only if the label does **not** start with "Grad I" ⚠ bug: only Grad V passes → `Mechanismus: …`, `Der Insuffizienzjet ist {jet lower}. `, `Quantifizierung: 2D-VC … mm, PISA … mm, 2D-EROA … cm², 3D-VCA … cm². `, `Geeignet für TEER: {Ja|Nein}. `
- else → `Keine hämodynamisch relevante Insuffizienz. `

### TEE-S Zusammenfassung

Fragments in order: `LVEF {lvef}` · `Nachweis intrakardialer Thromben` or
`Präthrombotische Formationen im LAA` · `{ias_befund}` (if not "Kein Hinweis auf PFO/ASD") ·
AS `AS I°`/`AS II°`/`AS III°` (+ ` (AÖF {x} cm²)` for III°) · `AI I°…III°` ·
`MI I°…III°` · `TI I°…V°` · `Hinweise auf eine Endokarditis` or (indication V.a.
Endokarditis) `Kein Anhalt für Endokarditis`.
If any fragment and thromben = `Kein Hinweis` → prepend `Kein Nachweis von Thromben`.
If no fragment → `Unauffälliger TEE-Befund ohne Nachweis von Thromben, relevanten Shunts oder hämodynamisch wirksamen Klappenvitien.` + (V.a. Endokarditis) ` Insbesondere keine Hinweise auf eine Endokarditis.`

`GAP`: with thromben = null and some other finding, nothing about thrombi is said in the summary, while the body says "Kein Nachweis …".

---

## SM-Implantation — Text blocks (all fixed; selection-driven)

Reference renderer: plain text `generateReportText` (preview/DOCX differences in SPEC-modules SM F-01).

| ID | Condition | Text (verbatim) |
|---|---|---|
| SM-T01 | always | `{clinic}\nOperationsbericht\n\nDatum: {dd.mm.yyyy}\nPatient: {Nachname}, {Vorname}, {Geb.}\nOperateur: {operator}\n\nDiagnose: {diagnosis text}` |
| SM-T02 | Aggregatwechsel | `Initiale Indikation: {initialIndication \| "–"}` |
| SM-T03 | always | `Prozedur: {Versuchte\|Erfolgreiche} Implantation eines {procedure}` |
| SM-T04 | always | `Aufklärung: Der Patient wurde ausführlich über die Notwendigkeit, den Ablauf, die potenziellen Risiken und die Alternativen des Eingriffs aufgeklärt und hat schriftlich eingewilligt.` |
| SM-T05 | always | `Nach steriler Abdeckung und Desinfektion des {links\|rechts}en subpektoralen Bereichs erfolgte die lokale Anästhesie der Haut und des subkutanen Gewebes in der Mohrenheim-Grube mittels Infiltration von {anesthetic}.` |
| SM-T06 | Abbruch | `Trotz mehrfacher Punktionsversuche der Vena cephalica, der Vena axillaris sowie der Vena subclavia – durchgeführt sowohl unter sonographischer als auch unter radiologischer Kontrolle (nach Kontrastmitteldarstellung) – gelang keine Sondierung des venösen Systems.` / `Aufgrund des fehlenden venösen Zugangs musste die Prozedur frustran abgebrochen werden.` / `Es wurde die Indikation zur zeitnahen Durchführung einer erneuten Implantation am Folgetag von der kontralateralen ({rechts\|links}en) Seite gestellt.` |
| SM-T07 | Subclavia | `Anschließend erfolgte die Punktion der Vena subclavia radiologisch gesteuert nach Venendarstellung mit Kontrastmittel und mehrmaligen frustranen Versuchen der Punktion sowohl der Vena axillaris als auch der Vena cephalica. ` |
| SM-T08 | Axillaris/Cephalica | `Anschließend wurde die {Vena axillaris\|Vena cephalica} unter sonographische Kontrolle erfolgreich punktiert. ` ⚠ grammar |
| SM-T09 | not Abbruch, not Wechsel | `Über eine Schleuse wurden {ein Schrittmacherdraht\|zwei Schrittmacherdrähte} problemlos in das venöse System eingeführt.` |
| SM-T10 | " | `Zuerst wurde die ventrikuläre Elektrode (RV-Sonde) unter radiologischer Kontrolle (Durchleuchtung in zwei Ebenen) im hochseptale Lage des rechten Ventrikels platziert. Die Positionierung war stabil. Nach Sicherstellung der stabilen Lage und der exzellenten Messwerte wurde die Elektrode mittels Schraubmechanismus fixiert.` |
| SM-T11 | " + dual chamber | `Im Anschluss wurde die atriale Elektrode (RA-Sonde) ebenfalls unter radiologischer Kontrolle an RAA und dort aktiv fixiert. Auch hier zeigten sich nach Kontrolle der Lage in zwei Ebenen gute Messwerte.` |
| SM-T12 | " | `Nach erfolgreicher Sondenplatzierung wurde subpektoral eine Tasche für das Aggregat präpariert. Die Elektroden wurden an den {procedure} angeschlossen und das Aggregat in der vorbereiteten Tasche platziert.` |
| SM-T13 | Aggregatwechsel | `Anschließend wurde die alte Tasche eröffnet, das alte Aggregat explantiert und nach Kontrolle der Elektroden das neue Aggregat angeschlossen und in der Tasche platziert.` |
| SM-T14 | always | `Die Wunde wurde sorgfältig in Schichten adaptiert und mit {Einzelknopfnähten\|einer intrakutanen Naht} verschlossen. Ein steriler Verband wurde angelegt.` |
| SM-T15 | Abbruch | `Hinweis: Aufgrund des Abbruchs wurden keine Komponenten implantiert.` |
| SM-T16 | always | Tables: `Messwerte (intraoperativ):` / `Implantierte Komponenten:` / `Strahlenschutzdaten:` (`Durchleuchtungszeit {x} Minuten`, `Dosis-Flächen-Produkt (DFP) {x} cGy*cm²`) |
| SM-T17 | sandbag | `o Sandsack und Bettruhe für 6 Stunden.` |
| SM-T18 | xray | text: `o Röntgen-Thorax-Kontrolle zum Ausschluss eines Pneumothorax.` · preview: `Röntgen-Thorax-Kontrolle zur Überprüfung der Sondenlage und zum Ausschluss eines Pneumothorax, Schrittmacher-Abfrage und Echokardiographie zum Ausschluss eines Perikardergusses am Folgetag.` · DOCX: `Röntgen-Thorax-Kontrolle.` ⚠ three versions |
| SM-T19 | dischargeToday | `o Entlassung heute möglich.` |
| SM-T20 | Abbruch | `o Geplante Neuaufnahme und Re-Implantation am Folgetag.` |
| SM-T21 | sutureRemovalNotNeeded | `o Eine Nahtentfernung ist aufgrund der intrakutanen Naht nicht erforderlich.` |
| SM-T22 | sutureRemovalByGP | `o Die Fäden sollen in 7-10 Tagen durch den Hausarzt entfernt werden.` |
| SM-T23 | always | closing `{operator}` |

No numeric bands exist. `GAP`: lead values (sensing, threshold, impedance) are never checked, yet the text asserts "exzellente"/"gute Messwerte" (D-33).

---

## CV — Kardioversion text blocks & rules

### CV-R01 Anticoagulation rule (embedded in text) ⚠

| Outcome | CHA₂DS₂-VASc entered | Text |
|---|---|---|
| success | empty | `Antikoagulation: Wir empfehlen die konsequente Fortführung der oralen Antikoagulation mit {drug} für mindestens 4 Wochen post-interventionell, danach je nach individuellem Risikoprofil (CHA₂DS₂-VASc-Score). Eine lebenslange Antikoagulation ist bei einem Score von ≥2 (Männer) bzw. ≥3 (Frauen) indiziert.` |
| success | any value x | `Antikoagulation: Wir empfehlen die konsequente Fortführung der oralen Antikoagulation mit {drug} für mindestens 4 Wochen post-interventionell, und darüber hinaus dauerhaft bei einem CHA₂DS₂-VASc-Score von {x}.` |
| failure | any / empty (`[Wert]`) | `Antikoagulation: Die orale Antikoagulation mit {drug} muss aufgrund des persistierenden {Vorhofflimmerns\|Vorhofflatterns} und des damit verbundenen Thromboembolierisikos (CHA₂DS₂-VASc-Score: {x \| "[Wert]"}) lebenslang fortgeführt werden.` |

`GAP`: the score value is never evaluated — 0 or 1 produces "dauerhaft"/"lebenslang".
`OUTDATED`: sex-specific thresholds (ESC 2020) vs CHA₂DS₂-VA (ESC 2024). (D-39)

### CV-T Body templates

Gender forms: Nom `die Patientin`/`der Patient`; Gen `der Patientin`/`des Patienten`; Dat `der Patientin`/`dem Patienten`.

| ID | Condition | Text |
|---|---|---|
| CV-T01 | always | `1. INDIKATION UND AUFKLÄRUNG` |
| CV-T02 | Erstdiagnose | `Bei {Dat} {Name}[, geb. am {dd.mm.yyyy},] erfolgte heute die geplante elektrische Kardioversion bei symptomatischem, persistierendem Vorhofflimmern (Erstdiagnose am {dd.mm.yyyy}).` |
| CV-T03 | Rezidivierend | `… bei rezidivierendem, persistierendem Vorhofflimmern.` |
| CV-T04 | Vorhofflattern | `… bei rezidivierendem, persistierendem Vorhofflattern.` (⚠ the "symptomatischem, persistierendem Vorhofflattern" variant is unreachable) |
| CV-T05 | always | `2. ANTIKOAGULATION UND TEE-STATUS` |
| CV-T06 | Mit TEE | `Zur Beurteilung der kardialen Emboliequelle, insbesondere zum Ausschluss eines Thrombus im linken Vorhofohr, wurde unmittelbar vor der Kardioversion eine transösophageale Echokardiografie (TEE) durchgeführt. Hierbei zeigten sich keine Thromben oder thrombogenes Kontrastmittel ("smoke-like echo"), sodass die Kardioversion wie geplant durchgeführt werden konnte.` ⚠ |
| CV-T07 | Ohne TEE | `Auf die Durchführung einer transösophagealen Echokardiografie (TEE) zum Thrombusausschluss wurde verzichtet, da {Nom} die orale Antikoagulation über die letzten 4 Wochen lückenlos und glaubhaft eingenommen hat.` |
| CV-T08 | always | `3. PROZEDERE UND SEDIERUNG` / `Die Prozedur wurde in Analgosedierung durchgeführt. Nach Anlage eines periphervenösen Zugangs und unter kontinuierlichem Monitoring von EKG, Blutdruck und Sauerstoffsättigung wurden {x mg Propofol i.v.}[ und {y mg Midazolam i.v.}] verabreicht, bis eine ausreichende Sedierungstiefe erreicht war. Die Beatmung erfolgte spontan über eine Sauerstoffmaske.` |
| CV-T09 | always | `Die Kardioversion erfolgte mit einem biphasischen Defibrillator in {anterior-posteriorer\|anterior-lateraler} Elektrodenposition.` |
| CV-T10 | always | `4. ERGEBNIS DER KARDIOVERSION` |
| CV-T11 | Erfolg 1. Schock | `Ein erster synchronisierter Schock mit einer Energie von 360 Joule führte zur sofortigen Konversion in einen stabilen Sinusrhythmus mit einer Frequenz von {sinusRate}/min.` |
| CV-T12 | Erfolg mehrere | `Nach einem ersten erfolglosen Schock mit 360 Joule führte ein weiterer synchronisierter Schock mit gleicher Energie zur erfolgreichen Konversion in einen stabilen Sinusrhythmus mit einer Frequenz von {sinusRate}/min.` |
| CV-T13 | any success | `Das anschließende 12-Kanal-EKG bestätigte den stabilen Sinusrhythmus. Es zeigten sich keine signifikanten Pausen oder andere relevante Arrhythmien post-interventionell.` |
| CV-T14 | Erfolglos | `Trotz Abgabe von bis zu {shockCount} synchronisierten Schocks mit maximaler Energie (360 Joule) konnte kein stabiler Sinusrhythmus wiederhergestellt werden. Es persistiert das bekannte {Vorhofflimmern\|Vorhofflattern}. Die Prozedur wurde daraufhin beendet.` |
| CV-T15 | always | `5. POSTPROZEDURALER VERLAUF` / `{Die Patientin\|Der Patient} war nach der Prozedur hämodynamisch stabil und rasch wieder vollständig wach und orientiert. Die Überwachung im Aufwachraum verlief ohne Komplikationen. ` |
| CV-T16 | skin yes / no | `Lokal zeigten sich an den Klebestellen der Elektroden leichte Hautrötungen, jedoch keine Verbrennungen.` / `Die Haut an den Klebestellen der Elektroden war reizlos.` |
| CV-T17 | always | `6. EMPFEHLUNGEN UND WEITERES VORGEHEN` |
| CV-T18 | success + rhythm control | `Rhythmuserhalt: Zur Stabilisierung des Sinusrhythmus wird die Einleitung/Fortführung einer antiarrhythmischen Therapie mit {Flecainid\|Amiodaron} empfohlen.` |
| CV-T19 | success (always) | `Frequenzkontrolle: Eine begleitende frequenzregulierende Medikation mit ß-Blockern wird zur Vermeidung von schnellen Rezidiven empfohlen.` |
| CV-T20 | success + weight | `Zur Optimierung der Risikofaktoren und Senkung der Rezidivwahrscheinlichkeit wird bei bestehendem Übergewicht eine Gewichtsreduktion empfohlen.` |
| CV-T21 | success + recurrence advice | `Sollte es zu einem Rezidiv des Vorhofflimmerns kommen, bitten wir um erneute Vorstellung zur Diskussion des weiteren Procederes (Klasse-Ic-Antiarrhythmika vs. PVI).` |
| CV-T22 | success + plan PVI | `Aufgrund des erneuten Rezidivs des Vorhofflimmerns / einer Tachymyopathie ist eine elektive Pulmonalvenenisolation indiziert.` |
| CV-T23 | failure + Amiodaron | `Strategie: Da die elektrische Kardioversion initial erfolglos war, erfolgt eine Aufsättigung mit Amiodaron für 5 Tage und die Planung einer erneuten Kardioversion.` |
| CV-T24 | failure + Frequenzkontrolle | `Strategiewechsel: Da die elektrische Kardioversion erfolglos war, wird eine Strategie der Frequenzkontrolle weiterverfolgt.` / `Medikation: Die bisherige Medikation zur Frequenzkontrolle (ß-Blocker) wird angepasst/optimiert. Ziel ist eine Ruhefrequenz von < 110/min.` / `Alternative Verfahren: Als alternative Option könnte zu einem späteren Zeitpunkt eine Pulmonalvenenisolation in Betracht gezogen werden. Dies wird im weiteren Verlauf mit {Dat} besprochen.` |
| CV-T25 | failure | CV-R01 failure text |

---

## Band-set analysis summary

| Rule set | Gaps | Overlaps | Inconsistencies |
|---|---|---|---|
| TTE-R01 LVEF | none | none | vs H04 (40 vs 41) |
| TTE-R02 IVSd | none | none | vs H01/R11 (12 mm); vs ASE 2015 |
| TTE-R10 functional | missing e' criteria | none | septal vs average E/e' |
| TTE-R11 morphological | AF LAVI band missing | none | LVMI `>` vs ≥ |
| TTE-R12 biomarker | none | none | AV-Block III → SR values |
| TTE-R13 total | none | none | UI 3 bands vs report 2 bands |
| TTE-H01…H17 | none (each complete) | none | H04 vs R01; H15 vs X-2 P7; H01 vs R02 |
| TTE-T04 GLS | "gut" + no GLS → silence | – | – |
| TTE text fallbacks | – | – | null → normal wording (RA, RV, RV-Fkt, AK, MK, TK, PK, Aorta, Kinetik, PH) |
| TTE-S summary | RA/RV size, PH, wall thickness, WMA, prostheses, PK, aorta missing | – | AS grade without ° |
| TEE thrombus | – | "Präthrombotische Formationen" → body says none | – |
| TEE TR details | Grad II–IV details dropped (bug) | – | 5-grade TR vs 3-grade others |
| CV-R01 | score not evaluated (0/1 → lifelong) | – | ESC 2020 vs 2024 |
| SM | no measurement bands | – | fixed quality claims |
| Gateway LVEF example (§5.1) | decimals between integer bands (e.g. 54.5) | none | differs from prototype cut-offs (D-52) |
