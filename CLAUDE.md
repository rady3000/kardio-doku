# CLAUDE.md — Kardio-Doku

Read this at the start of every session. These rules override anything that
seems convenient in the moment. If a task appears to require breaking one,
stop and ask me.

## What this is

A clinical documentation app for my daily cardiology investigations. I am a
cardiologist and Chefarzt in Germany. I am **not** a professional software
developer: give me exact commands to run, one step at a time, and explain
what each step does in one plain sentence.

Status: **prototype for in-house evaluation.** Not CE-marked. Used during the
trial only with synthetic or anonymized documents, never as the report of
record.

Six modules:

| # | Module | Document extraction |
|---|---|---|
| 1 | Transthorakale Echokardiographie (TTE) | yes (v1) |
| 2 | Device-Abfrage (SM / ICD / CRT-P / CRT-D) | yes (v1) |
| 3 | Transösophageale Echokardiographie (TEE) | later |
| 4 | Karotis-Duplexsonographie — no prototype, see `spec/SPEC-carotis.md` | later |
| 5 | Schrittmacher-Implantation | later |
| 6 | Elektrische Kardioversion | later |

The single most important quality is **speed of data entry**. If a normal TTE
takes longer to document than it does today, the app has failed.

## Specifications

Read the relevant file before working on its area. Do not load them all
into every task.

- `spec/SPEC-extraction-gateway.md` — Betriebsmodus, extraction, verification,
  classification rules. **The safety design. Read before touching any of it.**
- `spec/SPEC-carotis.md` — carotid module; also the format reference for
  module specs.
- `spec/SPEC-shared.md`, `spec/SPEC-modules.md`, `spec/SPEC-textgen.md`,
  `spec/SPEC-decisions.md` — produced by the prototype audit (milestone 0).
- `PLAN.md` — the approved build plan. Keep it current.

## How the app works — the core design

```
source PDF → extraction (model) → UNCONFIRMED values
          → I confirm each against the highlighted source
          → deterministic classification rules → fixed German sentences
          → report
```

1. **The model does extraction only.** It reads values off a document into
   fields. It never writes clinical prose, never drafts a Beurteilung, never
   forms an opinion.
2. **All report text is deterministic.** Confirmed values pass through
   threshold rules that map to fixed German sentences. Same input → byte-
   identical output, permanently. Golden-file tested.
3. **Extracted values enter unconfirmed.** Each shows its source page with the
   bounding box highlighted. No export while any value that feeds a rule or
   the report text is unconfirmed. A value without page + bounding-box
   provenance is discarded, never displayed. Low confidence, implausible
   range, or wrong unit → discarded. **Empty is safe. Wrong is not.**
4. **Classification rules are data, not code.** Threshold bands live in
   `reference/*.json`, each naming its source guideline and review date.
   Bands must be contiguous and non-overlapping, or validation fails.
5. **Auto-classify only single-value guideline mappings** (e.g. LVEF →
   category). Never multi-finding judgements (e.g. carotid stenosis grade):
   those stay physician-assigned, with the criteria table displayed alongside.
   Exceptions: the HFpEF sentence per SPEC-textgen TTE-R20 and the
   RV-function sentence per SPEC-textgen TTE-R30-7, inserted automatically
   but always editable and removable.
6. **Every generated sentence stays editable.** My edit is stored and wins.

## Hard constraints

- **Betriebsmodus.** Two modes: `TESTBETRIEB` (default) and `ECHTBETRIEB`,
  with separate SQLite files (`test.db`, `live.db`) and no import path
  between them. Cloud providers exist **only** in `TESTBETRIEB`; in
  `ECHTBETRIEB` they are greyed out and uninvokable.
- **TESTDATEN marker.** In `TESTBETRIEB` every export carries
  `TESTDATEN – NICHT FÜR DIE PATIENTENDOKUMENTATION`: screen banner, PDF
  watermark every page, DOCX header, and **the first line of clipboard
  output**. Undisableable.
- **One network egress path.** Only the extraction gateway module may make
  network calls. No telemetry, analytics, auto-update, CDN fonts or scripts.
  All dependencies bundled. A test fails if any call originates elsewhere.
- **Fully usable offline and with no provider configured.** Manual entry is
  the baseline; extraction only pre-fills.
- **Secrets.** API keys in Electron `safeStorage` only. Never in files, never
  in the repo, never in a shipped `.env`. Never print a key in output.
- **Recommendations only as physician-selected text blocks.** Therapy,
  follow-up and device-programming recommendations may appear in a report
  only as text blocks that I explicitly insert from a reviewed library (each
  with source and review date, like the rule sets). The app never inserts,
  preselects or triggers a recommendation automatically from values, scores
  or classifications. Warning labels on input fields stay neutral
  ("außerhalb des Referenzbereichs") and give no advice.
- **Language.** UI and report text: German. Code, comments, identifiers,
  docs, commit messages: English.
- **Platform.** Windows, installable as a single package.

## Stack

Electron + React + TypeScript · SQLite via better-sqlite3 · Zod · Tailwind
(installed, not CDN) · Vitest.

No other dependencies without asking me first. On Windows, prefer setups that
do not need me to install a native C++ toolchain; if a native module needs a
rebuild for Electron, handle it in the project scripts, not by asking me to
configure compilers.

## Architecture — not negotiable

- One shell, one shared Study core, six **declarative** modules.
- Each module is a schema file: sections, fields (label, type, unit, allowed
  values, default, normal range, `extractable`), derived values with
  formulas, classification rule references, sentence templates.
- One generic form renderer for all modules. One report generator for all
  modules. One extraction gateway, behind a provider interface.
- Adding a module = writing a schema file. If you are writing
  module-specific UI code, stop and rethink the abstraction.
- Conditional field visibility, "Alles normal" per section, and left↔right
  mirroring for bilateral modules are generic renderer features.

## Data entry

Keyboard-first, full tab order, no mouse needed. Decimal comma and point both
accepted. "Alles normal" fills a section with normal defaults in one
keystroke. Out-of-range values highlighted, never blocked. Derived values
live, inputs shown on hover. Continuous autosave.

## Report output

Fluent German from sentence templates, editable before export. One click
each: clipboard (primary — pasted into the hospital system), DOCX, PDF.
Footer names the rule sets and versions used.

## Design

Dense, calm, professional — a tool used many times a day by one expert.
Information density over whitespace. Restrained palette, consistent type,
clear hierarchy between section / field / derived value. Nothing playful.

## Working method

- Work in milestones as defined in `PLAN.md`. **Stop at the end of each
  milestone** and wait for my clinical testing.
- Small commits, clear messages. Never commit secrets, `.env`, or any real
  document.
- Every derived-value formula has a test and a code comment citing its
  source formula. Every classification band set has a test.
- Clinical content — formulas, cut-offs, normal ranges, German wording — is
  mine to decide. Where the spec is unclear or seems clinically wrong, **ask;
  do not invent or silently "fix" it.**
- Before relying on any external API behaviour (Mistral OCR response format,
  bounding boxes, limits), check its current documentation and tell me what
  you found.
- When I report a mistake you have made twice, propose an addition to this
  file.
