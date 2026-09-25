# SPEC-decisions — Open questions for the project owner

Status: **open — waiting for answers (Session 1)**. Each item says what is
blocked and, where one exists, a suggested default marked *(Vorschlag)*. No
suggestion is applied until you answer. References: SPEC-modules (`TTE F-xx`
etc.), SPEC-textgen (rule IDs).

---

## A. Project setup & operations

**D-01 Device-Abfrage source.** `rady3000/HSM_Abfrage` could not be attached to this session (a permission check refused it), so the Device module is unaudited. Will you grant access (or paste/export the code) so I can audit it in the next session?

**D-02 Missing reference files.** The repository was empty: there was no `CLAUDE.md` and no `spec/SPEC-carotis.md`. I used my own uniform module structure (SPEC-modules header). Please add both files (or tell me to write CLAUDE.md), and I will re-map the module specs to the Carotis structure.

**D-03 Deployment.** Single user on your laptop, or several workstations (shared data, several examiners)? This decides persistence, examiner lists, and whether a server is needed.

**D-04 KIS target.** Which hospital information system will reports be pasted into (e.g. ORBIS, iMedOne, Medico, SAP i.s.h.med, other)? Does its text field accept rich text/RTF/HTML or plain text only; is there a line-length limit; tabs; bullet character? Does it need a Fall-/Patientennummer?

**D-05 Vorbefund.** Is comparison with a previous study (Vorbefund) needed in v1? If yes: typed in by hand, extracted from a document, or loaded from the app's own storage (which implies persistence, D-03)?

**D-06 Data protection for extraction.** TTE today sends the **whole uploaded document** (including any name/birth date on it) from the browser to Google Gemini, using an API key embedded in the page. For kardio-doku: (a) is an external model allowed at all under your hospital's data-protection rules; (b) which provider/contract; (c) must documents be de-identified/cropped before sending; (d) or must extraction run locally? *(Vorschlag: no identifiers leave the machine; key server-side only; extraction optional.)*

**D-07 Extraction scope.** Which modules need document extraction in v1 (today only TTE)? Which source documents: echo-machine PDF report, screen photo, DICOM SR? Which vendor (the label heuristics such as "G peak SL(Avg)", "LVEF_BiP_Q" are vendor-specific)? *(Vorschlag: TTE only; extracted values shown as "unbestätigt" until you confirm each.)*

## B. TTE — clinical rules

**D-08 HFA-PEFF in the report.** Today a score ≥ 2 prints "Hinweis auf diastolische Dysfunktion" (TTE F-01). Options: (a) report the three HFA-PEFF bands (0–1 unwahrscheinlich / 2–4 intermediär / 5–6 HFpEF wahrscheinlich) as a separate sentence; (b) drop the score from the report and keep it as a helper; (c) other. Should it only be computed when LVEF ≥ 50 %? Keep HFA-PEFF (2019) or switch to/add H2FPEF?

**D-09 Diastolic function grading.** The prototype lost its manual grading (TTE F-28) and overwrites your dropdown choice (F-20). Do you want a diastolic-function assessment by an algorithm (which one: ASE/EACVI 2016, or the newer ASE 2025 guideline), a manual grade, or none?

**D-10 E/e'.** Average or septal E/e'? The prompt maps the septal value (TTE F-04). Should septal e' and lateral e' be separate fields (needed for the HFA-PEFF major criterion)?

**D-11 LAVI in AF.** Add the AF-specific LAVI bands (> 40 / 34–40 ml/m²)?

**D-12 LVMI boundary.** Minor criterion `>` 115/95 vs HFA-PEFF `≥` 115/95 — use ≥?

**D-13 Wall thickness.** Keep the prototype IVSd bands (m ≤10/≤12/≤14/>14; f ≤9/≤12/≤14/>14) or use ASE/EACVI 2015 (m 11–13/14–16/≥17; f 10–12/13–15/≥16)? Should the wording be "Wanddicke erhöht" instead of "hypertrophiert" when only IVSd is known? Add PWd?

**D-14 LVEF boundary.** Text band "mittelgradig reduziert" = 30–40 % (< 41) vs highlight major ≤ 40 %. Which boundary?

**D-15 Numbers → qualitative terms.** Should LVEDD/LVESD size, LA/RA/RV size, RV function (TAPSE/S'), PH probability (TR velocity/RVSP), and AS/AI/MI/TI severity be **proposed automatically** from the numbers (you can override), or stay manual? If automatic: confirm the reference tables (ASE/EACVI 2015 chamber quantification; ESC/EACTS 2025 valvular; ESC/ERS 2022 PH).

**D-16 RAP / VCI.** Use the ASE 3/8/15 mmHg scheme (needs a collapse field) instead of 5/10? One VCI cut-off (21 mm)? Make the fixed sentence "Die Vena cava inferior ist normalkalibrig und zeigt atemmodulierte Kaliberschwankung." conditional?

**D-17 Grading vocabulary.** Agree on one controlled vocabulary for all modules (e.g. "leichtgradig/mittelgradig/hochgradig", summary "I°/II°/III°")? TR: 3 grades (TTE) or 5 grades (TEE, Hahn: leicht/mittel/hoch/massiv/torrential)?

**D-18 Unassessed structures.** Today an empty field is reported as normal (TTE F-13). Should an unassessed structure (a) be left out, (b) be written as "nicht beurteilt", or (c) block report generation until chosen or explicitly marked normal?

**D-19 Prostheses.** Add fields for prosthesis function (regelrecht / Gradient erhöht / paravalvuläres Leck …) instead of the fixed "in regelrechter Funktion"?

**D-20 Empfehlung Textbausteine.** The "Herzinsuffizienz" block is one patient's letter (active patient, Klinikum Chemnitz); VHF/MI are placeholders. Keep recommendations in the TTE module at all? If yes, please supply the approved texts.

**D-21 RV measurement.** Which RV value is `rv`: basal diameter (RVD1), mid (RVD2), length, or RVOT? The prompt maps "RV Länge"/"RVAWd", which are different measurements.

**D-22 Units at extraction.** Accept mitral E/A only in m/s, or convert cm/s? Should all unit conversion happen in code (never in the prompt)? *(Vorschlag: code only.)*

**D-23 Measurement list.** Which measured values appear in the report's "Messwerte" line, in which order, with which units (Aortenwurzel / Aorta asc. / NT-proBNP have no unit in the UI)? Should E/A be computed from E and A?

**D-24 TTE indications.** Confirm the list (Status praesens, Myokardinfarkt, Dyspnoe, Synkope, Schwindel / Präsynkope, Angina pectoris, vor Chemotherapie) and the spelling "Status praesens". Add others (e.g. Vitienkontrolle, Endokarditis, Herzinsuffizienz-Verlauf)?

## C. TEE

**D-25 Thrombus / SEC terms.** Replace "Präthrombotische Formationen im LAA" with graded spontaneous echo contrast / sludge? Fix the contradiction with "Kein Nachweis von intrakardialen Thromben" (TEE F-01).

**D-26 LAA flow bands.** Derive the LAA-flow wording from the number (e.g. normal > 40 cm/s, reduced 20–40, severely reduced < 20)? Which cut-offs?

**D-27 TEE scope.** Add: aortic atheroma grading (arch/descending), bubble test with shunt size, LA/LAA morphology, pulmonic valve, pericardium, LV regional function?

**D-28 Unreported TEE inputs.** `ak_jet`, `mk_jet`, `mk_2d_pisa`, `mk_2d_eroa` are collected but never printed. Include them, or drop the fields?

**D-29 TEER suitability.** Keep M-TEER / T-TEER suitability as a manual choice, or derive it from the entered anatomy by rule (which criteria set)?

**D-30 Sedation.** Should TEE and CV share one sedation block (Propofol, Midazolam, others, doses, tolerance, complications)?

## D. SM-Implantation

**D-31 Device types in v1.** CRT-P, CRT-D, VR/DR-ICD and S-ICD can be selected but get a pacemaker narrative (SM F-03). In v1: pacemaker only, or all types with their own narratives (LV/CS lead, shock lead, defibrillation test, S-ICD extravascular technique)?

**D-32 Fixed claims → fields.** Should lead position (hochseptal / apikal / Conduction-System-Pacing …), RA position (RAA / lateral …), fixation (aktiv/passiv), pocket (subkutan/präpektoral vs subpektoral) become fields instead of fixed text? Remove "exzellente"/"gute Messwerte"?

**D-33 Lead measurement bands.** Do you want plausibility/acceptance bands for sensing, threshold and impedance (e.g. RV threshold ≤ 1.0 V @ 0.4 ms, R wave ≥ 5 mV, P wave ≥ 2 mV, impedance 200–1500 Ω), and a warning when outside? Which values?

**D-34 Vena cephalica.** Cut-down ("präpariert") or puncture wording?

**D-35 Device catalogue.** Maintain a device/lead catalogue (manufacturer + model separately)? Who updates it?

**D-36 Aggregatwechsel.** Treat as a procedure type (with explanted device, battery status, lead check values) instead of a diagnosis?

**D-37 Fluoroscopy time unit.** Enter as min:sec and print "min:s", or decimal minutes?

## E. Kardioversion

**D-38 Shock protocol.** Make energy per shock a field (the 360 J fixed value may exceed your device's biphasic maximum), with number of shocks and energy sequence for every outcome?

**D-39 Anticoagulation rule.** Adopt ESC 2024 CHA₂DS₂-VA (OAC recommended ≥ 2, consider 1)? Evaluate the score in the text instead of always writing "dauerhaft/lebenslang"? "≥ 3 Wochen" vs "4 Wochen" pre-CV? Add the early-CV pathway (< 24 h / < 48 h)?

**D-40 Sex.** Shared sex field with no silent default (TTE defaults weiblich, CV männlich, SM has none)? Include "divers" — and if so, which cut-offs and which grammar?

**D-41 CV indication model.** Split "arrhythmia" (Vorhofflimmern / Vorhofflattern) from "episode" (Erstdiagnose / Rezidiv) and "form" (paroxysmal/persistierend …)? Flutter-specific texts (CTI ablation instead of PVI)?

**D-42 CV ↔ TEE.** Should CV be able to reference a same-day TEE report from the TEE module, and support the "thrombus found → no CV" path?

## F. Shared

**D-43 Report style.** Heading "Zusammenfassung" or "Beurteilung"? Upper-case numbered sections (CV) or plain headings (TTE/TEE)? Sentence style for "kein Hinweis …" lists.

**D-44 Patient data in files.** Keep patient names out of exported file names (TTE and SM put them in today)?

**D-45 Export formats v1.** Which do you actually need: copy-to-KIS, PDF, DOCX, print?

**D-46 Clinical sign-off.** Almost all Textbausteine were drafted by the AI Studio model during prototyping (visible in the SM prompt history). Will you review and approve each text block in SPEC-textgen before it is implemented? Anyone else (Oberarzt/Chefarzt)?

**D-47 Build strategy.** Confirm the recommendation below: build fresh, port the domain content from the specs, and use none of the prototype code.

---

## Recommendation (Step 5)

**Build fresh; port the domain content, not the code.**

- **TTE / TEE** (the richest domain content) are vanilla-TS DOM scripts. State
  is the display strings, every threshold is coded two or three times with
  different cut-offs (TTE-H04 vs R01, H15 vs X-2), text comes from ad-hoc
  string concatenation with grammar bugs, and the API key sits in the bundle.
  Nothing there is a reusable structure.
- **SM-Implantation** is React with a typed data model, but the report exists
  three times, written by hand, and the copies already disagree (SM F-01); it
  depends on CDN Tailwind and importmaps.
- **Kardioversion** is the best shaped: typed `ReportData` plus a pure
  `generateReport(data)` function. Adopt that **pattern** (typed model → pure
  rule-based generator → one renderer, several adapters). Its code is too small
  and too entangled with clinical branches to be worth keeping.
- None has tests, persistence, or shared components, so there is no
  infrastructure to preserve. The value is in the field lists, text blocks and
  thresholds, which are now captured in SPEC-modules / SPEC-textgen.
