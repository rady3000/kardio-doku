# SPEC-shared — Common elements of all modules

Status: **Draft v0.1 (Session 1, audit only)**. Source: prototype audit of
`TTE_V2026`, `TEE_2026`, `HSM_Implantationsmaske`, `eCV_APP`.
`HSM_Abfrage` (Device-Abfrage) could **not** be read in this session (see
SPEC-decisions D-01). Decision references `D-xx` point to SPEC-decisions.md.

Conventions in this file:

- **Observed** = what the prototypes do today (fact, with source file).
- **Proposed** = the common target for kardio-doku. Every proposed item that
  depends on an open question names the decision it waits on.
- Nothing here has been fixed clinically. Flags are marked ⚠.

---

## 1. Module list

| Module | Short name | Prototype repo | Report type | Status |
|---|---|---|---|---|
| Transthorakale Echokardiographie | `tte` | TTE_V2026 | Befund | audited |
| Transösophageale Echokardiographie | `tee` | TEE_2026 | Befund | audited |
| Device-Abfrage (HSM/ICD/CRT) | `device` | HSM_Abfrage | Befund | **not accessible** (D-01) |
| Schrittmacher-/ICD-Implantation | `sm-impl` | HSM_Implantationsmaske | OP-Bericht | audited |
| Elektrische Kardioversion | `cv` | eCV_APP | Protokoll | audited |
| Carotis-Duplex | `carotis` | — | Befund | reference spec `spec/SPEC-carotis.md` announced but **not present in repo** (D-02) |

---

## 2. Patient header

### 2.1 Observed

| Prototype | Fields | Where it appears in the output |
|---|---|---|
| TTE | `Patient` (one free-text field, placeholder "Name, Vorname, Geburtsdatum..."), `Datum der Untersuchung` (date, default today), `Geschlecht` (weiblich/männlich, **default weiblich**) | Only in the PDF header ("Patient: …", "Datum: …"). **Not** in the copied text report. Geschlecht only drives cut-offs. |
| TEE | `Patient` (free text, placeholder "Name, Vorname, Geb.-Datum..."), `Datum der Untersuchung` | ⚠ **Neither field is used anywhere** — the patient input has no id; the report contains no patient or date. |
| SM-Implantation | `Nachname`, `Vorname`, `Geburtsdatum` (date) | "Patient: {Nachname}, {Vorname}, {Geburtsdatum dd.mm.yyyy}" |
| Kardioversion | `Name` (free text, "Nachname, Vorname"), `Geschlecht` (Männlich/Weiblich, **default Männlich**), `Geburtsdatum` | In the prose: "Bei dem Patienten {Name}, geb. am {dd.mm.yyyy}, …". Geschlecht drives grammatical gender. |

⚠ Inconsistencies: one-field vs split name; sex default differs (TTE
weiblich, CV männlich); SM has no sex field but writes "Der Patient" (fixed
masculine); TEE collects header data and then discards it.

### 2.2 Proposed (pending D-03, D-04, D-40)

| Field | German label | Type | Required | Default | Notes |
|---|---|---|---|---|---|
| `patient.lastName` | Nachname | text | yes | — | |
| `patient.firstName` | Vorname | text | yes | — | |
| `patient.birthDate` | Geburtsdatum | date (dd.mm.yyyy) | yes | — | |
| `patient.sex` | Geschlecht | enum `weiblich` \| `männlich` \| `divers` | yes | **none**; must be chosen | Drives sex-specific cut-offs (TTE) and grammar (CV, SM). No silent default (D-40). |
| `patient.caseId` | Fall-/Patientennummer | text | no | — | Only if the KIS needs it (D-04). |

Header line (all modules):
`{Nachname}, {Vorname}, geb. {Geburtsdatum}` — exact form depends on KIS (D-04).

---

## 3. Study / procedure metadata

### 3.1 Observed

| Prototype | Date | Indication | Other |
|---|---|---|---|
| TTE | `Datum der Untersuchung` | `Klinische Indikation` dropdown | `EKG Rhythmus`, `Schallbedingungen` |
| TEE | `Datum der Untersuchung` (unused) | `Indikation` dropdown | `Sedierung` |
| SM | `Operationsdatum` | `Diagnose` dropdown (+ free text) | `clinic` fixed "Klinik für Kardiologie" |
| CV | ⚠ **no procedure date field**; the preview shows *today's* date | `Typ` (Erstdiagnose/Rezidiv/Vorhofflattern) | — |

### 3.2 Proposed

| Field | German label | Type | Default |
|---|---|---|---|
| `study.date` | Untersuchungsdatum / Operationsdatum | date | today, editable |
| `study.time` | Uhrzeit | time | optional |
| `study.indication` | Indikation | module-specific enum + free text | none |
| `study.institution` | Klinik / Abteilung | fixed config value | from settings |

---

## 4. Examiner

### 4.1 Observed

- TTE, TEE: **no examiner field**.
- SM: `operator` hard-coded `"Dr. med. Mohamed Rady"` (not editable in UI),
  printed as "Operateur:" and again as closing signature line.
- CV: blank signature lines "Untersucher" and "Oberarzt/Chefarzt" in print
  preview only; not in copied text.

### 4.2 Proposed (pending D-03)

| Field | German label | Type | Default |
|---|---|---|---|
| `examiner.name` | Untersucher / Operateur | selectable list from settings | last used |
| `examiner.supervisor` | Oberarzt / Freigabe | selectable list, optional | — |
| `examiner.assistant` | Assistenz | text, optional (SM only) | — |

---

## 5. Conclusion ("Zusammenfassung" / "Beurteilung")

### 5.1 Observed

| Prototype | Heading | Form |
|---|---|---|
| TTE | `Zusammenfassung:` | Comma-joined fragment list, terminated with "." (see SPEC-textgen TTE-S*) |
| TEE | `Zusammenfassung:` | Comma-joined list, or a fixed normal sentence |
| SM | none (ends with "Weiteres Vorgehen" / "Wundversorgung") | bullets "o …" |
| CV | none (section "6. EMPFEHLUNGEN UND WEITERES VORGEHEN") | prose |

### 5.2 Proposed

- Every Befund module (TTE, TEE, Device, Carotis) ends with **Zusammenfassung**
  built only from deterministic rules (SPEC-textgen).
- Procedure modules (SM, CV) end with **Procedere / Empfehlung**.
- Optional free-text field **Ergänzung** appended verbatim. It is the only
  place where uncontrolled text enters the report.
- Heading word ("Zusammenfassung" vs "Beurteilung") is D-43.

---

## 6. Export

### 6.1 Observed

| Prototype | Copy | PDF | DOCX | Print | File name |
|---|---|---|---|---|---|
| TTE | plain text (`document.execCommand('copy')`, deprecated) | jsPDF + autotable: title "Echokardiographie Befund", patient/date line, measurement table, "Befundtext:" + report text | — | — | ⚠ `TTE-Befund-{patient name}.pdf` |
| TEE | plain text (execCommand) | — | — | — | — |
| SM | rich text (HTML + plain) via Clipboard API | via browser print | `docx` 8.5.0, Arial 11 pt, tables | print window | ⚠ `OP-Bericht_{Nachname}_{date}.docx` |
| CV | plain text (Clipboard API) | via `window.print()` | — | yes (A4 layout, signature lines) | — |

⚠ The three SM renderers (text, preview, DOCX) are maintained by hand in
parallel and **disagree** (see SPEC-modules §SM-8).

### 6.2 Proposed (pending D-04, D-45)

1. **One** report model per module → **one** renderer producing a neutral
   block structure → adapters for plain text, rich text/HTML clipboard, PDF,
   and (if needed) DOCX. No hand-duplicated templates.
2. Primary action: **copy for KIS** in the format the KIS accepts (D-04).
3. File names contain no patient name by default (D-44).
4. Plain-text line length, bullets ("o", "-", "•") and tab use are decided by the KIS (D-04).

---

## 7. Persistence

Observed: **none** in any prototype. No localStorage, IndexedDB, or backend.
Closing the tab loses everything. Proposed: depends on D-03 (single laptop vs
several workstations) and D-05 (Vorbefund comparison).

---

## 8. Model usage (shared policy)

Observed: only TTE calls a model (Google Gemini, browser-side, key inlined
into the bundle by `vite.config.ts` in **all four** prototypes). Details:
SPEC-modules §TTE-3 and SPEC-textgen §X.

Policy (from the project brief, restated):

1. The model may only **extract** values from a source document into fields.
2. Every sentence in the report comes from a deterministic rule in SPEC-textgen.
3. Extracted values are shown as *unconfirmed* until the user accepts them (proposed).
4. The API key must never ship in client code (⚠ it does in all prototypes today).
5. Sending documents that contain patient identifiers to an external model
   needs a data-protection decision first (D-06).

---

## 9. Shared vocabulary (observed variants)

Severity words differ between modules and even within TTE:

| Concept | TTE variants | TEE variants |
|---|---|---|
| mild | `leicht`, `leichte`, `leichtgradig`, `leicht dilatiert`, `leichtgradig dilatiert`, `geringgradig` | `Leichtgradig`, `Grad I (leicht)`, `Gering reduziert` |
| moderate | `mittelgradig`, `mittelgradige`, `mäßig` | `Mittelgradig`, `Grad II (moderat)` |
| severe | `hochgradig`, `hochgradige`, `schwer`, `deutlich eingeschränkt` | `Hochgradig`, `Grad III (hoch)`, `Schwer reduziert` |
| normal | `normal`, `normwertig`, `normal dimensioniert`, `zart` | `Normal`, `Zart`, `Keine` |

Proposed: one controlled vocabulary with declined forms generated by the
grammar layer (D-17). Grades in the summary: `I°`, `II°`, `III°` (TTE today
emits `I` without ° for stenoses — see TTE flags).
