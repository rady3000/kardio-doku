# SPEC-shared.md — Shared Study core (all modules)

**Status:** Draft v0.2 (milestone 0, audit only). Source: prototype audit of
`TTE_V2026`, `TEE_2026`, `HSM_Implantationsmaske`, `eCV_APP`
and `HSM_Abfrage`, reconciled with `CLAUDE.md` and
`SPEC-extraction-gateway.md`.

Conventions:
- **Observed** = what the prototypes do (fact).
- **Target** = what CLAUDE.md / the gateway spec already require (quoted, not invented).
- **Open** = needs a decision (`D-xx` → SPEC-decisions.md).
⚠ = flag. Nothing clinical is fixed here.

---

## 1. Module list

| # | Module key | Display name | Prototype | Extraction |
|---|---|---|---|---|
| 1 | `tte` | Transthorakale Echokardiographie (TTE) | TTE_V2026 | v1 |
| 2 | `device` | Device-Abfrage (SM / ICD / CRT-P / CRT-D) | HSM_Abfrage | v1 |
| 3 | `tee` | Transösophageale Echokardiographie (TEE) | TEE_2026 | later |
| 4 | `carotis` | Karotis-Duplexsonographie | none — `SPEC-carotis.md` | later |
| 5 | `sm_impl` | Schrittmacher-Implantation | HSM_Implantationsmaske | later |
| 6 | `cv` | Elektrische Kardioversion | eCV_APP | later |

Target (CLAUDE.md): one shell, one shared Study core, six declarative module
schema files, one generic form renderer, one report generator, one extraction
gateway.

---

## 2. Patient header

### 2.1 Observed

| Prototype | Fields | Where it appears in the output |
|---|---|---|
| TTE | `Patient` (one free-text field "Name, Vorname, Geburtsdatum..."), `Datum der Untersuchung` (default today), `Geschlecht` (weiblich/männlich, **default weiblich**) | PDF header only; not in the copied text. Sex drives cut-offs. |
| TEE | `Patient` (free text), `Datum der Untersuchung` | ⚠ **never used** (no id; not in report) |
| SM | `Nachname`, `Vorname`, `Geburtsdatum` | "Patient: {Nachname}, {Vorname}, {dd.mm.yyyy}" |
| CV | `Name` ("Nachname, Vorname"), `Geschlecht` (**default Männlich**), `Geburtsdatum` | in prose: "Bei dem Patienten {Name}, geb. am {dd.mm.yyyy}, …" |
| Device | `Patienten-Identifikation` (free text), `Datum der Nachsorge` | ⚠ **never used**; the report has no header; "Der Patient" fixed |

⚠ Split vs single name field; sex default differs (TTE weiblich, CV männlich);
SM has no sex field but writes "Der Patient"; TEE discards its header.

### 2.2 Target / open

| Field key | Label (DE) | Type | Required | Default | Notes |
|---|---|---|---|---|---|
| `patient_last_name` | Nachname | text | yes | — | |
| `patient_first_name` | Vorname | text | yes | — | |
| `patient_birth_date` | Geburtsdatum | date | yes | — | |
| `patient_sex` | Geschlecht | select | yes | none (D-40) | drives sex-specific bands (D-51) and grammar |
| `patient_case_id` | Fallnummer | text | no | — | only if the KIS needs it (D-04) |

In `TESTBETRIEB` the header holds synthetic or anonymized data only
(gateway §2.6). Header data are never extractable in any mode (they are
identifiers; gateway §2.6.1 requires removal before import).

---

## 3. Study metadata

### 3.1 Observed

| Prototype | Date | Indication | Other |
|---|---|---|---|
| TTE | Datum der Untersuchung | Klinische Indikation | EKG Rhythmus, Schallbedingungen |
| TEE | Datum der Untersuchung (unused) | Indikation | Sedierung |
| SM | Operationsdatum | Diagnose (+ free text) | clinic fixed "Klinik für Kardiologie" |
| CV | ⚠ none — the print shows today's date | Typ | — |
| Device | Datum der Nachsorge (unused) | Indikation (of the implant) | device type, manufacturer, model, implant date |

### 3.2 Target / open

| Field key | Label (DE) | Type | Default | Notes |
|---|---|---|---|---|
| `study_date` | Untersuchungsdatum / Operationsdatum | date | today | |
| `study_indication` | Indikation | module select + free text | — | module-specific lists |
| `study_mode` | Betriebsmodus | fixed per database | `TESTBETRIEB` | gateway §2; set by the database file, not per study |
| `study_institution` | Klinik / Abteilung | config | from settings | |
| `vorbefund_datum` | Voruntersuchung vom | date | — | as SPEC-carotis §2; comparison scope D-05 |

---

## 4. Examiner

### 4.1 Observed

TTE, TEE, Device: none. SM: `operator` hard-coded "Dr. med. Mohamed Rady" (printed
as "Operateur:" and as the closing line). CV: blank signature lines
"Untersucher" / "Oberarzt/Chefarzt" (print only).

### 4.2 Target / open

| Field key | Label (DE) | Type | Default |
|---|---|---|---|
| `examiner_name` | Untersucher / Operateur | select from settings | last used |
| `examiner_supervisor` | Oberarzt / Freigabe | select, optional | — |

Report footer names the examiner (SPEC-carotis §8).

---

## 5. Conclusion (Beurteilung / Zusammenfassung)

### 5.1 Observed

| Prototype | Heading | Form |
|---|---|---|
| TTE | `Zusammenfassung:` | comma-joined fragments (SPEC-textgen TTE-S) |
| TEE | `Zusammenfassung:` | list, or a fixed normal sentence (TEE-S) |
| SM | none | ends with "Weiteres Vorgehen" / "Wundversorgung" bullets |
| CV | none | "6. EMPFEHLUNGEN UND WEITERES VORGEHEN" (therapy recommendations) |
| Device | none | fixed sentence "Zusammenfassend regelrechte Funktion des Aggregats …" + "nächste Kontrolle in 6-8 Wochen" — unconditional ⚠ |

### 5.2 Target (CLAUDE.md, SPEC-carotis §5/§7.3)

- The draft Beurteilung is composed from templates on structured fields and is
  **fully editable**; the physician's edit is stored and wins.
- It reports back what was recorded; it forms no opinion.
- **Recommendations only as physician-selected text blocks** from a reviewed
  library (each with source and review date); never inserted, preselected or
  triggered automatically from values, scores or classifications (CLAUDE.md,
  D-49). This covers the TTE Empfehlung blocks, CV section 6, SM post-op
  orders, TEE TEER sentences, Carotis "Verlaufskontrolle" and the Device
  follow-up sentence.
- Heading word: SPEC-carotis uses "Beurteilung"; the prototypes use "Zusammenfassung" (D-43).

---

## 6. Export

### 6.1 Observed

| Prototype | Copy | PDF | DOCX | Print | File name |
|---|---|---|---|---|---|
| TTE | plain text (`execCommand`, deprecated) | jsPDF + table | — | — | ⚠ `TTE-Befund-{patient}.pdf` |
| TEE | plain text | — | — | — | — |
| SM | rich text + plain | via print | `docx`, Arial 11 pt | yes | ⚠ `OP-Bericht_{Nachname}_{date}.docx` |
| CV | plain text | via print | — | yes (A4, signature lines) | — |
| Device | none (editable textarea only; manual copy) | — | — | — | — |

⚠ The SM text, preview and DOCX renderers are separate hand-written copies and disagree.

### 6.2 Target (CLAUDE.md, gateway §2.4)

1. One click each: **clipboard (primary)**, DOCX, PDF — from one report
   model through one generator.
2. `TESTBETRIEB`: `TESTDATEN – NICHT FÜR DIE PATIENTENDOKUMENTATION` as the
   **first line of clipboard output**, DOCX header, PDF watermark on every page,
   and screen banner. Cannot be disabled.
3. Footer names the rule sets and versions used (and, for Carotis, the grading criteria).
4. Export is blocked while any unconfirmed extracted value feeds a rule or the text (gateway §4.2).
5. Tables: real tables in DOCX/PDF, tab-aligned in the clipboard (SPEC-carotis §9).
6. Open: the KIS paste format (D-04); patient name in file names (D-44).

---

## 7. Persistence

Observed: **none** in any prototype.

Target (CLAUDE.md): SQLite via better-sqlite3, continuous autosave, separate
`test.db` / `live.db` with no import path between them; source PDFs stored in
the same mode-partitioned file (gateway §2.3). Single install on Windows.
Multi-workstation use is still open (D-03).

---

## 8. Model usage

Observed: two prototypes call a model (Google Gemini):
- **TTE** — from the browser; the key is inlined into the client bundle.
  Numbers only; no model-written text.
- **Device-Abfrage** — from a small Express server (key server-side). ⚠ Three
  fields are model-written summaries printed verbatim in the report (AHRE,
  ICD therapies, indication).

TEE, SM and CV define the key in `vite.config.ts`, but their client code never
references it, so it is not in their bundles.
Details: SPEC-modules TTE A.2 / Device A.2, SPEC-textgen §X and §G-4.

Target (CLAUDE.md, gateway): extraction only, through the single gateway module
(the only network egress); providers Mock / Mistral OCR (`TESTBETRIEB`) /
self-hosted Mistral OCR (`ECHTBETRIEB`); every value arrives unconfirmed with
page + bounding box + raw text + confidence, or is discarded; key in Electron
`safeStorage`. **Nothing from the prototype's Gemini integration carries over**
except the label hints.

---

## 9. Shared vocabulary (observed variants)

| Concept | TTE variants | TEE variants |
|---|---|---|
| mild | `leicht`, `leichte`, `leichtgradig`, `leicht dilatiert`, `leichtgradig dilatiert`, `geringgradig` | `Leichtgradig`, `Grad I (leicht)`, `Gering reduziert` |
| moderate | `mittelgradig`, `mittelgradige`, `mäßig` | `Mittelgradig`, `Grad II (moderat)` |
| severe | `hochgradig`, `hochgradige`, `schwer`, `deutlich eingeschränkt` | `Hochgradig`, `Grad III (hoch)`, `Schwer reduziert` |
| normal | `normal`, `normwertig`, `normal dimensioniert`, `zart` | `Normal`, `Zart`, `Keine` |

Open: one controlled vocabulary with declined forms (D-17). The gateway example
uses "leichtgradig / mittelgradig / hochgradig reduziert".

---

## 10. Data-entry features the prototypes already hint at

| Target feature (CLAUDE.md) | Prototype precedent |
|---|---|
| "Alles normal" per section | TTE "Normale TTE vorbefüllen", TEE "Normale TEE" (whole study; do not clear numbers) |
| Conditional visibility | every prototype (details shown per grade/selection) |
| Out-of-range highlight, never blocked | TTE amber/red input highlighting (TTE-H01…H17) |
| Presets | SM "Vitatron Standard" / "Abbott Standard" |
| Live derived values | TTE live HF-PEFF panel (but see D-48) |
| Keyboard-first | ⚠ none — all prototypes use mouse dropdowns (TTE/TEE custom `<a>` menus are not keyboard-accessible) |
