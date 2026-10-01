# PLAN.md — Kardio-Doku build plan

Status: **DRAFT — awaiting physician approval.** No application code is
written before this plan is approved (D-53).

Scope: stage 1 (trial) per CLAUDE.md and SPEC-decisions D-04. Stage 2 is
listed at the end for orientation only; it is not planned in detail.

Rule for every milestone: it ends with a build you can install on Windows and
a short test list in German-language UI terms. **Work stops at the end of each
milestone** until you have tested it clinically and released the next one.

---

## Dependencies to approve before M1

CLAUDE.md fixes the stack (Electron, React, TypeScript, better-sqlite3, Zod,
Tailwind, Vitest) and says "no other dependencies without asking". The build
cannot work without the tools below. Please approve or reject each one.

| # | Package | Why it is needed | Ships in the app? |
|---|---|---|---|
| P1 | `vite` + `@vitejs/plugin-react` | compiles React/TypeScript and Tailwind into files Electron can load | no (build tool) |
| P2 | `electron-builder` | builds the single Windows installer (`.exe`, NSIS) and handles the better-sqlite3 rebuild for Electron, so you need no C++ compiler | no (build tool) |
| P3 | `docx` | writes the DOCX export (header with the TESTDATEN marker) | yes |
| P4 | `@playwright/test` | automated end-to-end tests of the running app (keyboard flow, exports) | no (test tool) |
| P5 | `pdfjs-dist` (M4 only) | shows the source PDF page with the highlighted bounding box during verification | yes |

PDF export needs no extra package: Electron prints the report page to PDF
itself. Fonts are bundled in the app (no CDN).

**Windows builds.** I work in a Linux cloud container. The Windows installer
is built by a GitHub Actions job on a Windows machine; you download the
finished installer from the GitHub page of each milestone. Your computer needs
no developer tools. (This build job runs on GitHub, not in the app; the app's
single network path is unaffected.)

---

## M0 — Audit and specifications — DONE

Prototype audit, SPEC-shared, SPEC-modules, SPEC-textgen, SPEC-decisions
(D-01 … D-72). Open inputs from you: LIB-VHF-01, LIB-MI-01 text blocks
(D-20); review of the D-50 ranges (SPEC-textgen §X-6); source for the
charge-time / BiV warnings (D-72 f).

## M1 — Foundations (no clinical module yet)

Goal: an installable, empty but safe shell.

- Electron + React + TypeScript scaffold; Tailwind; Vitest; Windows installer
  via GitHub Actions.
- Betriebsmodus: `TESTBETRIEB` (default) / `ECHTBETRIEB`, separate `test.db` /
  `live.db`, no import path between them; mode visible at all times.
- TESTDATEN marker: screen banner (undisableable); export hooks prepared.
- Network egress guard: all network access blocked except the (still empty)
  gateway module; a test fails if any other code makes a call.
- Patient record (stage 1, D-04): patients, studies, reports; patient header
  fields per SPEC-shared; sex weiblich / männlich, no default (D-40).
- Study core: create / open / list studies per patient; continuous autosave.
- Settings: provider configuration placeholder; API keys only via Electron
  `safeStorage` (no key is used yet).

Your test: install, switch modes, create a patient and a study, close and
reopen — data still there; banner always visible in TESTBETRIEB.

## M2 — Schema engine and TTE with manual entry

Goal: you document a complete TTE by keyboard and paste the report.

- Module schema format (Zod-validated): sections, fields, units, allowed
  values, defaults, normal ranges, `extractable`, visibility conditions,
  derived values, rule references, sentence templates.
- Rule files `reference/*.json` with `source` and `reviewedOn`; validator:
  contiguous, non-overlapping bands, conditions (sex, rhythm; D-51), boundary
  semantics (D-52). Tests per band set.
- Generic form renderer: full tab order, decimal comma and point, "Alles
  normal" per section in one keystroke, "nicht beurteilbar" in every select,
  out-of-range highlight never blocking, derived values live with inputs on
  hover.
- Report generator: fixed German sentences from confirmed values; empty field
  → no text (D-18); every sentence editable, your edit stored and wins;
  "Zusammenfassung" (D-43); footer with rule sets and versions; golden-file
  tests (byte-identical output).
- Library blocks (physician-selected only, never preselected): HI general,
  LIB-VHF-01 / LIB-MI-01 once supplied.
- TTE schema and rules per SPEC-modules and SPEC-textgen: R20 HFpEF, R30
  chamber quantification, R40 TR grades, TTE-P prostheses, TTE-M measurement
  layout.
- Exports: clipboard (first line TESTDATEN in TESTBETRIEB), DOCX (header),
  PDF (watermark on every page); file names without patient names (D-44).

Your test: document 10 real-world-like TTEs (synthetic data) and compare the
time with today's workflow; check every generated sentence.

## M3 — Device-Abfrage with manual entry

- Device schema: device type and pacing mode (D-56), manufacturer / model
  catalogue (D-35), serial manual only, battery (D-58), lead values with
  qualifier (D-72 b), ICD / CRT / S-ICD sections, episode fields (D-60, D-72 c),
  section order without mnemonic labels (D-64).
- DEV-REF neutral highlighting (D-61, D-72 f); conclusion physician-selected
  with contradiction warning (D-62); "Nächste Kontrolle: {Intervall}" (D-63).
- Golden files and band tests as in M2.

Your test: 10 interrogations across SM, ICD, CRT.

## M4 — Extraction gateway (TTE and Device)

Precondition: your anonymized documents (D-54) — echo GE and Philips; device
Vitatron, Abbott, Medtronic.

- Before coding: I check the current Mistral OCR documentation (response
  format, bounding boxes, page limits, data handling) and report to you.
- Gateway module behind a provider interface; cloud provider only in
  TESTBETRIEB, greyed out and uninvokable in ECHTBETRIEB; self-hosted path
  prepared for ECHTBETRIEB.
- Field rules per SPEC-extraction-gateway: page + bounding box required,
  confidence threshold, `expectedUnit` / `plausibleRange` per SPEC-textgen
  §X-6, unit conversion in code only; failures → empty field "Extraktion
  fehlgeschlagen".
- Verification UI: unconfirmed values visually distinct, source page with
  highlighted box, per-field and "Alle bestätigen", hard export block while
  any unconfirmed value feeds text.
- Extraction audit table; seed-document set and evaluation harness (accuracy
  per field and vendor); one- vs two-stage extraction decided by the results
  (D-07). Boston Scientific and Biotronik marked "unevaluated" until real
  samples exist.

Your test: run your sample documents, confirm values against the source,
review the harness report.

## M5 — TEE

TEE schema incl. new blocks (D-27, D-72 e), thrombus dropdown (D-25), LAA flow
categories (D-26), shared sedation block (D-30), M-TEER suitability
(physician-assigned, D-29).

## M6 — Schrittmacher-Implantation

Procedure types incl. Aggregatwechsel (D-36), CRT / ICD / S-ICD narratives
(drafted by me, reviewed by you — D-72 h), vena cephalica wording (D-72 i),
DEV-REF acute thresholds, fluoroscopy time min:s (D-37).

## M7 — Elektrische Kardioversion

Shared sedation block, shock protocol (D-38), anticoagulation library blocks
LIB-CV (ESC 2024; physician-selected, D-39), no early-CV option.

## M8 — Karotis

Per `spec/SPEC-carotis.md`; needs the criteria values from you before start.

---

## Stage 2 (later, not planned in detail)

Login and roles, audit trail, backup, GDT link to the practice-management
system, several workstations with a shared database (D-03, D-04).

## Open inputs from you (tracked)

- Approval of this plan and of dependencies P1–P5.
- LIB-VHF-01, LIB-MI-01 text blocks (needed in M2, D-20).
- Review of SPEC-textgen §X-6 ranges (needed in M4, D-50).
- Anonymized sample documents (needed in M4, D-54).
- Source for charge-time / BiV warnings (needed in M3, D-72 f).
- Carotid criteria values (needed in M8).
