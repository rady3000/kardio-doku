# SPEC-modules.md — Module specifications from the prototype audit

**Status:** Draft v0.2 (milestone 0, audit only). Describes the prototypes **as
found**; nothing has been corrected. Format follows `SPEC-carotis.md`.
Per-module appendix **A. Audit** holds the technical profile, model usage and
flags (⚠).

**Review required before implementation:** every field, default, cut-off and
German phrase below is copied from a prototype, not endorsed. Clinical content
is the physician's to decide (CLAUDE.md). Rule IDs (`TTE-R…`, `TEE-T…`) →
`SPEC-textgen.md`. Decisions `D-xx` → `SPEC-decisions.md`.

Column conventions (as in SPEC-carotis):
- **Field key** = prototype id (kept for traceability; nested prototype keys flattened to snake_case).
- **Default (normal)** = the value the prototype's "normal" preset sets
  (→ "Alles normal"). "—" = no normal default. If the initial value on
  opening differs, it is given in *Allowed values / notes*.
- **Extractable** is noted where the prototype extracts the field (TTE only).
  Extraction hints are the document labels named in the prototype prompt.
- Patient header, date, examiner and sex come from the shared core (SPEC-shared).

Module overview (CLAUDE.md numbering):

| # | Module key | Prototype | Extraction (CLAUDE.md) | Audit status |
|---|---|---|---|---|
| 1 | `tte` | TTE_V2026 @ `df72c6d` | yes (v1) | audited |
| 2 | `device` | HSM_Abfrage | yes (v1) | **not accessible — D-01** |
| 3 | `tee` | TEE_2026 @ `b165daf` | later | audited |
| 4 | `carotis` | — | later | hand-written: `SPEC-carotis.md` |
| 5 | `sm_impl` | HSM_Implantationsmaske @ `8928a6d` | later | audited |
| 6 | `cv` | eCV_APP @ `5fb8452` | later | audited |

---
---

# Modul 1: TTE — Transthorakale Echokardiographie

## 1. Module identity

| Property | Value |
|---|---|
| Module key | `tte` |
| Display name | Transthorakale Echokardiographie (TTE) |
| Report title | `Transthorakale Echokardiographie:` (prototype text) / `Echokardiographie Befund` (prototype PDF) |
| Bilateral | no |
| Document extraction | yes (v1) |
| Normal preset | button "Normale TTE vorbefüllen" (sets the Default (normal) column, then generates the report) |

## 2. Section: Untersuchungsdaten

| Field key | Label (DE) | Type | Unit | Allowed values / notes | Default (normal) |
|---|---|---|---|---|---|
| `indication` | Klinische Indikation | select | — | Status präsens; Myokardinfarkt; Dyspnoe; Synkope; Schwindel / Präsynkope; Angina pectoris; vor Chemotherapie. Initial "Status präsens". "vor Chemotherapie" activates TTE-T04 and a red GLS outline. ⚠ D-24 | — |
| `rhythm` | EKG Rhythmus | select | — | Sinusrhythmus; VHF / Vorhofflattern; AV-Block III. Switches biomarker bands (TTE-R12). | Sinusrhythmus |
| `schallbedingungen` | Schallbedingungen | select | — | gut; mäßig; deutlich eingeschränkt | gut |

Sex (`weiblich`/`männlich`, prototype initial **weiblich**) drives the LVEF, IVSd, LVEDD, LVESD and LVMI cut-offs → shared core, D-40.

## 3. Section: Linker Ventrikel

| Field key | Label (DE) | Type | Unit | Allowed values / notes | Default (normal) |
|---|---|---|---|---|---|
| `ivsd` | IVSd | number | mm | integer step. Extractable. → TTE-R02, H01 | — |
| `lvedd` | LVEDD | number | mm | Extractable. → H02 | — |
| `lvesd` | LVESD | number | mm | Extractable; hint "LVIDs". → H03 | — |
| `lvef` | LVEF | number | % | Extractable; hints "LVEF_BiP_Q", "EF Biplane"; ignore "EF (Teich)", "EF (Cube)". → TTE-R01, H04 | — |
| `rwt` | RWT | number | — | 0.01 step. Extractable. → H05, R11 | — |
| `lvmi` | LVMI | number | g/m² | Extractable. → H06, R11 | — |
| `gls` | 2D-GLS | number | % | 0.1 step; sign ignored. Extractable; hint "G peak SL(Avg)". → H07, R10, TTE-T04 | — |
| `lvedd_dim` | LVEDD Dimension | select | — | normal dimensioniert; leicht dilatiert; mittelgradig dilatiert; hochgradig dilatiert. ⚠ not linked to `lvedd` (D-15) | normal dimensioniert |
| `lvesd_dim` | LVESD Dimension | select | — | as `lvedd_dim` | normal dimensioniert |
| `lv_kinetik` | Kinetik / Motilität | select | — | keine Kinetikstörungen; globale Hypokinesie; regionale Wandbewegungsstörungen | keine Kinetikstörungen |
| `lv_kinetik_text` | Lokalisierte Wandbewegungsstörung spezifizieren | free text | — | visible only if `lv_kinetik` = regionale Wandbewegungsstörungen (prototype: unnamed textarea) | — |

## 4. Section: Diastolische Funktion

| Field key | Label (DE) | Type | Unit | Allowed values / notes | Default (normal) |
|---|---|---|---|---|---|
| `mitral_e` | Mitral E | number | m/s | 0.01 step. Extractable; hint "MV E". ⚠ no cm/s conversion (D-22) | — |
| `mitral_a` | Mitral A | number | m/s | 0.01 step. Extractable; hint "MV A" | — |
| `e_a_ratio` | E/A Verhältn. | number | — | 0.1 step. Extractable; hint "E/A". ⚠ entered, not derived (D-23) | — |
| `e_e_prime` | E/E' | number | — | 0.1 step. Extractable; hints "E/E' Sept", "E/e' (Sep)" ⚠ septal vs average (D-10). → H08, R10 | — |
| `diastole` | Diastolische Dysfunktion | select | — | kein Hinweis auf diastolische Dysfunktion; Hinweis auf diastolische Dysfunktion. ⚠ overwritten by the HFA-PEFF band on report generation (D-08, D-09) | kein Hinweis auf diastolische Dysfunktion |

## 5. Section: Vorhöfe, rechter Ventrikel, Pulmonaldruck

| Field key | Label (DE) | Type | Unit | Allowed values / notes | Default (normal) |
|---|---|---|---|---|---|
| `la` | LA | number | mm | Extractable. → H11 | — |
| `laesvi` | LAESVI | number | ml/m² | Extractable. Used as LAVI in R11. → H10 | — |
| `rv` | RV | number | mm | Extractable; hints "RV Länge" (prioritised), "RVAWd" ⚠ D-21. → H12 | — |
| `tapse` | TAPSE | number | mm | Extractable. → H13 | — |
| `tasv` | TASV | number | cm/s | tricuspid annular S'. Extractable; hints "TV S'", "TDI S'". → H14 | — |
| `rvsp` | RVSP | number | mmHg | Extractable (`rvsp`) or derived from `tr_max_pg` (§11). → H09, R10 | — |
| `la_diameter_qualitativ` | LA Diameter (qualitativ) | select | — | normal dimensioniert; leichtgradig dilatiert; mittelgradig dilatiert; hochgradig dilatiert. Text fallback if empty: "nicht beurteilt" | normal dimensioniert |
| `ra_diameter` | RA Diameter (qualitativ) | select | — | normwertig; leicht dilatiert; mittelgradig dilatiert; hochgradig dilatiert. ⚠ text fallback "normwertig" (D-18) | normwertig |
| `rv_diameter` | RV Diameter (qualitativ) | select | — | as `ra_diameter` ⚠ fallback "normwertig" | normwertig |
| `rv_funktion` | RV-Systolische Funktion | select | — | normal; leicht reduziert; mittelgradig reduziert; hochgradig reduziert ⚠ fallback "normal" | normal |
| `pulm_hypertonie` | Pulmonale Hypertonie | select | — | kein Hinweis; Hinweis. ⚠ not linked to `rvsp` (D-15) | kein Hinweis |

Not a form field, extraction only: `tr_max_pg` (hint "TR maxPG", mmHg) → feeds the RVSP derivation.

## 6. Section: Aortenklappe

| Field key | Label (DE) | Type | Unit | Allowed values / notes | Default (normal) |
|---|---|---|---|---|---|
| `ak_prothese` | Prothese | select | — | Ja; Nein. Initial Nein | Nein |
| `ak_prothese_typ` | Spezifischer Klappenprothesentyp | free text | — | visible if Ja (prototype: unnamed input) | — |
| `ak_sklerose` | Sklerose | select | — | zart; leicht sklerosiert; mäßig sklerosiert; schwer sklerosiert. Fallback "zart" | zart |
| `ak_taschen` | Anatomie | select | — | trikuspid; bikuspid; nicht bestimmbar. Fallback "trikuspid" | trikuspid |
| `ak_stenose` | Stenose | select | — | keine; leichtgradig; mittelgradig; hochgradig. ⚠ uninflected (TTE F-15). Physician-assigned. | keine |
| `ak_vmax` | Vmax | number | m/s | 0.1 step. Extractable (`av_vmax`; hints "AV Vmax", "Vmax Aorta", "Vmax AV") | — |
| `ak_dp` | dp max/mean | text | mmHg | "max/mean", e.g. "40/25". Filled from extracted `av_max_pg` ("AV maxPG", "Pmax Aorta") and `av_mean_pg` ("AV meanPG", "Pmean Aorta"). ⚠ two numbers in one text field | — |
| `ak_aoef` | AÖF nach KG | number | cm² | 0.1 step. Extractable (`av_area`; "AVA", "AÖF", "AV Area") | — |
| `ak_insuffizienz` | Aortenklappeninsuffizienz | select | — | keine; leichte; mittelgradige; hochgradige. Physician-assigned. | keine |
| `ak_jet` | Jetrichtung | select | — | klein zentral; zentral bis Mitte LV; zentral bis LV-Spitze; exzentrisch bis Mitte LV; exzentrisch bis LV-Spitze. Visible if AI mittel/hoch | — |
| `ak_jet_breite` | Jet/LVOT Breite | select | — | <30%; 30-50%; >50%. ⚠ never output (D-28) | — |
| `ak_pht` | PHT | number | ms | visible if AI mittel/hoch | — |
| `ak_suprasternal` | Aortic Flow | select | — | kein holodiast. Rückfluss; holodiast. Rückfluss. ⚠ never output | — |

## 7. Section: Mitralklappe

| Field key | Label (DE) | Type | Unit | Allowed values / notes | Default (normal) |
|---|---|---|---|---|---|
| `mk_prothese` | Prothese | select | — | Ja; Nein | Nein |
| `mk_prothese_typ` | Spezifischer Klappenprothesentyp | free text | — | visible if Ja | — |
| `mk_segel` | Segel sklerosiert | select | — | zart; leicht sklerosiert; mäßig sklerosiert; schwer sklerosiert. Fallback "zart" | zart |
| `mk_insuffizienz` | Insuffizienz | select | — | keine; leichte; mittelgradige; hochgradige. Physician-assigned. | keine |
| `mk_stenose` | Stenose | select | — | keine; leichte; mittelgradige; hochgradige | keine |
| `mk_jet` | Jetrichtung | select | — | zentral; exzentrisch medial; exzentrisch lateral. Visible if MI ≠ keine | — |
| `mk_mechanismus` | Pathomechanismus | select | — | unbeurteilbar; Mitralklappenprolaps; Flail Leaflet; Tethering / Tenting; Großer Koaptationsdefekt / schweres Tenting | — |
| `mk_konvergenzzone` | PISA Konvergenzzone | select | — | nicht groß; große holosystolische | nicht groß |
| `mk_e_welle_dominant` | Mitralis Einstrom | select | — | nicht E-dominant; E-Welle dominant (>1.2 m/s) | nicht E-dominant |
| `mk_vc` | Vena Contracta (VC) | number | mm | | — |
| `mk_pisa` | PISA-Radius | number | mm | | — |
| `mk_eroa` | EROA | number | cm² | 0.01 step | — |
| `mk_dp` | dp max/mean | text | mmHg | visible if MS ≠ keine | — |

## 8. Section: Trikuspidal- und Pulmonalklappe

| Field key | Label (DE) | Type | Unit | Allowed values / notes | Default (normal) |
|---|---|---|---|---|---|
| `tk_prothese` | Prothese | select | — | Ja; Nein | Nein |
| `tk_prothese_typ` | Prothesentyp | free text | — | visible if Ja | — |
| `tk_segel` | Segelbeschaffenheit | select | — | zart; leicht sklerosiert; mäßig sklerosiert; schwer sklerosiert | zart |
| `tk_insuffizienz` | Insuffizienz | select | — | keine; physiologisch; leichte; mittelgradige; hochgradige. ⚠ 3 grades vs TEE 5 (D-17) | physiologisch |
| `tk_jet` | Jet | select | — | zentral; exzentrisch medial; exzentrisch lateral. Visible if TR mittel/hoch | — |
| `tk_vc` | VC | text ⚠ | mm | | — |
| `tk_pisa` | PISA | text ⚠ | mm | | — |
| `tk_stenose` | Stenose | select | — | keine; leichte; mittelgradige; hochgradige. ⚠ never output | keine |
| `tk_dp` | dp max/mean | text | mmHg | ⚠ never output | — |
| `pk_funktion` | Klappenfunktion (Pulmonalklappe) | select | — | normal; leichte Insuffizienz; mittelgradige Insuffizienz; hochgradige Insuffizienz. Fallback "normal" | normal |

## 9. Section: Aorta, V. cava inferior, Perikard

| Field key | Label (DE) | Type | Unit | Allowed values / notes | Default (normal) |
|---|---|---|---|---|---|
| `aortenwurzel` | Aortenwurzel | number | mm ⚠ unit not shown in UI | Extractable | — |
| `aorta_ascendens_val` | Aorta asc. | number | mm ⚠ unit not shown | Extractable | — |
| `aorta_ascendens` | Aorta ascendens | select | — | normwertig; dilatiert. Fallback "normwertig dimensioniert" | normwertig |
| `vci` | VCI | number | mm | Extractable. → H15; feeds the RVSP derivation | — |
| `perikarderguss` | Perikarderguss (PE) | select | — | kein Perikarderguss; geringer Perikarderguss; mittelgroßer Perikarderguss; großer Perikarderguss | kein Perikarderguss |
| `perikard_text` | Zusätzliche Ergussbeschreibung | free text | — | visible if PE ≠ kein | "" |
| `herzhoehlen` | Kompression | select | — | Herzhöhlen entfaltet; RA komprimiert; RV komprimiert; LV komprimiert | — |
| `relevanz` | Hämodynamik | select | — | keine hämodynamische Relevanz; beginnende hämodynamische Relevanz; Swinging Heart Zeichen | — |

## 10. Section: Laborchemische Biomarker

| Field key | Label (DE) | Type | Unit | Allowed values / notes | Default (normal) |
|---|---|---|---|---|---|
| `bnp` | BNP | number | pg/ml | Extractable. → H16, R12 | — |
| `nt_probnp` | NT-proBNP | number | pg/ml ⚠ unit not shown | Extractable. → H17, R12 | — |

## 11. Derived values

| Key | Label (DE) | Formula | Unit | Notes |
|---|---|---|---|---|
| `rvsp` (derived) | RVSP | `ceil(tr_max_pg) + RAP`; `RAP = 10` if `vci > 20` else `5` (empty VCI → 5) | mmHg | extraction-time only; ⚠ RAP scheme D-16 |
| `hfpeff_score` | HF-PEFF Score | functional (0–2) + morphological (0–2) + biomarker (0–2), TTE-R10…R12 | points 0–6 | ⚠ multi-finding → display-only at most under CLAUDE.md rule 5 (D-48) |
| unit normalisation | — | cm → mm (`×10`) except tasv/mitral_e/mitral_a; TASV m/s → cm/s (`×100` if unit m/s or 0 < v < 3) | — | ⚠ in the new design a unit mismatch discards the value (gateway §4.3); conversion only in code (D-22) |
| not derived | E/A; RWT, LVMI (need PWd + BSA); LAESVI (needs BSA) | — | — | ⚠ D-23 |

## 12. Section: Zusammenfassung / Empfehlung

| Field key | Label (DE) | Type | Notes |
|---|---|---|---|
| (generated) | Zusammenfassung | text | comma-joined fragments TTE-S; not editable in the prototype |
| `empfehlung_disease` | Nachsorgepfad generieren für Krankheitsbild | select | Herzinsuffizienz; Vorhofflimmern; Myokardinfarkt → TTE-B blocks. ⚠ therapy recommendations — excluded by CLAUDE.md (D-49) |

## 13. Reference thresholds and classification

| Rule | Input | Single value? | Auto-classify allowed (CLAUDE.md rule 5)? |
|---|---|---|---|
| TTE-R01 LVEF category | `lvef` (+ sex) | yes | yes |
| TTE-R02 wall thickness | `ivsd` (+ sex) | yes | yes (wording D-13) |
| TTE-H01…H17 out-of-range highlight | one field each | yes | yes (highlight only) |
| TTE-R10…R13 HFA-PEFF | up to 8 fields | **no** | **no** as report text (D-48) |
| LV/LA/RA/RV size from a dimension | one field | yes | yes, if you want it (D-15) |
| Valve grades, PH probability | several | no | no — physician-assigned |

Carry-over requirement: each rule set becomes a `reference/tte-*.json` file with `source` and `reviewedOn` (gateway §5.2). None of the prototype rules names a guideline. Sex- and rhythm-dependent bands need a condition dimension that the gateway `ClassificationRule` interface does not yet have (D-51).

## 14. German sentence templates

Verbatim in SPEC-textgen §TTE-T (body), §TTE-S (Zusammenfassung), §TTE-B (Empfehlung).
"Alles normal" = Default (normal) column above. ⚠ The prototype preset leaves numeric values in place.

## 15. Report section order

1. `Transthorakale Echokardiographie:` · Indikation · Rhythmus
2. `Messwerte:` — one line `{Name}: {Wert} {Einheit}; …` in the order IVSd, LVEDD, LVESD, LVEF, LA, RV, TAPSE, TASV, RVSP, LAESVI, Mitral E, Mitral A, E/A Verhältnis, E/E', Aortenwurzel, Aorta ascendens, VCI, 2D-GLS, RWT, LVMI, BNP, NT-proBNP
3. `BEFUND:` `Linker Ventrikel:` …
4. `Vorhöfe und Rechter Ventrikel:` …
5. `Klappenbefund:` Aortenklappe / Mitralklappe / Trikuspidalklappe + Pulmonalklappe (same line)
6. `Aorta und Perikard:` …
7. `Zusammenfassung:`
8. `Empfehlung:` (optional)

PDF (prototype): title "Echokardiographie Befund", "Patient: …" / "Datum: …", measurement table "Parameter | Wert", "Befundtext:" + text.

## 16. Implementation notes

- Extractable fields in the prototype: ivsd, lvedd, lvesd, lvef, la, rv, tapse, tasv, rvsp, laesvi, mitral_e, mitral_a, e_a_ratio, e_e_prime, aortenwurzel, aorta_ascendens_val, vci, gls, tr_max_pg, av_vmax, av_max_pg, av_mean_pg, av_area, rwt, lvmi, bnp, nt_probnp. `expectedUnit` and `plausibleRange` must be set per field (gateway §3.4); none exist yet (D-50).
- The prototype's conditional blocks (AI/MI/TR details, prosthesis type, WMA text, PE details) map onto the generic conditional visibility.
- Hidden fields that still hold values leak into the prototype text (AI details for "leichte"); hidden values must be ignored by the generator (D-18).

## A. Audit — TTE

### A.1 Technical profile

| Aspect | Finding |
|---|---|
| Framework | **Vanilla TypeScript, DOM-based** (not React); Vite 6; 2 files (`index.html` 1134 lines, `index.tsx` 1139 lines). |
| Styling | Tailwind v4 (installed) + Google Fonts CDN. |
| Dependencies | `@google/genai` "latest" (unpinned, and also via importmap from `esm.run`), `jspdf`, `jspdf-autotable`. |
| State | Dropdown display strings are both the state and the report text. |
| Persistence | none. |
| Secrets | Gemini key inlined into the bundle via `vite.config.ts`. |
| Tests | none. |
| Quality | **2 / 5** |

### A.2 Model usage ⚠

| Item | Finding |
|---|---|
| Model | `gemini-3.8-flash` (earlier `gemini-3-flash-preview`), called from the browser. |
| Sent | Whole uploaded image/PDF (base64) + German prompt (verbatim: SPEC-textgen §X-1). |
| Returned | JSON `{key: {value, unit}}` for 27 keys. |
| Clinical wording from the model? | **No.** Numbers only; all text from code. ✅ |
| Deviations from the gateway spec | No provenance (page, bounding box, rawText, confidence) — every value would be **discarded** under gateway §3.1; no unconfirmed state; no plausibility or unit rejection; the prompt performs a unit conversion; cloud call with identifiable documents; key in the client. Provider (Gemini) differs from the planned Mistral OCR — the prompt is reference material only. |

### A.3 Flags

| # | Flag |
|---|---|
| F-01 | ⚠ HFA-PEFF score ≥ 2 → "Hinweis auf diastolische Dysfunktion"; 2–4 is intermediate. Panel text "Diagnose von HFpEF ist kardiologisch gesichert" overstates. Multi-finding → conflicts with CLAUDE.md rule 5. (D-08, D-48) |
| F-02 | ⚠ Score applied regardless of LVEF (HFA-PEFF presupposes LVEF ≥ 50 %). |
| F-03 | ⚠ Prompt maps "RVAWd" (RV wall thickness) and "RV Länge" to a field banded as basal RV diameter. (D-21) |
| F-04 | ⚠ Septal E/e' used against average-E/e' cut-offs; e' criteria missing. (D-10) |
| F-05 | ⚠ LAVI bands ignore AF. (D-11) |
| F-06 | ⚠ LVMI minor uses `>` not ≥. (D-12) |
| F-07 | ⚠ IVSd bands differ from ASE/EACVI 2015; "hypertrophiert" from IVSd alone. (D-13) |
| F-08 | ⚠ LVEF: text boundary 41 vs highlight 40. (D-14) |
| F-09 | ⚠ IVSd: text > 10/9, highlight and score ≥ 12. |
| F-10 | ⚠ Numbers and qualitative selects are unlinked and can contradict. (D-15) |
| F-11 | ⚠ RAP 5/10 by VCI > 20 vs ASE 3/8/15; highlight uses 21. (D-16) |
| F-12 | ⚠ "Die Vena cava inferior ist normalkalibrig …" always printed. (D-16) |
| F-13 | ⚠ Empty = normal wording for RA, RV, RV function, AK, MK, TK, PK, aorta, kinetics, PH. (D-18) |
| F-14 | ⚠ Prostheses always "in regelrechter Funktion". (D-19) |
| F-15 | ⚠ "eine leichtgradig Aortenstenose"; summary "AS I" without °. |
| F-16 | ⚠ `getAdjectiveForm` → "leichte reduzierte LV-Funktion". |
| F-17 | ⚠ "Zusätzlich besteht …" for AI even without AS; AI details printed for "leichte" if set earlier. |
| F-18 | ⚠ HFpEF sentence begins in lower case. |
| F-19 | ⚠ "Herzinsuffizienz" recommendation is one patient's letter (Klinikum Chemnitz); VHF/MI placeholders; therapy recommendations. (D-20, D-49) |
| F-20 | ⚠ User's diastole selection is silently overwritten. |
| F-21 | ⚠ Mitral E/A in cm/s not converted. (D-22) |
| F-22 | ⚠ TASV possibly converted twice. |
| F-23 | ⚠ `ak_jet_breite`, `ak_suprasternal`, `tk_stenose`, `tk_dp` never output. |
| F-24 | "Status präsens" → Latin "Status praesens". (D-24) |
| F-25 | GLS sentence only for "vor Chemotherapie"; wording "unmöglich". |
| F-26 | AV-Block III treated as SR for biomarker bands. |
| F-27 | Summary "Kein PE" capitalised mid-list; RA/RV, PH, WMA, prostheses absent from summary. |
| F-28 | The earlier commit had a manual diastolic grade sentence, since lost. (D-09) |
| F-29 | "Pulmonalklappe: Die Funktion ist leichte Insuffizienz." — ungrammatical for non-normal values. |

---
---

# Modul 2: Device-Abfrage (SM / ICD / CRT-P / CRT-D)

## 1. Module identity

| Property | Value |
|---|---|
| Module key | `device` |
| Display name | Device-Abfrage |
| Document extraction | yes (v1, CLAUDE.md) |
| Prototype | `rady3000/HSM_Abfrage` — **not accessible in this session** |

## 2.–16.

**Blocked (D-01).** As a v1 extraction module this is the most urgent gap.
Constraint already known from gateway §2.6.4: device serial and model numbers
are **never** extractable. No content will be written from memory.

---
---

# Modul 3: TEE — Transösophageale Echokardiographie

## 1. Module identity

| Property | Value |
|---|---|
| Module key | `tee` |
| Display name | Transösophageale Echokardiographie (TEE) |
| Report title | `Transösophageale Echokardiographie (TEE)` |
| Bilateral | no |
| Document extraction | later |
| Normal preset | button "Normale TEE" |

## 2. Section: Untersuchungsdaten

| Field key | Label (DE) | Type | Unit | Allowed values / notes | Default (normal) |
|---|---|---|---|---|---|
| `indikation` | Indikation | select | — | Ausschluss intrakardiale Thromben; Kardiale Emboliequelle?; V.a. Endokarditis; Klappenvitien; Sonstige Indikation. "V.a. Endokarditis" shows the endocarditis checks | Ausschluss intrakardiale Thromben |
| `sedierung` | Sedierung | select | — | Komplikationslose Sondenführung unter lokaler Anästhesie; Erschwerte Sondenführung mit zusätzlicher Sedierung | Komplikationslose Sondenführung unter lokaler Anästhesie |
| `sedierung_dosis` | Propofol-Dosis | text | — | e.g. "100 mg"; visible for the second option. ⚠ D-30 | — |

⚠ The prototype's patient and date inputs are never used (TEE F-02).

## 3. Section: Messwerte

| Field key | Label (DE) | Type | Unit | Allowed values / notes | Default (normal) |
|---|---|---|---|---|---|
| `laa_fluss` | LAA Fluss | number | cm/s | ⚠ not linked to `laa_fluss_qualitativ` (D-26) | — |
| `lvot` | LVOT | number | mm | | — |
| `aortenwurzel_tee` | Aortenwurzel | number | mm | | — |
| `aorta_ascendens_tee` | Aorta ascendens | number | mm | | — |
| `aorta_descendens_tee` | Aorta descendens | number | mm | | — |

## 4. Section: Linksventrikuläre Funktion

| Field key | Label (DE) | Type | Unit | Allowed values / notes | Default (normal) |
|---|---|---|---|---|---|
| `lvef` | LVEF | select | — | normal; leichtgradig reduziert; mittelgradig reduziert; hochgradig reduziert (⚠ qualitative only; wording differs from TTE) | normal |

## 5. Section: Thromben & interatriales Septum

| Field key | Label (DE) | Type | Unit | Allowed values / notes | Default (normal) |
|---|---|---|---|---|---|
| `thromben` | Intrakardiale Thromben | select | — | Kein Hinweis; Präthrombotische Formationen im LAA; Nachweis. ⚠ D-25 | Kein Hinweis |
| `thromben_beschreibung` | Thrombus beschreiben | free text | — | visible if Nachweis | — |
| `laa_fluss_qualitativ` | LAA Fluss | select | — | Normal; Gering reduziert; Schwer reduziert | Normal |
| `ias_befund` | IAS | select | — | Kein Hinweis auf PFO/ASD; Nachweis eines PFO; Nachweis eines ASD | Kein Hinweis auf PFO/ASD |
| `ias_beschreibung` | Defekt beschreiben | free text | — | visible if PFO/ASD | — |

## 6. Section: Aortenklappe

| Field key | Label (DE) | Type | Unit | Allowed values / notes | Default (normal) |
|---|---|---|---|---|---|
| `ak_prothese` | Prothese | select | — | Ja; Nein | Nein |
| `ak_prothese_typ` | Prothesentyp | free text | — | visible if Ja | — |
| `ak_taschen` | Taschen | select | — | Trikuspid; Bikuspid; Nicht bestimmbar | Trikuspid |
| `ak_segel` | Segel | select | — | Zart; Leicht sklerosiert; Mäßig sklerosiert; Schwer sklerosiert | Zart |
| `ak_stenose` | Stenose | select | — | Keine; Leichtgradig; Mittelgradig; Hochgradig | Keine |
| `ak_3d_aoef` | 3D-AÖF | number | cm² | 0.1 step; visible if AS mittel/hoch | — |
| `ak_insuffizienz` | Schweregrad | select | — | Keine; Leichtgradig; Mittelgradig; Hochgradig | Keine |
| `ak_mechanismus` | Mechanismus | select | — | Typ I (normale Segel, Aortendilatation); Typ Id (Segelperforation); Typ II (Segelprolaps); Typ III (Verkalkung/Fibrose). Visible if AI mittel/hoch | — |
| `ak_jet` | Jet | select | — | Zentral; Exzentrisch medial; Exzentrisch lateral. ⚠ never output | — |
| `ak_jet_breite` | Jetbreite/LVOT | select | — | < 30%; 30-50%; > 50% | — |
| `ak_vc` | VC | number | mm | | — |
| `ak_rueckfluss` | Holodiast. Rückfluss | select | — | Nein; Ja | — |
| `ak_endokarditis` | Hinweis auf Endokarditis | select | — | Nein; Ja. Visible if indication = V.a. Endokarditis | Nein |
| `ak_endokarditis_beschreibung` | Vegetationen, Abszess, etc. beschreiben | free text | — | visible if Ja | — |

## 7. Section: Mitralklappe

| Field key | Label (DE) | Type | Unit | Allowed values / notes | Default (normal) |
|---|---|---|---|---|---|
| `mk_prothese` / `mk_prothese_typ` | Prothese / Prothesentyp | select / free text | — | Ja; Nein | Nein |
| `mk_segel` | Segel | select | — | Zart; Leicht sklerosiert; Mäßig sklerosiert; Schwer sklerosiert | Zart |
| `mk_insuffizienz` | Insuffizienz | select | — | Keine; Leichtgradig; Mittelgradig; Hochgradig | Keine |
| `mk_mechanismus` | Mechanismus | select | — | Segel-/Papillarmuskelruptur; Segelprolaps; Ringdilatation; Sonstiges. Visible if MI mittel/hoch | — |
| `mk_mechanismus_beschreibung` | Mechanismus beschreiben | free text | — | | — |
| `mk_jet` | Jet | select | — | Zentral; Exzentrisch medial; Exzentrisch lateral. ⚠ never output | — |
| `mk_2d_vc` | 2D-VC | number | mm | | — |
| `mk_2d_pisa` | 2D-PISA | number | mm | ⚠ never output | — |
| `mk_2d_eroa` | 2D-EROA | number | cm² | ⚠ never output | — |
| `mk_3d_vca` | 3D-VCA | number | cm² | | — |
| `mk_retrogradfluss` | Retrogradfluss Pulmonalvenen | select | — | Nein; Ja | — |
| `mk_endokarditis` (+ `_beschreibung`) | Hinweis auf Endokarditis | select | — | as AK | Nein |

### 7.1 Subsection: M-TEER-Eignungsprüfung (visible if MI = Hochgradig)

| Field key | Label (DE) | Type | Unit | Allowed values / notes | Default |
|---|---|---|---|---|---|
| `mk_teer_pathologie` | Pathologie/Lokalisation | select | — | Zentrale Pathologie; Isolierte kommissurale Läsion; Kommissurale Läsion mit multiplen Jets; M. Barlow; Rheumatische Genese | — |
| `mk_teer_verkalkung` | Verkalkung | select | — | Keine; Anulär ohne Segelbeteiligung; Anulär mit Segelbeteiligung; MAC mit Stenose; In der Greifzone | — |
| `mk_teer_segel_integritaet` | Segelintegrität | select | — | Intakt; Fibrotisch; Cleft; Tiefer Cleft; Perforation | — |
| `mk_teer_tethering` | Tethering | select | — | Kein relevantes Tethering; Asymmetrisches Tethering | — |
| `mk_teer_jet_charakter` | Jet Charakteristika | select | — | Keine Besonderheit; Zwei Jets (Indentationen); Breiter Jet (ges. Koaptation); Multiple/breite Jets | — |
| `mk_teer_vor_op` | Vor-Operationen | select | — | Keine; Z.n. frustraner Anuloplastie | — |
| `mk_teer_mva` | MVA | number | cm² | 0.1 step | — |
| `mk_teer_gradient` | Mittl. Gradient | number | mmHg | | — |
| `mk_teer_post_segel_laenge` | Post. Segel | number | mm | | — |
| `mk_teer_tenting_hoehe` | Tenting Höhe | number | mm | | — |
| `mk_teer_flail_gap` | Flail Gap | number | mm | | — |
| `mk_teer_flail_weite` | Flail Weite | number | mm | | — |
| `mk_teer_coapt_reserve` | Coaptation Reserve | number | mm² ⚠ | | — |
| `mk_teer_segel_anulus_index` | Segel-Anulus-Index | number | — | 0.01 step | — |
| `mk_teer_gesamteignung` | Gesamteignung für TEER | select | — | Ideal; Geeignet; Anspruchsvoll; Schwierig / Unmöglich. Physician-assigned (multi-finding, rule 5) | — |

## 8. Section: Trikuspidalklappe

| Field key | Label (DE) | Type | Unit | Allowed values / notes | Default (normal) |
|---|---|---|---|---|---|
| `tk_prothese` / `tk_prothese_typ` | Prothese / Prothesentyp | select / free text | — | Ja; Nein | Nein |
| `tk_segel` | Segel | select | — | Zart; Leicht sklerosiert; Mäßig sklerosiert; Schwer sklerosiert | Zart |
| `tk_insuffizienz` | Insuffizienz | select | — | Keine Insuffizienz; Grad I (leicht); Grad II (moderat); Grad III (hoch); Grad IV (massiv); Grad V (torrential). ⚠ details visible only for Grad V (bug, TEE F-05) | Keine Insuffizienz |
| `tk_mechanismus` (+ `_beschreibung`) | Mechanismus | select | — | Primär; Sekundär | — |
| `tk_jet` | Jet | select | — | Zentral; Exzentrisch medial; Exzentrisch lateral | — |
| `tk_2d_vc`, `tk_2d_pisa` | 2D-VC, 2D-PISA | number | mm | | — |
| `tk_2d_eroa`, `tk_3d_vca` | 2D-EROA, 3D-VCA | number | cm² | | — |
| `tk_teer_geeignet` | Geeignet für TEER | select | — | Ja; Nein | — |
| `tk_endokarditis` (+ `_beschreibung`) | Hinweis auf Endokarditis | select | — | as AK | Nein |

## 9. Derived values

None in the prototype.

## 10. Section: Zusammenfassung

Generated only (TEE-S); no editable field in the prototype.

## 11. Reference thresholds and classification

None implemented. Candidate single-value mapping: LAA flow velocity → qualitative (D-26). Valve grades and TEER suitability stay physician-assigned (rule 5).

## 12. German sentence templates

SPEC-textgen §TEE-T, §TEE-S.

## 13. Report section order

1. `Transösophageale Echokardiographie (TEE)` · `Indikation: …` · sedation sentence
2. `Messwerte:` (LAA Fluss, LVOT, Aortenwurzel, Aorta ascendens, Aorta descendens)
3. `BEFUND:` LVEF · thrombi · LAA flow · IAS
4. `Klappenbefund:` Aortenklappe / Mitralklappe (+ M-TEER block) / Trikuspidalklappe
5. `Zusammenfassung:`

## 14. Implementation notes

Copy only (plain text) in the prototype; no header, no examiner. The sedation block is a candidate for sharing with CV (D-30).

## A. Audit — TEE

### A.1 Technical profile

Vanilla TypeScript, DOM-based (same pattern as TTE; `react` listed but unused); Tailwind v4; no persistence; Gemini key inlined but unused; no tests. **Quality 2 / 5.**

### A.2 Model usage

**None.**

### A.3 Flags

| # | Flag |
|---|---|
| F-01 | ⚠ "Präthrombotische Formationen im LAA" → the summary says so, while the body says "Kein Nachweis von intrakardialen Thromben, insbesondere im linken Vorhofohr (LAA)." Non-standard term. (D-25) |
| F-02 | ⚠ Patient and date collected, never used. |
| F-03 | ⚠ "eine leichtgradig Aortenstenose", "eine mittelgradig Aortenklappeninsuffizienz". |
| F-04 | ⚠ Aortic valve "die Segel sind …"; the field "Taschen" holds morphology. |
| F-05 | ⚠ Bug: `startsWith('Grad I')` hides TR details for Grad I–IV (only V shown); the report drops them too. |
| F-06 | ⚠ `ak_jet`, `mk_jet`, `mk_2d_pisa`, `mk_2d_eroa` never output. (D-28) |
| F-07 | ⚠ TR 5-grade vs AS/AI/MI 3-grade; TTE TR 3-grade. (D-17) |
| F-08 | ⚠ LVEF wording "leichtgradig reduziert" vs TTE "leicht reduziert". |
| F-09 | ⚠ No aortic atheroma, bubble test, pulmonic valve, pericardium. (D-27) |
| F-10 | ⚠ Sedation: Propofol only; "wurde gut toleriert" fixed. (D-30) |
| F-11 | ⚠ M-TEER numbers do not feed any rule; suitability manual. (D-29) |
| F-12 | "holosystolischer Rückfluss in den Pulmonalvenen" (standard: systolische Flussumkehr). |
| F-13 | Summary thrombus statement depends on other findings. |
| F-14 | "Normale TEE" does not clear numbers/text. |
| F-15 | ⚠ M-TEER / T-TEER suitability sentences are close to a treatment recommendation (CLAUDE.md). (D-49) |

---
---

# Modul 4: Karotis-Duplexsonographie

No prototype. Specified in `SPEC-carotis.md` (format reference). Not audited.

---
---

# Modul 5: Schrittmacher-Implantation (OP-Bericht)

## 1. Module identity

| Property | Value |
|---|---|
| Module key | `sm_impl` |
| Display name | Schrittmacher-Implantation (prototype: "HSM Implantationsmaske") |
| Report title | `Operationsbericht` under `{clinic}` |
| Bilateral | no |
| Document extraction | later |
| Normal preset | "Vitatron Standard", "Abbott Standard" (keep patient, clear measurements) |

## 2. Section: Allgemeine Daten / Prozedurdetails

| Field key | Label (DE) | Type | Unit | Allowed values / notes | Default |
|---|---|---|---|---|---|
| `clinic` | — | fixed | — | "Klinik für Kardiologie" | fixed |
| `operator` | — | fixed | — | "Dr. med. Mohamed Rady" → shared examiner | fixed |
| `operation_date` | Operationsdatum | date | — | | today |
| `diagnosis` | Diagnose | select | — | AV-Block II° Mobitz Typ; AVB III°; symptomatisches SSS; symptomatisches BTS; symptomatisches Trifaszikulärblock mit Synkopen; Aggregatwechsel; Sonstiges. ⚠ F-07, D-36 | Sonstiges |
| `custom_diagnosis` | Indikation (sonstiges) | text | — | visible if Sonstiges | — |
| `initial_indication` | Initiale Indikation | text | — | visible if Aggregatwechsel. ⚠ never reaches output (F-02) | — |
| `procedure` | Prozedur | select | — | DDD-HSM (Zweikammer); VVI-HSM (Einkammer); CRT-P; CRT-D; VR-ICD (Einkammer-ICD); DR-ICD (Zweikammer-ICD); S-ICD. ⚠ D-31 | DDD-HSM (Zweikammer) |
| `implant_side` | Implantationsseite | select | — | links; rechts | links |
| `anesthetic` | Lokalanästhesie | text | — | | ca. 20 ml Xylocain 1% |
| `puncture_site` | Venenpunktion | select | — | Vena axillaris; Vena cephalica; Vena subclavia; Kein Zugang (Abbruch). Hidden for Aggregatwechsel. ⚠ D-34 | Vena axillaris |

## 3. Section: Implantierte Komponenten

| Field key | Label (DE) | Type | Unit | Allowed values / notes | Default |
|---|---|---|---|---|---|
| `generator_manufacturer` | Aggregat | select | — | Endurity Core PM 2512; Vitatron Q70; Vitatron G70; Vitatron Q20; Ellipse VR; Ellipse DR. ⚠ holds model names (F-10, D-35). Auto-fills procedure and leads (§7). | — |
| `generator_model` | — | — | — | never editable → always "–" | — |
| `ra_sonde_manufacturer` / `ra_sonde_model` | RA-Sonde Hersteller / Modell | text | — | hidden if single-chamber or Aggregatwechsel | — |
| `rv_sonde_manufacturer` / `rv_sonde_model` | RV-Sonde Hersteller / Modell | text | — | hidden if Aggregatwechsel | — |

(Model and serial numbers are entered manually; gateway §2.6.4 forbids extracting them.)

## 4. Section: Messwerte (intraoperativ)

| Field key | Label (DE) | Type | Unit | Allowed values / notes | Default |
|---|---|---|---|---|---|
| `ra_sensing` | P-Welle | text ⚠ | mV (placeholder "z.B. 5 mV") | hidden if single-chamber | — |
| `ra_threshold` | Reizschwelle (V/ms) | text ⚠ | V/ms | "z.B. 0,8/0,4" | — |
| `ra_impedance` | Impedanz (Ω) | text ⚠ | Ω | "z.B. 482" | — |
| `rv_sensing` | R-Zacke | text ⚠ | mV | "z.B. 7,5 mV" | — |
| `rv_threshold` | Reizschwelle (V/ms) | text ⚠ | V/ms | "z.B. 0,5/0,4" | — |
| `rv_impedance` | Impedanz (Ω) | text ⚠ | Ω | "z.B. 650" | — |

(Prototype keys: `raSondeMeasurements.{sensing,threshold,impedance}`, `rvSondeMeasurements.*`.)

## 5. Section: Strahlenschutzdaten

| Field key | Label (DE) | Type | Unit | Allowed values / notes | Default |
|---|---|---|---|---|---|
| `fluoro_time` | Durchleuchtungszeit (min:sec) | text | min:sec ⚠ printed as "Minuten" (D-37) | "z.B. 10:47" | — |
| `dap` | Dosis-Flächen-Produkt | text | cGy·cm² | "z.B. 1935" | — |

## 6. Section: Weiteres Vorgehen & Wundversorgung

| Field key | Label (DE) | Type | Unit | Allowed values / notes | Default |
|---|---|---|---|---|---|
| `postop_sandbag` | Sandsack und Bettruhe für 6 Stunden | boolean | — | | ja |
| `postop_xray` | Röntgen-Thorax-Kontrolle | boolean | — | | ja |
| `postop_discharge_today` | Entlassung heute möglich | boolean | — | | nein |
| `wound_no_suture_removal` | Keine Nahtentfernung nötig | boolean | — | mutually exclusive with next | ja |
| `wound_suture_removal_gp` | Fäden entfernen durch den Hausarzt | boolean | — | switches the suture wording | nein |

## 7. Derived values

| Key | Label (DE) | Formula | Unit | Notes |
|---|---|---|---|---|
| `is_single_chamber` | — | procedure ∈ {VVI-HSM, VR-ICD, S-ICD} | — | controls RA fields and text |
| `contralateral_side` | — | links ↔ rechts | — | failed-access text |
| `procedure_prefix` | — | Abbruch → "Versuchte", else "Erfolgreiche" | — | |

Generator auto-fill:

| Aggregat | Prozedur | RA-Sonde | RV-Sonde |
|---|---|---|---|
| Vitatron Q70 / G70 | DDD | Medtronic, 5076 - 52 cm | Medtronic, 4076 - 58 cm |
| Vitatron Q20 | VVI | cleared | Medtronic, 4076 - 58 cm |
| Endurity Core PM 2512 | DDD | Tendril STS, 2088TC - 52 cm | Tendril STS, 2088TC - 58 cm |
| Ellipse VR | VR-ICD | cleared | unchanged |
| Ellipse DR | DR-ICD | unchanged | unchanged |

Presets: Vitatron Standard (diagnosis AVB III°; G70 + 5076/4076); Abbott Standard (Sonstiges → "Symptomatischer, atrioventrikulärer (AV) Block III. Grades"; Endurity Core + Tendril STS 2088TC 52/58 cm). Both: DDD, links, Axillaris, ca. 20 ml Xylocain 1%, sandbag + X-ray, no suture removal.

## 8. Section: Beurteilung

None; the report ends with "Weiteres Vorgehen" and "Wundversorgung" bullets (post-procedure orders — see D-49).

## 9. Reference thresholds and classification

None. No lead-measurement bands (D-33), although the text asserts "exzellente"/"gute Messwerte".

## 10. German sentence templates

SPEC-textgen §SM (SM-T01…T23).

## 11. Report section order

1. `{clinic}` · `Operationsbericht` · Datum · Patient · Operateur
2. Diagnose (+ Initiale Indikation)
3. Prozedur
4. Aufklärung
5. Bericht (narrative)
6. Messwerte (intraoperativ) — table Sonde | P-Welle/R-Zacke | Reizschwelle | Impedanz
7. Implantierte Komponenten — table Komponente | Hersteller | Modell
8. Strahlenschutzdaten — table Parameter | Wert | Einheit
9. Weiteres Vorgehen — bullets
10. Wundversorgung — bullets
11. Signature `{operator}`

## 12. Implementation notes

One report model → one generator (the prototype's three hand-written renderers diverge, F-01). Measurement tables are genuine tables in DOCX/PDF and tab-aligned in the clipboard (as SPEC-carotis §9).

## A. Audit — SM-Implantation

### A.1 Technical profile

React 19 + TypeScript, Vite 6; `docx` 8.5.0, `file-saver` 2.0.5 **and** an importmap to `aistudiocdn.com`/`esm.sh`; Tailwind via CDN play script; typed `ReportData`; no persistence; key inlined but unused; no tests. **Quality 2 / 5.**

### A.2 Model usage

None at runtime. The fixed narrative was drafted by the AI Studio model during development (`migrated_prompt_history/…json`, no patient data) → needs clinical review (D-46).

### A.3 Flags

| # | Flag |
|---|---|
| F-01 | ⚠ Three renderers diverge: the X-ray bullet has three wordings (text / preview / DOCX); DOCX prints the implantation narrative for Aggregatwechsel instead of SM-T13 (its tables are correct); the DOCX Subclavia path omits "Über eine Schleuse …". |
| F-02 | ⚠ Bug: "Initiale Indikation" written to `patient.initialIndication`, read from `initialIndication` → always "–". |
| F-03 | ⚠ CRT/ICD/S-ICD selectable, but the narrative is always a 1–2-lead pacemaker (no CS/LV lead, no shock lead, no DFT; S-ICD gets transvenous text). (D-31) |
| F-04 | ⚠ Fixed claims: "hochseptal", "an RAA … aktiv fixiert", screw-in, "exzellenten Messwerte", "gute Messwerte", "problemlos", "Positionierung war stabil". (D-32, D-33) |
| F-05 | ⚠ "subpektoral" pocket. (D-32) |
| F-06 | ⚠ V. cephalica "punktiert unter sonographischer Kontrolle". (D-34) |
| F-07 | ⚠ Grammar: "unter sonographische Kontrolle", "im hochseptale Lage", "symptomatisches Trifaszikulärblock", "AV-Block II° Mobitz Typ" (type number missing). |
| F-08 | ⚠ "Der Patient wurde … aufgeklärt" — masculine fixed. (D-40) |
| F-09 | ⚠ min:sec printed as "Minuten". (D-37) |
| F-10 | ⚠ Generator model name in the manufacturer column; model "–". (D-35) |
| F-11 | Aggregatwechsel stored as a diagnosis. (D-36) |
| F-12 | Operator hard-coded. |
| F-13 | Both wound boxes unchecked → narrative "intrakutane Naht", empty Wundversorgung. |
| F-14 | Empty DOB → "Invalid Date". |
| F-15 | The failed-access text claims all three veins, both imaging modalities and contrast, regardless of what was done. |

---
---

# Modul 6: Elektrische Kardioversion (Protokoll)

## 1. Module identity

| Property | Value |
|---|---|
| Module key | `cv` |
| Display name | Elektrische Kardioversion (prototype: "Kardioversion-Assistent") |
| Report title | `Protokoll: Elektrische Kardioversion` (print) |
| Bilateral | no |
| Document extraction | later |
| Normal preset | none ("Reset" restores initial values) |

## 2. Section: Indikation

| Field key | Label (DE) | Type | Unit | Allowed values / notes | Default (initial) |
|---|---|---|---|---|---|
| `indication_type` | Typ | select | — | Erstdiagnose; Rezidiv (value "Rezidivierend"); Vorhofflattern. ⚠ D-41 | Erstdiagnose |
| `diagnosis_date` | Datum der Erstdiagnose | date | — | visible if Erstdiagnose | today |

Sex (prototype initial **Männlich**) drives grammar → shared core, D-40.

## 3. Section: Antikoagulation & TEE

| Field key | Label (DE) | Type | Unit | Allowed values / notes | Default |
|---|---|---|---|---|---|
| `tee_status` | Status | select | — | Mit TEE (Thrombusausschluss); Ohne TEE (Glaubhafte Einnahme). ⚠ no thrombus-positive path (D-42) | Mit TEE |
| `anticoagulant_name` | — | — | — | in the data model only, never shown or used | Apixaban |

## 4. Section: Prozedur

| Field key | Label (DE) | Type | Unit | Allowed values / notes | Default |
|---|---|---|---|---|---|
| `sedation_propofol` | Propofol | number | mg | step 10; 0/empty omitted | 80 |
| `sedation_midazolam` | Midazolam | number | mg | step 0.5; 0/empty omitted | 2 |
| `electrode_position` | Elektrodenposition | select | — | Anteroposterior (Standard); Anterolateral | Anteroposterior |
| (energy) | Energie | fixed | J | 360, not editable ⚠ D-38 | 360 |

## 5. Section: Ergebnis

| Field key | Label (DE) | Type | Unit | Allowed values / notes | Default |
|---|---|---|---|---|---|
| `outcome` | Erfolg | select | — | Erfolg (1. Schock); Erfolg (Weitere Schocks); Erfolglos | Erfolg (1. Schock) |
| `sinus_rate` | Sinusfrequenz | text | /min | visible on success | 70 |
| `shock_count` | Anzahl Schocks | number | — | visible on failure; ⚠ NaN if cleared | 3 |
| `skin_reaction` | Hautrötungen sichtbar? | boolean | — | | nein |

## 6. Section: Empfehlungen ⚠ (therapy recommendations — CLAUDE.md, D-49)

| Field key | Label (DE) | Type | Unit | Allowed values / notes | Default |
|---|---|---|---|---|---|
| `rec_anticoagulant` | Antikoagulation Weiterhin | select | — | Apixaban; Rivaroxaban; Edoxaban; Dabigatran; Falithrom; Marcumar | Apixaban |
| `chadsvasc_score` | CHA₂DS₂-VASc Score | number | points | optional on success | — |
| `recommend_rhythm_control` | Rhythmuserhaltende Medikation empfehlen | boolean | — | success | nein |
| `rec_rhythm_control` | Wirkstoff | select | — | Flecainid; Amiodaron | Flecainid |
| `recommend_weight_loss` | Gewichtsreduktion | boolean | — | success | nein |
| `include_recurrence_advice` | Rhythmuserhaltende Therapie ("Bei Rezidiv: Vorstellung zur Diskussion Ic vs PVI") | boolean | — | success | nein |
| `plan_pvi` | Planung PVI | boolean | — | success | nein |
| `failure_strategy` | Strategie bei Erfolglosigkeit | select | — | Frequenzkontrolle; Amiodaron Aufsättigung | Frequenzkontrolle |

## 7. Derived values

| Key | Label (DE) | Formula | Unit | Notes |
|---|---|---|---|---|
| grammatical forms | — | female: die/der/der Patientin; male: der Patient / des Patienten / dem Patienten | — | |
| `electrode_adjective` | — | Anterolateral → "anterior-lateraler", else "anterior-posteriorer" | — | |
| `arrhythmia_noun` | — | Vorhofflattern → "Vorhofflattern(s)", else "Vorhofflimmern(s)" | — | |

## 8. Section: Beurteilung

None; section 6 "Empfehlungen und weiteres Vorgehen" takes its place.

## 9. Reference thresholds and classification

CV-R01 (CHA₂DS₂-VASc wording) — ⚠ the score is not evaluated, and the rule is itself an anticoagulation recommendation (D-39, D-49). The target rate "< 110/min" is fixed text.

## 10. German sentence templates

SPEC-textgen §CV (CV-T01…T25, CV-R01).

## 11. Report section order

1. INDIKATION UND AUFKLÄRUNG · 2. ANTIKOAGULATION UND TEE-STATUS ·
3. PROZEDERE UND SEDIERUNG · 4. ERGEBNIS DER KARDIOVERSION ·
5. POSTPROZEDURALER VERLAUF · 6. EMPFEHLUNGEN UND WEITERES VORGEHEN.
Print: header "KARDIOLOGIE / Befundbericht", "Datum: {today}" ⚠, title, text, signature lines "Untersucher", "Oberarzt/Chefarzt".

## 12. Implementation notes

The prototype's pure `generateReport(data): string` is the pattern closest to the target (typed model → deterministic generator). The sedation block is shareable with TEE (D-30).

## A. Audit — Kardioversion

### A.1 Technical profile

React 19 + TypeScript, Vite 6; importmap to `aistudiocdn.com` + Tailwind CDN play script; typed `ReportData`; pure generator service; no persistence; key inlined but unused; no tests. **Quality 3 / 5.**

### A.2 Model usage

None.

### A.3 Flags

| # | Flag |
|---|---|
| F-01 | ⚠ 360 J fixed for every shock and for flutter. (D-38) |
| F-02 | ⚠ "thrombogenes Kontrastmittel ("smoke-like echo")" — the term is spontaner Echokontrast; TEE always negative. (D-42) |
| F-03 | ⚠ OAC: sex-specific ≥2/≥3 (ESC 2020) vs CHA₂DS₂-VA (ESC 2024); any score → "dauerhaft"; failure → "lebenslang". (D-39) |
| F-04 | ⚠ "4 Wochen" pre-CV (guideline ≥ 3 weeks); no early-CV pathway. (D-39) |
| F-05 | ⚠ "persistierend" always; flutter is a third "type"; PVI/recurrence texts say Vorhofflimmern for flutter. (D-41) |
| F-06 | ⚠ "Weitere Schocks" always describes exactly two. |
| F-07 | ⚠ No procedure date or examiner; print shows today. |
| F-08 | ⚠ Both sedatives empty → "wurden  verabreicht"; "Beatmung erfolgte spontan". |
| F-09 | ⚠ Always-on: β-blocker recommendation; "ohne Komplikationen". |
| F-10 | `anticoagulant_name` unused. |
| F-11 | Default sex Männlich (TTE: weiblich). (D-40) |
| F-12 | ⚠ The whole of section 6 (OAC, antiarrhythmics, PVI, amiodarone, rate control) is therapy recommendation, which CLAUDE.md forbids. (D-49) |
