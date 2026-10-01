# SPEC-decisions.md — Open questions for the project owner

**Status:** v0.3, waiting for answers. Includes the Device-Abfrage audit. Re-checked against `CLAUDE.md`,
`SPEC-carotis.md` and `SPEC-extraction-gateway.md`.

Status tags:
- **OPEN** — needs your answer.
- **PARTLY** — the new files settle part of it; the remaining question is stated.
- **ANSWERED** — settled by CLAUDE.md or the gateway spec; listed so you can object. Numbers are kept stable.

*(Vorschlag)* marks a suggestion; nothing is applied until you answer.

---

## A. Project setup & operations

**D-01 Device-Abfrage source — ANSWERED.** Attached after your confirmation and audited (SPEC-modules Modul 2). Device questions: D-55 to D-64.

**D-02 Reference files — ANSWERED.** CLAUDE.md, SPEC-carotis.md and SPEC-extraction-gateway.md arrived. SPEC-modules now follows the Carotis format. (File placement: D-53.)

**D-03 Deployment — ANSWERED (2026-10-01).** Part of the two-stage plan (D-04): stage 1 one workstation with local SQLite; stage 2 several workstations with a shared database.

**D-04 KIS target / product scope — ANSWERED (2026-10-01).** Two stages, recorded in CLAUDE.md "What this is": stage 1 (trial) one workstation, local patient record with all studies and reports, TESTBETRIEB; stage 2 (practice use) login and roles, audit trail, backup, GDT link to the practice-management system, several workstations. Billing/scheduling out of scope. Clipboard export stays the paste path into Nexus/other systems.

**D-05 Vorbefund — ANSWERED (2026-10-01).** Not needed in this stage; comparison by opening the old report in the app (implies stored reports per patient, see D-72 a).

**D-06 Data protection for extraction — ANSWERED** (gateway §1–2). TESTBETRIEB: synthetic/anonymized documents, Mistral OCR cloud allowed. ECHTBETRIEB: self-hosted OCR only.

**D-07 Extraction scope — ANSWERED (2026-10-01).** v1 = TTE + Device, source PDFs, one- vs two-stage decided by the evaluation harness. Echo machines: GE and Philips (label hints needed for both). Device manufacturers in v1: Medtronic, Vitatron, Abbott, Boston Scientific, Biotronik. MicroPort not in v1 (stays selectable for manual entry, no extraction hints).

## B. TTE — clinical rules

**D-08 HFA-PEFF — ANSWERED (2026-09-28).** Removed completely; replaced by the ESC 2026 Table 10 criteria (see D-48).

**D-09 Diastolic function — ANSWERED (2026-09-28).** No grading system. The statements "Hinweis auf eine HFpEF" / "Hinweis auf eine diastolische Dysfunktion" (TTE-R20) are sufficient.

**D-10 E/e' — ANSWERED (2026-09-28).** The app does not calculate E/e'; it uses (and extracts) the value calculated by the echo machine. Septal e' and lateral e' are separate measurement fields with reference values < 7 / < 10 cm/s (highlight only). Sub-question in D-65 l.

**D-11 LAVI in AF — ANSWERED (2026-09-28).** > 34 ml/m² in sinus rhythm, > 40 ml/m² in AF (ESC 2026 Table 10).

**D-12 LVMI boundary — ANSWERED (2026-09-28).** ≥ 95 g/m² (female) / ≥ 115 g/m² (male) (ESC 2026 Table 10).

**D-13 Wall thickness — ANSWERED (2026-09-28).** Wording "leicht / mittelgradig / hochgradig hypertrophiert" as in the prototype; grades Lang 2015 normal / Lang 2005 grades; new field PWd (posterior wall). Follow-up → D-68.

**D-14 LVEF boundary — ANSWERED (2026-09-28).** Lang 2015 partitions: mild 41–51 (m) / 41–53 (w), moderate 30–40, severe < 30 → boundary 41 (SPEC-textgen R30-1, pending verification).

**D-15 Numbers → qualitative terms — ANSWERED (2026-09-28).** All single-value parameters are classified automatically (pre-selected, physician can override; the override wins). Sources: Lang et al. 2015 (chamber quantification), ESC 2024 aortic guideline. RV function: normal if TAPSE ≥ 17 mm and TASV ≥ 9.5 cm/s. Draft tables: SPEC-textgen TTE-R30, pending your verification. Open points → D-66.

**D-16 RAP / VCI — ANSWERED (2026-09-29).** sPAP is taken from the echo report; the app does not calculate sPAP or estimate RAP (the prototype's 5/10 mmHg rule is removed). New field "Atemabhängige Kaliberschwankung" (> 50 % / < 50 %). The VCI sentence is generated from diameter (normal ≤ 21 mm / dilatiert > 21 mm) and collapse, e.g. "Die V. cava inferior ist normalkalibrig (18 mm) mit atemabhängiger Kaliberschwankung > 50 %." (SPEC-textgen R30-8).

**D-17 Grading vocabulary — ANSWERED (2026-09-28).** TR: 5-grade scheme of Hahn & Zamorano 2017 (Eur Heart J Cardiovasc Imaging 2017;18:1342–1343, doi:10.1093/ehjci/jex139), physician-assigned with the criteria table displayed; intermediate grades allowed; final grading by TEE (SPEC-textgen TTE-R40). All valves use ° incl. intermediate grades ("MI II–III°", D-69 a).

**D-18 Unassessed structures — ANSWERED (2026-09-28).** (A) An empty field produces **no** sentence; nothing is described as normal unless it was entered. Two additions keep entry fast: (1) "Alles normal" per section or for the whole study fills the normal defaults **explicitly** with one keystroke; (2) every selection list offers **"nicht beurteilbar"**, which writes an explicit sentence (e.g. "Die Trikuspidalklappe ist nicht beurteilbar."). Consequences: fixed normal sentences of the prototypes (TTE VCI sentence, TEE IAS/thrombus default, Device AHRE/pocket/condition defaults) become conditional on an entered value; combined summary phrases (e.g. "normale biventrikuläre Pumpfunktion") appear only if all their inputs were entered; hidden (conditionally invisible) fields never contribute text.

**D-19 Prostheses — ANSWERED (2026-09-28).** Add a prosthesis-function field per valve. Draft values in SPEC-textgen TTE-P, pending review (D-69 b).

**D-20 Empfehlung Textbausteine — ANSWERED (2026-09-28).** Make the "Herzinsuffizienz" block general (the Klinikum Chemnitz version suits your site, not other users). Draft: SPEC-textgen LIB-HI-01, pending your review. **Reminder: you will supply the VHF and MI blocks after the remaining questions.**

**D-21 RV measurement — ANSWERED (2026-09-28).** Default: RV diameter in the parasternal long axis. If dilated, RVD1 and RVD2 (apical) are added as conditional fields. The field keeps the label "RV Länge" used on your echo reports (D-69 c); the "RVAWd" hint is questioned in D-70 c.

**D-22 Units at extraction — ANSWERED** (gateway §4.3). A wrong unit discards the value; conversions only in code.

**D-23 Measurement list — ANSWERED (2026-09-28).** All prototype values plus those added in the decision session; each shown where it belongs clinically (valve parameters only in the paragraph of the lesion they quantify). Draft layout: SPEC-textgen TTE-M, pending review (D-69 d).

**D-24 TTE indications — ANSWERED (2026-09-28).** List confirmed (Status praesens, Myokardinfarkt, Dyspnoe, Synkope, Schwindel / Präsynkope, Angina pectoris, vor Chemotherapie). Suggested additions → D-69 e.

## C. TEE

**D-25 Thrombus terms — ANSWERED (2026-10-01).** Dropdown with three options: "Präthrombotische Formationen im LAA" · "Kein Nachweis von intrakardialen Thromben" · "Nachweis von Thrombus im LAA" (the last one opens a free-text field to describe the thrombus).

**D-26 LAA flow — ANSWERED (2026-10-01).** Single-value mapping, normal cut-off 40 cm/s. Source: Sade LE, Faletra FF, Pontone G, et al. The role of multi-modality imaging for the assessment of left atrium and left atrial appendage: a clinical consensus statement of the EACVI and EHRA of the ESC. Eur Heart J Cardiovasc Imaging 2025;26(3):385–413. doi:10.1093/ehjci/jeaf014. Categories → D-72 d.

**D-27 TEE scope — ANSWERED (2026-10-01).** Add aortic atheroma, bubble test / shunt size, LA/LAA morphology, pulmonic valve (assessed like the tricuspid valve). Proposals for the new blocks → D-72 e.

**D-28 Unreported TEE inputs — ANSWERED (2026-10-01).** Drop the unreported jet fields (`ak_jet`, `mk_jet`). 2D-PISA and 2D-EROA are not in the prototype MR text → keep both fields and include them in the MR evaluation from "mittelgradig" upward.

**D-29 TEER suitability — ANSWERED** (rule 5: physician-assigned, criteria may be displayed). Suitability sentences follow your assigned grade (D-49 d).

**D-30 Sedation — ANSWERED (2026-10-01).** One shared sedation block for TEE and Kardioversion.

## D. Schrittmacher-Implantation

**D-31 Device types — ANSWERED (2026-10-01).** Add CRT-P/CRT-D, ICD and S-ICD with their own narratives (texts still to be written, D-72 h).

**D-32 Fixed claims — ANSWERED (2026-10-01).** Keep the fixed narrative as it is (no new fields for lead position, fixation, pocket).

**D-33 Lead measurement ranges — ANSWERED (2026-10-01).** Reference table from Ellenbogen & Kaszala (eds.), Cardiac Pacing and ICDs, 7th ed., Wiley 2020, doi:10.1002/9781119578376 (SPEC-textgen DEV-REF); shared with Device-Abfrage.

**D-34 Vena cephalica — ANSWERED (2026-10-01).** The vein is prepared and then punctured; wording proposal → D-72 i.

**D-35 Device catalogue — ANSWERED (2026-10-01).** Yes, maintain manufacturer + model lists.

**D-36 Aggregatwechsel — ANSWERED (2026-10-01).** Yes: a procedure type with explanted-device fields.

**D-37 Fluoroscopy time — ANSWERED (2026-10-01).** min:s.

## E. Elektrische Kardioversion

**D-38 Shock protocol — ANSWERED (2026-10-01).** Energy per shock and number of shocks as fields for every outcome.

**D-39 Anticoagulation text — ANSWERED (2026-09-28).** Use the ESC 2024 AF guideline (CHA₂DS₂-VA, ≥ 3 weeks OAC before CV or TEE, ≥ 4 weeks after). Drafts: SPEC-textgen LIB-CV-01…06, pending your review; you choose the block, the app never preselects from the score. Sub-question answered (2026-10-01): no early-cardioversion option (AF < 24 h) in the TEE status.

**D-40 Sex — ANSWERED (2026-10-01).** The sex field stays with two options, weiblich / männlich, no default. Empty sex → no sex-dependent category (D-51).

**D-41 CV indication model — ANSWERED (2026-10-01).** Keep it as it is.

**D-42 CV ↔ TEE — ANSWERED (2026-10-01).** Not needed: with a thrombus no cardioversion is performed, so no report is written.

## F. Shared

**D-43 Report style — ANSWERED (2026-10-01).** Heading "Zusammenfassung".

**D-44 Patient data in file names — ANSWERED (2026-10-01).** No patient names in exported file names.

**D-45 Export formats — ANSWERED** (CLAUDE.md): clipboard (primary), DOCX, PDF.

**D-46 Clinical sign-off — ANSWERED** (CLAUDE.md: clinical content is yours). Note: nearly all prototype text blocks were drafted by the AI Studio model; each needs your review before it enters `reference/` or a schema.

**D-47 Build strategy — ANSWERED** (CLAUDE.md architecture). Electron + declarative schemas + one renderer + one generator cannot be reached from any prototype. Build fresh; port the domain content only.

## G. New questions raised by CLAUDE.md and the gateway spec

**D-48 Multi-finding scores — ANSWERED (2026-09-28).** HFA-PEFF removed. Replaced by the four ESC 2026 Table 10 criteria, each a single threshold, with a count line in the report (SPEC-textgen TTE-R20). Open points → D-65.

**D-49 Recommendations — ANSWERED (2026-09-28).** The CLAUDE.md rule "No therapy or device-programming recommendations, anywhere, ever" is replaced by: *recommendations only as physician-selected text blocks from a reviewed library (each with source and review date); the app never inserts, preselects or triggers a recommendation automatically from values, scores or classifications; warning labels stay neutral ("außerhalb des Referenzbereichs") and give no advice.* Consequences:
(a) TTE Empfehlung blocks → library blocks, inserted by you. Content still to review (D-20).
(b) CV section 6 → library blocks, inserted by you. The automatic, score-dependent OAC sentence (CV-R01) and the always-on β-blocker sentence are not allowed as automatic text. Content still to review (D-39).
(c) SM "Weiteres Vorgehen" / "Wundversorgung" → kept; each order is a block you select (as the checkboxes already work).
(d) TEE TEER suitability sentences → allowed, only following your assigned suitability (D-29).
(e) Carotis "Empfohlene Verlaufskontrolle" → compliant (physician-selected).
(f) Device → the fixed "nächste Kontrolle in 6-8 Wochen" sentence is not inserted automatically (becomes a block or fact field, D-63); badge advice ("Optimierung empfohlen", "Vektorwechsel vorgeschlagen!") is removed, labels neutral (D-61).
All prototype recommendation texts remain available verbatim in SPEC-textgen.

**D-50 Extraction bounds — ANSWERED (2026-10-01).** Claude drafts `expectedUnit`, accepted alternative units (converted in code, D-22) and `plausibleRange` for every extractable TTE and Device field: SPEC-textgen §X-6, DRAFT pending your correction. These are hard sanity bounds to catch misreads, not normal ranges.

**D-51 Conditional bands — ANSWERED (2026-09-28).** Sex- and rhythm-dependent cut-offs as already decided (e.g. LVEF by sex, natriuretic peptides by rhythm); rule files carry a condition per band set (SPEC-textgen G-3). Empty sex/rhythm → no category.

**D-52 Band boundaries — ANSWERED (2026-09-28).** A value exactly on a cut-off counts as normal unless the source states otherwise (e.g. LVMI ≥ 95/115 is abnormal per ESC 2026). Bands are contiguous over decimals (SPEC-textgen G-2); the gateway §5.1 integer example is superseded.

**D-53 Repository layout — ANSWERED (2026-10-01).** Leftover `kardio-doku/kardio-doku-starter.zip` deleted. `PLAN.md` drafted at the repository root, pending your approval.

**D-54 Seed documents — ANSWERED (2026-10-01).** Echo: you provide anonymized/synthetic printouts (GE and Philips). Device: you provide anonymized reports for Vitatron, Abbott and Medtronic; Boston Scientific and Biotronik may follow later — until then synthetic only, and extraction for them is marked unevaluated. Real documents never enter the repository (`samples-real/` is git-ignored).


## H. Device-Abfrage (from the audit of HSM_Abfrage)

**D-55 Device identity fields — ANSWERED (2026-09-29).** Manufacturer, device type and model are extracted (few models in the department). The serial number is entered by hand only. Extracting the model requires amending the gateway spec → D-71.

**D-56 Device type vs pacing mode — ANSWERED (2026-09-29).** Two fields: Gerätetyp (VVI-SM, DDD-SM, VVI-ICD, DDD-ICD, CRT-P, CRT-D, S-ICD) and programmierter Modus (e.g. DDD, DDDR, VVIR, AAI). "VVI-D"/"DDD-D" dropped.

**D-57 Implant date — ANSWERED (2026-09-29).** Implantation date only (no sterilisation date); extracted.

**D-58 Battery status — ANSWERED (2026-09-29).** Restlaufzeit (number + unit Jahre / Monate) and Status as a choice: OK · RRT/ERI erreicht · EOS.

**D-59 Medtronic sensing — ANSWERED (2026-10-01).** The value to extract is "Measured P / R Wave" (not "Programmed Sensitivity", not "Programmed Output"). Format question → D-72 b.

**D-60 Model-written fields — ANSWERED (2026-10-01).** Structured fields (AT/AF episodes n, longest duration, AF burden %; VT/VF episodes n, ATP n, shocks n; indication as select) plus the sentence "Nach Sichtung des EGMs handelt es sich am ehesten um ___." with your own free text (e.g. SVT with bundle branch block vs slow VT). Detail → D-72 c.

**D-61 Device measurement ranges — ANSWERED (2026-10-01).** Reference table from Ellenbogen & Kaszala, Cardiac Pacing and ICDs, 7th ed. (SPEC-textgen DEV-REF); neutral highlight only. Details → D-72 f.

**D-62 Device conclusion — ANSWERED (2026-10-01).** Physician-selected conclusion ("Regelrechte Aggregat- und Sondenfunktion" / "Auffälligkeit: …"); a warning (no block) if a highlighted value contradicts "regelrecht".

**D-63 Follow-up interval — ANSWERED (2026-09-28).** Plain fact: `Nächste Kontrolle: {Intervall}.`, printed only if filled (SPEC-textgen LIB-DEV-01).

**D-64 Section order — ANSWERED (2026-10-01).** Keep the mnemonic order (EKG · Batterie · Elektroden · Sensing · Stimulation · ICD · CRT · Beobachtungen · Programmierung · Dokumentation) without showing the mnemonic labels.

---

**D-65 HFpEF criteria — details — ANSWERED (2026-09-28).**
(a) CLAUDE.md rule 5 amended with the TTE-R20 exception. (b) Count line always "{n} von 4 Kriterien für eine HFpEF sind erfüllt." (n = fulfilled), however many were assessable. (c) Peptide cut-offs SR NT-proBNP > 220 / BNP > 80; AF NT-proBNP > 660 / BNP > 240 pg/ml. (d) LVEF ≥ 50 %. (e, h) ≥ 1 criterion: peptide elevated → "Hinweis auf eine HFpEF."; peptide not elevated or not entered → "Hinweis auf eine diastolische Dysfunktion." (i) 0 criteria → "Kein Hinweis auf eine HFpEF." (f) Source ESC 2026 HF guideline, PMID 42661420. (k) Peptide cut-offs from Pieske B et al., Eur Heart J 2019;40:3297–3317, doi:10.1093/eurheartj/ehz641 (cut-offs only, no score). (g) New extractable field TR-Geschwindigkeit. (l) E/E' = the average value. (m) Vorhofflattern → AF cut-offs; AV-Block III → no HFpEF text at all.
(n) Minimum of 4 of the 6 measurements (LVMI, RWT, LAVI, E/e', sPAP, TR velocity) for both the count line and the conclusion sentence; below that, no HFpEF text.

**D-66 Chamber quantification — ANSWERED (2026-09-28).** (a) RV function is a named exception in CLAUDE.md rule 5. With TAPSE and TASV both entered, the result follows TASV: ≥ 9.5 cm/s → normal (also with reduced TAPSE, e.g. after cardiac surgery with cardiopulmonary bypass); < 9.5 cm/s → eingeschränkt. With only one value entered: no sentence, value in the measurement table only. (b) Severity grades for LVEDD and IVSd from Lang 2005 (easier for non-cardiologists). (c) Aorta ascendens dilated from 40 mm (m) / 36 mm (w) — ESC 2024 (Mazzolai et al., Eur Heart J 2024;45:3538–3700, doi:10.1093/eurheartj/ehae179). (d) All TTE-R30 values verified by you. Follow-ups → D-67.

**D-67 Chamber quantification — follow-ups — ANSWERED (2026-09-28).** (a) LVEDD: "leicht dilatiert" starts right above the 2015 normal limit (m > 58, w > 52 mm). (b) Aorta ascendens: dilated only above 40 mm (m) / 36 mm (w). (c) RV sentences "Die rechtsventrikuläre systolische Funktion ist normal." / "… ist eingeschränkt." approved, ungraded on purpose (clearer for non-cardiologists).

**D-68 Wall thickness: which wall — ANSWERED (2026-09-28).** Option 3: one sentence part per wall, e.g. "Das Septum ist leicht hypertrophiert, die Hinterwand ist normwertig." (SPEC-textgen R30-4b). No additional rule-5 exception needed.

**D-69 TTE follow-ups — ANSWERED (2026-09-28).**
(a) All valve grades (TR included) use ° (e.g. "TI III°", "AS II°"); intermediate grades such as "MI II–III°" are allowed for every valve.
(b) Prosthesis function values approved. First sentence: "Zustand nach Aortenklappenersatz ({Typ}), in loco typico und festsitzend." Aortic prosthesis: same measurements as the native valve (Vmax, dp max/mean, AÖF). Mitral/tricuspid prosthesis: mean antegrade gradient is the key value for prosthetic stenosis; same formulation without the aortic-only values. Optional free text per prosthesis (SPEC-textgen TTE-P).
(c) RV size: superseded by D-70 — RV Länge is evaluated first; RVD1/RVD2 are added when RV Länge > 30 mm. Label "RV Länge" (the label on your echo reports; the prototype mapping of "RV Länge" was correct in practice). RVD1 normal up to 41 mm, RVD2 up to 35 mm.
(d) Measurement layout (SPEC-textgen TTE-M) approved.
(e) Added indications: Vitienkontrolle · Vorhofflimmern (Erstdiagnose) · Präoperativ · V.a. Lungenembolie / Rechtsherzbelastung · Perikarderguss (Verlaufskontrolle) · Verlaufskontrolle unter / nach Chemotherapie · Z.n. Herzklappen-OP / Klappenersatz · Palpitationen · Sonstige (Freitext).

**D-70 TTE follow-ups (2) — ANSWERED (2026-09-29).**
(a) Prosthesis sentence: "Prothese Typ {Typ}, in loco typico und fest sitzend, {Funktion} ({Messwerte})."
(b) RV Länge (parasternal long axis) normal up to and including 30 mm; dilated > 30 mm.
(c) "RVAWd" removed completely.
Correction to D-69 c: **RV Länge is the first value evaluated** and drives the RV-size sentence. If it is > 30 mm and RVD1/RVD2 were measured, they are added to the evaluation.

**D-71 Gateway rule on model numbers — ANSWERED (2026-10-01).** SPEC-extraction-gateway §2.6.4 amended: serial numbers never extractable; the device model may be extracted.

**D-72 Follow-ups from the 2026-10-01 answers — ANSWERED (2026-10-01).**
(a) Two-stage scope (see D-04).
(b) Values such as "> 2.8 mV" or "5.6 to 22.4 mV" are stored as number + qualifier (">" or range min–max); the range check uses the number after ">" and the lower end of a range.
(c) Up to 5 episodes: one EGM sentence per episode. More than 5: the general sentence "Nach Sichtung der EGMs handelt es sich am ehesten um ___." plus optional free text for an episode that does not fit the rest.
(d) LAA flow: two categories, normal ≥ 40 / reduziert < 40 cm/s.
(e) TEE blocks — LA/LAA: LAA morphology (Chicken wing / Windsock / Cactus / Cauliflower), spontaneous echo contrast (kein / gering / ausgeprägt / Sludge), LAA flow, thrombus field (D-25); no lobe count, no ostium/depth. Aortic atheroma: first ja/nein; if ja, per segment (ascendens / Bogen / descendens) plaque < 4 mm / ≥ 4 mm (4 mm confirmed), mobile Anteile ja/nein, ulzeriert ja/nein. Bubble test: at rest and/or Valsalva, result kein Shunt / Shunt, Vorhofseptumaneurysma ja/nein — no bubble counts. Pulmonic valve: assessed like the tricuspid valve.
(f) Device ranges: highlight below the lower limit (P < 1.5, R < 5.0 mV); thresholds chronic values for interrogations, acute values for implantations; keep the charge-time (> 15 s) and BiV-pacing (< 98 %) warnings, neutral wording.
(h) CRT/ICD/S-ICD implantation texts: drafted by Claude in the style of the pacemaker report, reviewed by you.
(i) Vena cephalica: "Die Vena cephalica wurde in der Mohrenheim-Grube freipräpariert und anschließend unter Sicht punktiert."

## Reminders

- Before milestone M4 (extraction): you supply the anonymized echo (GE, Philips) and device (Vitatron, Abbott, Medtronic) documents (D-54).
- You review the plausibility ranges in SPEC-textgen §X-6 (D-50).
- After the remaining questions: you supply the text blocks **LIB-VHF-01 (Vorhofflimmern)** and **LIB-MI-01 (Myokardinfarkt)** (D-20).

---

## Recommendation (Step 5) — unchanged, now also required by CLAUDE.md

**Build fresh; port the domain content, not the code.**

- TTE/TEE/Device: DOM scripts; state = display strings; thresholds duplicated with
  different cut-offs; ad-hoc string concatenation; key in the bundle.
- SM: React with a typed model, but three hand-written, diverging report copies; CDN dependencies.
- CV: best shape (typed model + pure `generateReport`) — the pattern matches
  the target generator; the code itself is too small and entangled to keep.
- None has tests, persistence, provenance-carrying extraction, or declarative
  schemas, all of which CLAUDE.md requires.
