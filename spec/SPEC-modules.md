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
| 2 | `device` | HSM_Abfrage @ `df19444` | yes (v1) | audited |
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
| `ivsd` | IVSd | number | mm | integer step. Extractable. → TTE-R30-4 | — |
| `pwd` | PWd | number | mm | **new** (D-13). Extractable (label hints from sample reports, e.g. "LVPWd"). → TTE-R30-4b | — |
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
| `e_e_prime` | E/E' | number | — | 0.1 step. Extractable; value as calculated by the echo machine, **not** calculated by the app (D-10). → TTE-R20-3 | — |
| `e_prime_septal` | e' septal | number | cm/s | **new**. Reference: < 7 cm/s highlighted (TTE-R20.4) | — |
| `e_prime_lateral` | e' lateral | number | cm/s | **new**. Reference: < 10 cm/s highlighted (TTE-R20.4) | — |
| `diastole` | Diastolische Dysfunktion | select | — | kein Hinweis auf diastolische Dysfunktion; Hinweis auf diastolische Dysfunktion. ⚠ overwritten by the HFA-PEFF band on report generation (D-08, D-09) | kein Hinweis auf diastolische Dysfunktion |

## 5. Section: Vorhöfe, rechter Ventrikel, Pulmonaldruck

| Field key | Label (DE) | Type | Unit | Allowed values / notes | Default (normal) |
|---|---|---|---|---|---|
| `la` | LA | number | mm | Extractable. → H11 | — |
| `laesvi` | LAESVI | number | ml/m² | Extractable. Used as LAVI in R11. → H10 | — |
| `rv` | RV Länge | number | mm | RV dimension in the parasternal long axis; on the physician's echo reports labelled "RV Länge" (D-21, D-69 c). Extractable; hint "RV Länge". → TTE-R30-6 | — |
| `rvd1`, `rvd2` | RVD1 (basal), RVD2 (mittventrikulär) | number | mm | **new**; visible when RV Länge is dilated. → TTE-R30-6b | — |
| `tapse` | TAPSE | number | mm | Extractable. → H13 | — |
| `tasv` | TASV | number | cm/s | tricuspid annular S'. Extractable; hints "TV S'", "TDI S'". → H14 | — |
| `rvsp` | RVSP | number | mmHg | Extractable (`rvsp`) or derived from `tr_max_pg` (§11). → TTE-R20-4 | — |
| `tr_vmax` | TR-Geschwindigkeit | number | m/s | **new, extractable** (D-65 g); label hints to be taken from sample reports. → TTE-R20-4 | — |
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
| `hfpef_criteria_count` | HFpEF-Kriterien erfüllt | number of fulfilled TTE-R20 criteria (0–4) | — | replaces the removed HFA-PEFF score (D-48) |
| unit normalisation | — | cm → mm (`×10`) except tasv/mitral_e/mitral_a; TASV m/s → cm/s (`×100` if unit m/s or 0 < v < 3) | — | ⚠ in the new design a unit mismatch discards the value (gateway §4.3); conversion only in code (D-22) |
| not derived | E/A; RWT, LVMI (need PWd + BSA); LAESVI (needs BSA) | — | — | ⚠ D-23 |

## 12. Section: Zusammenfassung / Empfehlung

| Field key | Label (DE) | Type | Notes |
|---|---|---|---|
| (generated) | Zusammenfassung | text | comma-joined fragments TTE-S; not editable in the prototype |
| `empfehlung_disease` | Nachsorgepfad generieren für Krankheitsbild | select | Herzinsuffizienz; Vorhofflimmern; Myokardinfarkt → TTE-B blocks. Allowed as physician-inserted library blocks (CLAUDE.md, D-49); content review D-20 |

## 13. Reference thresholds and classification

| Rule | Input | Single value? | Auto-classify allowed (CLAUDE.md rule 5)? |
|---|---|---|---|
| TTE-R01 LVEF category | `lvef` (+ sex) | yes | yes |
| TTE-R02 wall thickness | `ivsd` (+ sex) | yes | yes (wording D-13) |
| TTE-H01…H17 out-of-range highlight | one field each | yes | yes (highlight only) |
| TTE-R10…R13 HFA-PEFF | up to 8 fields | **no** | **removed** (D-48) |
| TTE-R20 HFpEF criteria (ESC 2026 Table 10) | one threshold each | yes, per criterion | yes per criterion + count; conclusion sentence pending D-65 a |
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
| F-03 | Corrected 2026-09-28: on the physician's echo reports "RV Länge" is the RV dimension in the parasternal long axis, so the mapping of "RV Länge" to `rv` is correct in practice. The second hint "RVAWd" (standard meaning: RV anterior wall thickness in diastole) is still questionable → D-70 c. |
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
| Display name | Device-Abfrage (prototype: "CardioControl Portal — Mnemonic-gestützte Schrittmachernachsorge"; page title "HSM-Nachsorge: Interaktive Abfragemaske") |
| Report title | none — the prototype writes one prose paragraph into "Zusammenfassender Arztbrief (Befundbericht)" |
| Bilateral | no |
| Document extraction | yes (v1) |
| Prototype | `rady3000/HSM_Abfrage` @ `df19444` (2026-09-23) |
| Normal preset | none |
| Workflow | Sections follow the mnemonic **"Elf Bunte Elefanten Sitzen Silvester Beim Prosecco Dinner"** = EKG · Batterie · Elektroden (Impedanz) · Sensing · Stimulation (Reizschwelle) · Beobachtungen · Programmierung · Dokumentation, with a progress ribbon (a step turns green once any of its fields has a value). ICD and CRT sections appear only for matching device types. |

## 2. Section: Patient & Gerätedetails (sidebar)

| Field key | Label (DE) | Type | Unit | Allowed values / notes | Default |
|---|---|---|---|---|---|
| `patient_name` | Patienten-Identifikation | text | — | "z.B. Mustermann, Max". ⚠ never used in the report → shared core | — |
| `query_date` | Datum der Nachsorge | date | — | ⚠ never used in the report | today |
| `device_type` | Schrittmachermodus | select | — | 1-Kammer HSM (VVI); 2-Kammer HSM (DDD); 1-Kammer ICD (VVI-D); 2-Kammer ICD (DDD-D); CRT-D (Dreikammer ICD); CRT-P (Dreikammer HSM). Extractable. ⚠ label says "Modus", values are device types (D-56). Controls the ICD/CRT sections. | — |
| `device_company` | Hersteller | select | — | Medtronic; Abbott; Vitatron; Boston Scientific; Microport; Biotronik. Extractable (normalised, §11) | — |
| `device_model` | Modellnummer | text | — | "z.B. Sensia SEDR01". ⚠ **extracted** in the prototype — gateway §2.6.4 forbids extracting model numbers (D-55) | — |
| `implantation_date` | Sterilisations-/Implantations-Datum | date | — | Extractable (hint "Implantiert:"). ⚠ sterilisation date ≠ implantation date (D-57) | — |
| `device_indication` | Indikation | select | — | AV-Block III°; AV-Block II° Mobitz; Sick-Sinus-Syndrom; Tachy-Brady-Syndrom; Andere. Extractable; an unmatched extracted value goes to "Andere" + free text | — |
| `other_indication_text` | Spezifikation Indikation | text | — | visible if "Andere" | — |
| `pocket_finding` | Aggregattasche | select | — | reizlos, unauffällig; Infektzeichen; Hämatom; Druckstelle. ⚠ placeholder bug (F-04, D-18) | — |
| `patient_condition` | Allgemeinzustand | select | — | ist in gutem Allgemeinzustand und beschwerdefrei; berichtet über Schwindel; berichtet über Palpitationen; berichtet über Synkopen. ⚠ placeholder bug (F-04) | — |

## 3. Section: „Elf" — EKG-Dokumentation

| Field key | Label (DE) | Type | Unit | Allowed values / notes | Default |
|---|---|---|---|---|---|
| `base_rhythm` | Grundrhythmus | select | — | Sinusrhythmus; Vorhofflimmern; Vorhofflattern; Ektop. atrialer Rhythmus. Extractable (`rhythm`) | — |
| `ecg_pacing` | EKG-Befund (mit Stimulation) | free text | — | "z.B. Regelrechtes Pacing mit LSB-Morphologie..." | — |
| `ecg_native` | EKG-Befund (ohne Stimulation) | free text | — | "z.B. AV-Block III° sichtlich im Eigenrhythmus-Ausschnitt..." | — |

## 4. Section: „Bunte" — Batteriestatus

| Field key | Label (DE) | Type | Unit | Allowed values / notes | Default |
|---|---|---|---|---|---|
| `battery_status` | Restkapazität / Batteriestatus | text | ⚠ mixed (years / V / "OK" / ERI) | Extractable. Help text: "Biotronik: „Errechneter ERI". Medtronic: „Estimated longevity". Richtwerte: >5 Jahre ist exzellent; <3 Monate erfordert rasche Terminierung." ⚠ a bare number is printed as "{x} Jahre bis EOL" (D-58) | — |

## 5. Section: „Elefanten" — Elektrodenstatus (Impedanz)

| Field key | Label (DE) | Type | Unit | Allowed values / notes | Default |
|---|---|---|---|---|---|
| `impedance_ra` | Sondenimpedanz RA | text ⚠ | Ω | Extractable. Displayed "Ziel: 250 - 1000 Ω" — no highlight | — |
| `impedance_rv` | Sondenimpedanz RV | text ⚠ | Ω | Extractable. "Ziel: 250 - 1000 Ω" — no highlight | — |

## 6. Section: „Sitzen" — Wahrnehmung (Sensing)

| Field key | Label (DE) | Type | Unit | Allowed values / notes | Default |
|---|---|---|---|---|---|
| `sensing_ra` | Eigenamplitude RA (P-Welle) | text ⚠ | mV | Extractable. "Empfohlen: >1.5 mV" — no highlight. ⚠ hint "Atrial Sensing Threshold" (D-59) | — |
| `sensing_rv` | Eigenamplitude RV (R-Zacke) | text ⚠ | mV | Extractable. "Empfohlen: >5.0 mV" — no highlight. ⚠ hint "Ventricular Sensing Threshold" | — |

## 7. Section: „Silvester" — Stimulation / Reizschwelle

| Field key | Label (DE) | Type | Unit | Allowed values / notes | Default |
|---|---|---|---|---|---|
| `threshold_ra_v` | Atriale Reizschwelle — Spannung | text ⚠ | V | Extractable | — |
| `threshold_ra_ms` | Atriale Reizschwelle — Pulsweite | text ⚠ | ms | Extractable | — |
| `threshold_rv_v` | Ventrikuläre Reizschwelle — Spannung | text ⚠ | V | Extractable | — |
| `threshold_rv_ms` | Ventrikuläre Reizschwelle — Pulsweite | text ⚠ | ms | Extractable | — |

## 8. Section: ICD-Parameter (visible if device type contains "ICD")

| Field key | Label (DE) | Type | Unit | Allowed values / notes | Default |
|---|---|---|---|---|---|
| `icd_vt_zone` | VT-Überwachungszone (VT-Zone) | text | bpm | "z.B. > 180 bpm". Extractable. ⚠ programmed setting, not a measurement | — |
| `icd_vf_zone` | VF-Therapiezone (VF-Zone) | text | bpm | "z.B. > 220 bpm". Extractable | — |
| `icd_shock_impedance` | Schockimpedanz (RV-Coil) | text ⚠ | Ω | Extractable. → DEV-B01 badge | — |
| `icd_charge_time` | Kondensator-Ladezeit | text ⚠ | s | Extractable. → DEV-B02 badge | — |
| `icd_last_therapy` | Vorherige Episoden / Therapien (ATP / Schocks) | text | — | Extractable **as a model-written summary** ⚠ (D-60) | — |

## 9. Section: CRT-Parameter (visible if device type contains "CRT")

| Field key | Label (DE) | Type | Unit | Allowed values / notes | Default |
|---|---|---|---|---|---|
| `crt_lv_vector` | LV-Vektorprogrammierung / Polung | select | — | Bipolar: LV an RV; Quadripolar: LV1 zu LV2; Quadripolar: LV2 zu LV4; Quadripolar: LV1 zu Gehäuse; Multisite-Pacing aktiv. Extractable; an unmatched value is written as is. ⚠ initial display "Quadripolar: LV1 zu LV2" is also a real option → printed although never chosen (F-12) | "Quadripolar: LV1 zu LV2" (display) |
| `crt_lv_pacing_pct` | Biventrikulärer Stimulations-Anteil (BiV-Anteil) | text ⚠ | % | Extractable. → DEV-B03 | — |
| `crt_lv_impedance` | Sondenimpedanz LV | text ⚠ | Ω | Extractable. → DEV-B04 | — |
| `crt_lv_sensing` | Eigenamplitude LV (Sensing) | text ⚠ | mV | Extractable. → DEV-B05 | — |
| `crt_lv_threshold` | Reizschwelle LV | text ⚠ | "V bei ms" in one string | "z.B. 1.2V bei 0.4ms". Extractable. → DEV-B06 | — |

## 10. Section: „Beim" — Beobachtungen (Diagnostik-Speicher)

| Field key | Label (DE) | Type | Unit | Allowed values / notes | Default |
|---|---|---|---|---|---|
| `ap_anteil` | AP-Anteil (Atrial Paced) | text ⚠ | % | Extractable | — |
| `vp_anteil` | VP-Anteil (Ventricular Paced) | text ⚠ | % | Extractable | — |
| `af_burden` | AF Burden (Vorhofflimmerlast) | text ⚠ | % | not extracted | — |
| `ahre_episodes` | Atriale Hochfrequenz-Episoden (AHRE) | free text | — | Extractable **as a model-written summary** ⚠ (D-60). Placeholder "Keine relevanten AT-/AF-Episoden detektiert. Mode-Switch war inaktiv." | — |

## 11. Section: „Prosecco" / „Dinner" — Programmierung, Dokumentation

| Field key | Label (DE) | Type | Unit | Allowed values / notes | Default |
|---|---|---|---|---|---|
| `reprogramming` | Abschließende Programmierung | free text | — | placeholder "Sicherheitsmarge programmiert (Doppelte Sicherheit für Spannungsabgabe). Keine Modus-Änderung erforderlich. Gerät im DDD-Standard belassen." | — |
| `summary_text` | Zusammenfassender Arztbrief (Befundbericht) | free text (generated) | — | filled by "Befund generieren", editable | — |
| `next_follow_up` | Nächstes Kontrollintervall | text | — | "z.B. in 6 Monaten". ⚠ never used — the text always says 6–8 Wochen (F-06) | — |

## 12. Derived values

| Key | Label (DE) | Formula | Unit | Notes |
|---|---|---|---|---|
| `is_icd` | — | device type contains "icd" | — | shows ICD section + ribbon |
| `is_crt` | — | device type contains "crt" | — | shows CRT section + ribbon |
| `company` normalisation | Hersteller | contains jude/sjm/abbott/merlin → Abbott; medtronic → Medtronic; biotronik → Biotronik; boston/guidant → Boston Scientific; vitatron → Vitatron; microport/sorin → Microport | — | after extraction |
| `device_type` normalisation | Gerätetyp | crt-d / crt+icd / "biventrikulär icd" / "quadra assura" → CRT-D; crt-p / crt / biventrikulär → CRT-P; vvi-d / 1-kammer icd / vr-icd → 1-Kammer ICD; ddd-d / 2-kammer icd / dr-icd → 2-Kammer ICD; vvi / 1-kammer → 1-Kammer HSM; ddd / 2-kammer → 2-Kammer HSM | — | ⚠ order-dependent string matching; "DDDR" mode → "2-Kammer HSM" even for an ICD |
| implant date | — | first `YYYY-MM-DD` in the extracted string; report shows `DD.MM.YYYY` | — | |
| mnemonic progress | — | a step is "complete" if any of its fields is non-empty | — | UI only |

## 13. Section: Beurteilung

Generated paragraph (DEV-T) ending with the fixed conclusion "Zusammenfassend regelrechte Funktion des Aggregats ohne Anhalt für Sonden- oder Wahrnehmungsstörungen." ⚠ unconditional (F-01) and a follow-up recommendation (F-06, D-49).

## 14. Reference thresholds and classification

| Rule | Input | Single value? | Auto-classify allowed (rule 5)? |
|---|---|---|---|
| DEV-B01 shock impedance badge | `icd_shock_impedance` | yes | highlight yes; ⚠ badge texts contain interpretation ("Sondenfehler?") |
| DEV-B02 charge time badge | `icd_charge_time` | yes | highlight yes; ⚠ "Verdacht auf Kondensatoralterung" |
| DEV-B03 BiV % badge | `crt_lv_pacing_pct` | yes | highlight yes; ⚠ "Optimierung empfohlen" = programming recommendation |
| DEV-B04 LV impedance badge | `crt_lv_impedance` | yes | highlight yes; ⚠ "Verdacht auf Bruch/Isolationsleck" |
| DEV-B05 LV sensing badge | `crt_lv_sensing` | yes | highlight yes |
| DEV-B06 LV threshold badge | `crt_lv_threshold` | yes | highlight yes; ⚠ "Vektorwechsel vorgeschlagen!" = programming recommendation |
| RA/RV impedance, sensing, threshold | — | yes | **no rule exists** — only static hint text (D-33/D-61) |
| "Regelrechte Funktion" conclusion | all values | no | **not allowed** as an automatic conclusion (rule 5) |

None of the badges affects the report text. Badge bands in SPEC-textgen §DEV-B.

## 15. German sentence templates

SPEC-textgen §DEV-T (report), §DEV-B (badges), §X-4 (extraction prompt).

## 16. Report section order (one paragraph block, blank line between parts)

1. "Regelrechte Abfrage eines {Gerätetyp} ({Hersteller} {Modell}). Das Aggregat wurde am {Datum} bei {Indikation} implantiert."
2. Aggregattasche · Allgemeinzustand
3. Grundrhythmus · EKG ohne / mit Stimulation
4. "Regelrechte Messwerte:" Batterie · AF Burden · Stimulationsanteile · Wahrnehmung · Reizschwellen · Impedanzen
5. ICD-spezifische Parameter (if ICD)
6. CRT-spezifische Parameter (if CRT)
7. AHRE/AT-Episoden
8. Umprogrammierung (if any)
9. Fixed conclusion + follow-up sentence

No patient header, no date, no examiner in the output.

## 17. Implementation notes

- Extractable fields in the prototype (response schema): deviceModel, deviceType, implantationDate, batteryStatus, sensingRa, sensingRv, impedanceRa, impedanceRv, thresholdRaV, thresholdRaMs, thresholdRvV, thresholdRvMs, apAnteil, vpAnteil, company, indication, rhythm, ahre, icdVtZone, icdVfZone, icdShockImpedance, icdChargeTime, icdLastTherapy, crtLvVector, crtLvPacingPct, crtLvImpedance, crtLvSensing, crtLvThreshold — **all typed as strings**. Under the gateway, `deviceModel` must be removed, free-text summaries (`ahre`, `icdLastTherapy`, `indication`) are not extractable (gateway §3.4: free text never extractable), and each numeric field needs `expectedUnit` + `plausibleRange` (D-50).
- The vendor-specific label hints (Abbott/SJM, Biotronik, Medtronic DE/EN) are the most valuable carry-over: they map to per-document-type `extractionHints` and, for header masking, to gateway §2.6.3 document types.
- The mnemonic order is a workflow the physician already uses; the generic renderer can present sections in that order.

## A. Audit — Device-Abfrage

### A.1 Technical profile

| Aspect | Finding |
|---|---|
| Framework | **Vanilla TypeScript, DOM-based** (`index.html` 784 lines, `index.tsx` 887 lines) + an **Express 5 server** (`server.ts`) for the model call. |
| Styling | Tailwind **CDN play script**; Google Fonts CDN; pdf.js worker from `esm.sh` CDN. |
| Dependencies | `@google/genai` "latest" (unpinned), `express`, `pdfjs-dist` 4.4.168; dev: `concurrently`, `tsx`. |
| State | Read back from the DOM on "Befund generieren"; dropdown display text = value. Numeric fields are all `type="text"`. |
| Persistence | none. |
| Secrets | Key read server-side from the environment (✅ better than TTE). `vite.config.ts` also defines it for the client, but the client code never references it, so it is not in the bundle. |
| Network | Server listens on `0.0.0.0` without authentication — anyone on the network could call `/api/analyze`. |
| Tests | none. |
| Quality | **2 / 5** — sensible server-side key and a response schema, but DOM state, string-typed numbers, unused fields, fixed conclusion. |

### A.2 Model usage ⚠ (report prominently)

| Item | Finding |
|---|---|
| Model | `gemini-3.5-flash`, called from `server.ts` (`POST /api/analyze`). |
| Sent | `prompt` (common instructions + field list, verbatim SPEC-textgen §X-4) + the text layer of a PDF extracted with pdf.js (prefixed "--- EXTRAHIERTER DOKUMENTEN-TEXT ---") + the **whole file** as base64 (image or PDF). Accepts JPG/PNG/PDF/TXT. The full report, including the patient header, goes to Google. |
| Config | `responseMimeType: application/json` + `responseSchema` (28 string properties). |
| Returned | one string per key. |
| Unused prompt variants | `imagePrompt` and `textAnalysisPrompt` are built but never sent. |
| **Clinical wording from the model?** | **Yes — three deviations:** (1) `ahre` — "Zusammenfassung AHRE/AT-Episoden" is a **model-written summary** printed verbatim as "AHRE/AT-Episoden: {…}."; (2) `icdLastTherapy` — "Zusammenfassung letzter Therapien" (e.g. "1 ATP erfolgreich") printed verbatim; (3) `indication` — free text from the model, printed verbatim via "Andere". Also `rhythm` is a model judgement ("Grundrhythmus") when not literally stated. **Do not carry these over** (D-60). |
| Other deviations | Model **and** model-number extraction (forbidden, gateway §2.6.4); no provenance/confidence; date conversion ("12-Okt-2023" → ISO) delegated to the model; values not marked unconfirmed; status line only "{n} Felder wurden erfolgreich ausgefüllt." |

### A.3 Flags

| # | Flag |
|---|---|
| F-01 | ⚠ **Unconditional normal conclusion:** "Regelrechte Abfrage …", "Regelrechte Messwerte: …" and "Zusammenfassend regelrechte Funktion des Aggregats ohne Anhalt für Sonden- oder Wahrnehmungsstörungen." are printed **whatever the values** — even with a red badge (e.g. shock impedance 150 Ω, LV threshold 3.5 V) or pocket "Infektzeichen". |
| F-02 | ⚠ Model-written text enters the report (A.2): AHRE summary, therapy summary, indication. |
| F-03 | ⚠ Device model number extracted (gateway §2.6.4). |
| F-04 | ⚠ Empty/placeholder handling: an **untouched** pocket, condition or indication prints the placeholder ("Klinisch zeigt sich die Aggregattasche aggregattasche.", "Der Patient Allgemeinzustand.", "bei Indikation ausw. implantiert.") because the code compares with different placeholder strings; the intended fallbacks are normal wording ("reizlos, unauffällig", "ist in gutem Allgemeinzustand und beschwerdefrei"); AHRE empty → "Keine relevanten AHRE/AT-Episoden detektiert." (D-18) |
| F-05 | ⚠ "Der Patient …" — masculine fixed. (D-40) |
| F-06 | ⚠ "Die nächste Kontrolle wird in 6-8 Wochen beim niedergelassenen Kardiologen empfohlen." — always; the "Nächstes Kontrollintervall" field is ignored; a recommendation (D-49). |
| F-07 | ⚠ Badge texts give programming advice ("Vektorwechsel vorgeschlagen!", "Optimierung empfohlen") — CLAUDE.md requires neutral warning labels. (D-49) |
| F-08 | ⚠ **Decimal-comma bug:** charge time and BiV % strip every non-digit except ".", so "8,4 s" → 84 → red; "94,5 %" → 945 → green ("Exzellent"). LV threshold "1,2 V" → 1. German reports use commas. |
| F-09 | ⚠ LV threshold badge takes the **first** number in the string — "0.4 ms / 1.2 V" is evaluated as 0.4 V. |
| F-10 | ⚠ Inconsistent reference values: shock impedance badge red at > 115 Ω, sidebar text "Defekt > 110 Ω"; LV impedance badge green 250–1500 Ω, code comment and sidebar "200 - 1500 Ω"; RA/RV impedance hint 250–1000 Ω vs sidebar "Bruch > 2000 Ω, Isolationsdefekt < 250 Ω" (1000–2000 undefined). |
| F-11 | ⚠ "Grenzwertig (2.0-5.0 mV): Ausreichendes Sensing." — label contradicts itself. |
| F-12 | ⚠ CRT vector initial display "Quadripolar: LV1 zu LV2" is a real option, so it is printed even if never chosen. |
| F-13 | ⚠ Medtronic EN hint maps "Atrial/Ventricular Sensing Threshold" to measured P/R amplitude. On many reports "sensing threshold/sensitivity" is the **programmed** value, not the measured amplitude. The mapping came from your own AI Studio instruction — please confirm (D-59). |
| F-14 | ⚠ Field label "Schrittmachermodus" holds device types; Medtronic "Betriebsart" (a pacing mode, e.g. DDDR) is mapped onto device type. (D-56) |
| F-15 | ⚠ "Sterilisations-/Implantations-Datum" — two different dates in one field. (D-57) |
| F-16 | ⚠ Battery: a bare number becomes "{x} Jahre bis EOL" (a voltage like 2.85 would read "2.85 Jahre"); RRT/ERI vs EOL mixed. (D-58) |
| F-17 | ⚠ RA sections are shown for single-chamber devices; nothing hides RA fields for VVI/VR-ICD. |
| F-18 | ⚠ Patient name, Nachsorge date, AF Burden extraction and next follow-up are collected but unused (AF Burden is printed if typed). |
| F-19 | "VVI-D" / "DDD-D" are not NBD/NBG codes. |
| F-20 | Typos: "Vektor polung", "ICD-Spezifische", "CRT-Spezifische". |
| F-21 | Help text "Reizschwelle optimal <1.0 V bei 0.4 ms. Sicherheitsmarge +100 % (Verdoppelung!)" and "Austauschkriterium (ERI/RRT) reduziert Frequenz um 11 % (Biotronik)" — textbook statements shown in UI, unsourced. |

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

Vanilla TypeScript, DOM-based (same pattern as TTE; `react` listed but unused); Tailwind v4; no persistence; `vite.config.ts` defines the Gemini key for the client, but no client code references it, so it is not in the bundle; no tests. **Quality 2 / 5.**

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
| F-15 | M-TEER / T-TEER suitability sentences: allowed only as a consequence of the physician-assigned suitability, never derived automatically. (D-29, D-49) |

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

React 19 + TypeScript, Vite 6; `docx` 8.5.0, `file-saver` 2.0.5 **and** an importmap to `aistudiocdn.com`/`esm.sh`; Tailwind via CDN play script; typed `ReportData`; no persistence; key defined in `vite.config.ts` but never referenced by client code (not in the bundle); no tests. **Quality 2 / 5.**

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

## 6. Section: Empfehlungen (physician-selected text blocks only — CLAUDE.md, D-49)

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

React 19 + TypeScript, Vite 6; importmap to `aistudiocdn.com` + Tailwind CDN play script; typed `ReportData`; pure generator service; no persistence; key defined in `vite.config.ts` but never referenced by client code (not in the bundle); no tests. **Quality 3 / 5.**

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
| F-12 | ⚠ Section 6 (OAC, antiarrhythmics, PVI, amiodarone, rate control) is therapy recommendation: allowed only as physician-inserted library blocks; the automatic score-dependent OAC sentence (CV-R01) and the always-on β-blocker sentence are not allowed. (D-39, D-49) |
