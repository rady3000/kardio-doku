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

**D-03 Deployment — PARTLY.** CLAUDE.md sets Windows, one installable package, local SQLite. Remaining: one PC only, or the same install on several workstations (each with its own local database, or shared)?

**D-04 KIS target — OPEN.** Which hospital system receives the clipboard output? Plain text or rich text; line length; tabs; bullet character; Fallnummer needed? (Clipboard is the primary export; its first line in TESTBETRIEB is the TESTDATEN marker.)

**D-05 Vorbefund — OPEN.** SPEC-carotis has a `Voruntersuchung vom` date field. Is side-by-side comparison with a previous study needed in v1, beyond that date?

**D-06 Data protection for extraction — ANSWERED** (gateway §1–2). TESTBETRIEB: synthetic/anonymized documents, Mistral OCR cloud allowed. ECHTBETRIEB: self-hosted OCR only.

**D-07 Extraction scope — PARTLY.** v1 = TTE + Device, source PDFs, one- vs two-stage decided by the evaluation harness. Remaining: which echo system produces your printouts (the TTE hints such as "G peak SL(Avg)", "LVEF_BiP_Q" look like GE EchoPAC)? For Device, the prototype has vendor rules for Abbott/SJM, Biotronik and Medtronic (DE + EN) — which manufacturers do you see most, and are Boston Scientific, Vitatron and MicroPort needed in v1?

## B. TTE — clinical rules

**D-08 HFA-PEFF — PARTLY** (see D-48). CLAUDE.md rule 5 forbids auto-classifying multi-finding judgements, so the prototype sentence "Hinweis auf diastolische Dysfunktion" from the score cannot stay. Remaining: keep the score as a display-only helper beside the fields, or drop it?

**D-09 Diastolic function — OPEN.** A diastolic grading algorithm integrates several values → physician-assigned under rule 5. Do you want a manual grade field (which categories), with the algorithm criteria table displayed alongside (like Carotis §6)?

**D-10 E/e' — OPEN.** Average or septal? Separate septal e' / lateral e' fields?

**D-11 LAVI in AF — OPEN.** Rhythm-specific LAVI bands (> 40 / 34–40 ml/m²) wanted?

**D-12 LVMI boundary — OPEN.** `>` or `≥` 115/95 g/m²?

**D-13 Wall thickness — OPEN.** Prototype IVSd bands vs ASE/EACVI 2015; wording "hypertrophiert" vs "Wanddicke erhöht"; add PWd?

**D-14 LVEF boundary — OPEN.** 40 or 41 % between "leicht" and "mittelgradig"? (See also D-52: the gateway example uses 55/45/30.)

**D-15 Numbers → qualitative terms — PARTLY.** Rule 5 allows single-value mappings (LVEDD → size category, LAVI → LA size, TAPSE → …) and forbids multi-finding grades (valve severity, PH probability). Remaining: do you want the single-value size categories auto-classified, and from which reference tables?

**D-16 RAP / VCI — OPEN.** 5/10 vs ASE 3/8/15 (the ASE scheme needs a collapse field, and combines two values → derived value or physician choice?); one VCI cut-off; make the fixed VCI sentence conditional.

**D-17 Grading vocabulary — OPEN.** One vocabulary for all modules? TR with 3 or 5 grades?

**D-18 Unassessed structures — PARTLY.** "Empty is safe" and the explicit "Alles normal" action suggest an empty field must not produce normal wording. Remaining: should an empty structure be left out of the text, or written as "nicht beurteilt"?

**D-19 Prostheses — OPEN.** Add a prosthesis-function field instead of the fixed "in regelrechter Funktion"?

**D-20 Empfehlung Textbausteine — ANSWERED (2026-09-28).** Make the "Herzinsuffizienz" block general (the Klinikum Chemnitz version suits your site, not other users). Draft: SPEC-textgen LIB-HI-01, pending your review. **Reminder: you will supply the VHF and MI blocks after the remaining questions.**

**D-21 RV measurement — OPEN.** Which RV value is `rv` (RVD1, RVD2, length, RVOT)?

**D-22 Units at extraction — ANSWERED** (gateway §4.3). A wrong unit discards the value; conversions only in code.

**D-23 Measurement list — OPEN.** Which values appear in the report's measurement block, in what order and units? Compute E/A from E and A?

**D-24 TTE indications — OPEN.** Confirm the list and "Status praesens"; add others?

## C. TEE

**D-25 Thrombus / SEC terms — OPEN.** Replace "Präthrombotische Formationen im LAA" with graded spontaneous echo contrast / sludge? Resolve the contradiction with "Kein Nachweis von intrakardialen Thromben".

**D-26 LAA flow bands — OPEN.** Single-value mapping, so auto-classification is allowed. Want it? Which cut-offs and source?

**D-27 TEE scope — OPEN.** Add aortic atheroma, bubble test/shunt size, LA/LAA morphology, pulmonic valve, pericardium?

**D-28 Unreported TEE inputs — OPEN.** Include `ak_jet`, `mk_jet`, `mk_2d_pisa`, `mk_2d_eroa` in the text, or drop the fields?

**D-29 TEER suitability — ANSWERED** (rule 5: physician-assigned, criteria may be displayed). Suitability sentences follow your assigned grade (D-49 d).

**D-30 Sedation — OPEN.** One shared sedation block for TEE and CV (drugs, doses, tolerance, complications)?

## D. Schrittmacher-Implantation

**D-31 Device types — OPEN.** Pacemaker only in the first version, or CRT/ICD/S-ICD with their own narratives?

**D-32 Fixed claims → fields — OPEN.** Lead positions, fixation, pocket position as fields; remove "exzellente/gute Messwerte"?

**D-33 Lead measurement ranges — OPEN.** Out-of-range highlighting for sensing/threshold/impedance? Which ranges and source?

**D-34 Vena cephalica — OPEN.** "präpariert" or "punktiert"?

**D-35 Device catalogue — OPEN.** Maintain manufacturer + model lists? (Model/serial numbers are never extractable — gateway §2.6.4 — but can be entered by hand.)

**D-36 Aggregatwechsel — OPEN.** Procedure type rather than diagnosis, with explanted-device fields?

**D-37 Fluoroscopy time — OPEN.** min:s or decimal minutes?

## E. Elektrische Kardioversion

**D-38 Shock protocol — OPEN.** Energy per shock and number of shocks as fields for every outcome?

**D-39 Anticoagulation text — ANSWERED (2026-09-28).** Use the ESC 2024 AF guideline (CHA₂DS₂-VA, ≥ 3 weeks OAC before CV or TEE, ≥ 4 weeks after). Drafts: SPEC-textgen LIB-CV-01…06, pending your review; you choose the block, the app never preselects from the score. Sub-question still open: add an early-cardioversion option (AF < 24 h) to the TEE status?

**D-40 Sex — OPEN.** Shared sex field with no default; include "divers" — then which cut-offs and grammar?

**D-41 CV indication model — OPEN.** Split arrhythmia / episode / form; flutter-specific wording.

**D-42 CV ↔ TEE — OPEN.** Reference a same-day TEE study; thrombus-positive path (CV not performed)?

## F. Shared

**D-43 Report style — OPEN.** "Beurteilung" (SPEC-carotis) or "Zusammenfassung" (prototypes); heading style.

**D-44 Patient data in file names — OPEN.** Keep names out of exported file names?

**D-45 Export formats — ANSWERED** (CLAUDE.md): clipboard (primary), DOCX, PDF.

**D-46 Clinical sign-off — ANSWERED** (CLAUDE.md: clinical content is yours). Note: nearly all prototype text blocks were drafted by the AI Studio model; each needs your review before it enters `reference/` or a schema.

**D-47 Build strategy — ANSWERED** (CLAUDE.md architecture). Electron + declarative schemas + one renderer + one generator cannot be reached from any prototype. Build fresh; port the domain content only.

## G. New questions raised by CLAUDE.md and the gateway spec

**D-48 Multi-finding scores (rule 5) — OPEN.** Rule 5 affects the HFA-PEFF score (TTE-R10…R13), and possibly the RAP estimate (VCI + collapse) and CHA₂DS₂-VASc. May a multi-input *score* be shown as a display-only derived value (like `aci_acc_ratio` in Carotis), as long as it generates no text? *(Vorschlag: yes, display-only, never in the report.)*

**D-49 Recommendations — ANSWERED (2026-09-28).** The CLAUDE.md rule "No therapy or device-programming recommendations, anywhere, ever" is replaced by: *recommendations only as physician-selected text blocks from a reviewed library (each with source and review date); the app never inserts, preselects or triggers a recommendation automatically from values, scores or classifications; warning labels stay neutral ("außerhalb des Referenzbereichs") and give no advice.* Consequences:
(a) TTE Empfehlung blocks → library blocks, inserted by you. Content still to review (D-20).
(b) CV section 6 → library blocks, inserted by you. The automatic, score-dependent OAC sentence (CV-R01) and the always-on β-blocker sentence are not allowed as automatic text. Content still to review (D-39).
(c) SM "Weiteres Vorgehen" / "Wundversorgung" → kept; each order is a block you select (as the checkboxes already work).
(d) TEE TEER suitability sentences → allowed, only following your assigned suitability (D-29).
(e) Carotis "Empfohlene Verlaufskontrolle" → compliant (physician-selected).
(f) Device → the fixed "nächste Kontrolle in 6-8 Wochen" sentence is not inserted automatically (becomes a block or fact field, D-63); badge advice ("Optimierung empfohlen", "Vektorwechsel vorgeschlagen!") is removed, labels neutral (D-61).
All prototype recommendation texts remain available verbatim in SPEC-textgen.

**D-50 Extraction bounds — OPEN.** Every extractable field needs `expectedUnit` and `plausibleRange` (gateway §3.4). The prototype has none. Will you provide them for the ~27 TTE fields (and later Device), or should I draft a table for you to correct?

**D-51 Conditional bands — OPEN.** Sex-specific (LVEF, IVSd, LVEDD, LVESD, LVMI) and rhythm-specific (BNP, NT-proBNP, LAVI) bands do not fit the gateway `ClassificationRule` (one field, one band list). Extend the interface with a condition (e.g. `when: { sex: "männlich" }`), or one rule file per sex/rhythm?

**D-52 Band boundaries — OPEN.** The gateway LVEF example (min 55 / 45–54 / 30–44 / max 29) leaves decimal values such as 54.5 % in no band — silently no sentence, which gateway §5.2.3 forbids. Use half-open intervals (`min` inclusive, `max` exclusive) throughout? And the example cut-offs (55/45/30) differ from the prototype (52 m/54 f / 41 / 30) — which apply?

**D-53 Repository layout — OPEN.** Your upload landed in `kardio-doku/kardio-doku-starter/kardio-doku/` plus the zip. On my branch I moved CLAUDE.md, the two specs and the zip's `.gitignore` to the repository root (CLAUDE.md only works there). OK to also delete the leftover `kardio-doku/kardio-doku-starter.zip`? CLAUDE.md also refers to `PLAN.md`, which does not exist yet — should the next session draft it for your approval?

**D-54 Seed documents — OPEN.** Gateway §2.5 needs ~20 synthetic echo printouts and device reports with known values. Will you provide anonymized/synthetic originals from your devices, or should synthetic PDFs be generated to mimic their layout (needs a sample layout from you)?


## H. Device-Abfrage (from the audit of HSM_Abfrage)

**D-55 Device identity fields — OPEN.** Gateway §2.6.4 forbids extracting model and serial numbers; the prototype extracts the model. Keep manufacturer + device type extractable and model manual-only? Is the manufacturer itself allowed as an extractable field?

**D-56 Device type vs pacing mode — OPEN.** The prototype field "Schrittmachermodus" holds device types (1-Kammer HSM … CRT-D), and Medtronic "Betriebsart" (a mode such as DDDR) is mapped onto it. Two separate fields: **Gerätetyp** and **programmierter Modus** (NBG code)? The labels "VVI-D"/"DDD-D" are not NBD codes — which labels do you want?

**D-57 Implant date — OPEN.** The field is labelled "Sterilisations-/Implantations-Datum" — which date do you want? Is an implantation date acceptable in TESTBETRIEB documents at all (your anonymization list in gateway §2.6.2 removes the Untersuchungsdatum; the implant date is a similar quasi-identifier)?

**D-58 Battery status — OPEN.** Today one free-text field mixes years, volts, "OK" and ERI dates; a bare number is printed as "Jahre bis EOL". Structure it as value + unit (Jahre / Monate / V) + status (OK / RRT / ERI / EOS)? Which term — RRT, ERI or EOL?

**D-59 Medtronic "Sensing Threshold" — OPEN.** Your AI Studio instruction maps "Atrial/Ventricular Sensing Threshold" to the measured P/R amplitude. On many reports this label is the programmed sensitivity instead. Please confirm on a real (anonymized) Medtronic printout which value is meant.

**D-60 Model-written fields — OPEN.** The prototype lets the model write the AHRE summary, the ICD therapy summary and the indication, and prints them verbatim. Under extraction-only these must become structured fields. Which ones? *(Vorschlag: AT/AF episodes n, longest duration, AF burden %; VT/VF episodes n; ATP n; shocks n; indication as a select — all physician-confirmed.)*

**D-61 Device measurement ranges — OPEN.** Out-of-range highlighting exists only for six ICD/CRT badges; RA/RV impedance, sensing and threshold have hint texts only, with a gap (1000–2000 Ω undefined). Which ranges and source for all lead values (shared with SM-Implantation, D-33)? Badge wording: neutral ("außerhalb des Referenzbereichs") only, no interpretation such as "Sondenfehler?" or "Kondensatoralterung"?

**D-62 Device conclusion — OPEN.** The prototype always writes "Regelrechte Abfrage", "Regelrechte Messwerte" and "Zusammenfassend regelrechte Funktion des Aggregats ohne Anhalt für Sonden- oder Wahrnehmungsstörungen." — even with critical values. Under rule 5 this is a multi-finding judgement → physician-assigned select (e.g. "regelrechte Funktion" / "Auffälligkeit: …"), with export blocked or warned when a highlighted value conflicts?

**D-63 Follow-up interval — ANSWERED (2026-09-28).** Plain fact: `Nächste Kontrolle: {Intervall}.`, printed only if filled (SPEC-textgen LIB-DEV-01).

**D-64 Section order — OPEN.** Keep your mnemonic order (Elf · Bunte · Elefanten · Sitzen · Silvester · [ICD] · [CRT] · Beim · Prosecco · Dinner) as the section and tab order of the Device form, with the mnemonic labels shown or not?

---

## Reminders

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
