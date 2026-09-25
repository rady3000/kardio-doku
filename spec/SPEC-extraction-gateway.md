# SPEC-extraction-gateway.md — Document Extraction and Deterministic Text Generation

Supersedes `SPEC-llm-gateway.md`.

**Corrected architecture.** The model does **extraction only**. It reads values
off a source document and writes them into form fields. All report text is
generated deterministically from those values by threshold rules declared in
the module schema. The model never writes clinical prose.

```
Source PDF  →  [OCR + schema extraction]  →  unconfirmed field values
                                                      ↓
                                          physician confirms against source
                                                      ↓
                            [deterministic classification rules in schema]
                                                      ↓
                                          preformatted German report text
```

**Consequences of this design, which are the reasons to keep it:**

- Report text is fully reproducible. Same input, same output, permanently. No
  model version, temperature or prompt change can alter a finished report.
- The model forms no clinical opinion. It transcribes.
- Every generated sentence traces to a threshold rule you wrote, in a file you
  can read.

---

## 1. Deployment plan

| Phase | Duration | Data | Extraction | Mode |
|---|---|---|---|---|
| Trial | ~6 months | synthetic or anonymized documents | Mistral OCR API | `TESTBETRIEB` |
| Production A | earlier than B | real documents | self-hosted Mistral OCR container | `ECHTBETRIEB` |
| Production B | later | real documents | + local model if two-stage extraction is adopted | `ECHTBETRIEB` |

Splitting production into two milestones matters for procurement: the OCR
container is far lighter than a large language model. OCR ingestion can go
live on modest hardware long before local text generation is affordable. Do
not bundle them into a single all-or-nothing hardware request.

---

## 2. Betriebsmodus

### 2.1 States

| Mode | Data | Database | Cloud extraction | Self-hosted extraction |
|---|---|---|---|---|
| `TESTBETRIEB` (default) | synthetic or anonymized | `test.db` | allowed | allowed |
| `ECHTBETRIEB` | real patient data | `live.db` | **blocked** | allowed |

Default on first run: `TESTBETRIEB`.

### 2.2 Why the whitelist no longer applies, and what replaces it

The earlier design sent selected structured fields, controlled by a per-field
`sendToLLM` whitelist. That control **does not transfer to document
ingestion**: a source PDF carries the patient name, date of birth and case
number in its header, and no schema-level property can remove them.

The replacement control is transport, not field selection:

- `TESTBETRIEB`: synthetic or anonymized documents only (§2.6). Cloud OCR
  permitted. No identifiable patient data exists in this mode.
- `ECHTBETRIEB`: **self-hosted OCR container only**. Documents never leave the
  institution. Cloud providers are unavailable and unselectable — greyed out
  with the reason shown.

Optional additional layer for `ECHTBETRIEB`: strip the document header region
before extraction. Treat as defence in depth, never as the primary control.

### 2.3 Enforcement

1. Separate SQLite files per mode. No import path between them.
2. Provider registry filters by `isLocal` in `ECHTBETRIEB`.
3. Switching to `ECHTBETRIEB` requires explicit confirmation naming the
   consequences.
4. Source PDFs are stored in the database alongside the study, in the same
   mode-partitioned file. Test documents never touch `live.db`.

### 2.4 Test marking

In `TESTBETRIEB`, every export carries, undisableable:

```
TESTDATEN – NICHT FÜR DIE PATIENTENDOKUMENTATION
```

Screen banner, PDF watermark on every page, DOCX header, and **the first line
of clipboard output**. The clipboard is the path that reaches the hospital
system; it is the one that must never be missed.

### 2.6 Importing anonymized real documents in `TESTBETRIEB`

Permitted, under these rules:

1. **Anonymization happens before import**, outside the app. The app does not
   anonymize and does not claim to.
2. Every import shows a page preview and requires an explicit per-document
   confirmation: *„Dokument ist anonymisiert (Kopfzeile, Name, Geburtsdatum,
   Fallnummer, Untersuchungsdatum, Geräte-Seriennummer entfernt)."*
   Not a remembered setting — every document.
3. **Optional header masking per document type.** Device programmer printouts
   and echo reports have stable layouts. A document type may declare fixed
   page regions (e.g. the top 12 % of page 1, the serial-number box) that are
   blanked to white in the image sent to the provider. Defence in depth — it
   does not replace step 1.
4. Device serial numbers and model numbers are **never** extractable fields.
   Serial numbers link to the patient through manufacturer registries and are
   identifiers, not device metadata.
5. A study created from an anonymized real document in `TESTBETRIEB` still
   carries the TESTDATEN marker on every export. It is never the patient's
   report of record.

### 2.5 Seed documents

Ship ~20 synthetic source documents — echo printouts and device programmer
reports — plus their known-correct extracted values. These serve as both the
usability seed and the extraction accuracy test set (§5.3). Loads only in
`TESTBETRIEB`.

---

## 3. Extraction

### 3.1 Interface

```ts
interface ExtractionProvider {
  id: string;                     // 'mistral-ocr' | 'mistral-ocr-selfhosted' | 'mock'
  displayName: string;
  isLocal: boolean;               // false blocks it in ECHTBETRIEB
  isConfigured(): boolean;
  extract(
    document: Uint8Array,
    schema: ExtractionSchema
  ): Promise<ExtractedField[]>;
}

interface ExtractedField {
  key: string;                    // matches a module schema field key
  value: string | number | null;
  confidence: number;             // 0..1
  page: number;
  boundingBox: [number, number, number, number];
  rawText: string;                // the literal text read
}
```

`page`, `boundingBox` and `rawText` are **mandatory**, not optional. Without
them the verification UI in §4 cannot exist, and without that UI the whole
design is unsafe.

**Implementation note — verify before building.** Mistral OCR returns bounding
boxes for text blocks, but schema-based extraction (document annotation) may
return field values *without* per-field coordinates. Check the current API
documentation first. If per-field coordinates are not returned, the adapter
derives them: locate the extracted `rawText` in the OCR block output and take
that block's page and bounding box. If the match is absent or ambiguous (the
value appears in more than one block), the field is **discarded and left
empty** — never displayed without a source. Unit-test the matcher against the
seed documents, including deliberately ambiguous cases.

### 3.2 Providers to ship

| Provider | Purpose |
|---|---|
| `MockProvider` | canned extractions for the test suite; `isLocal: true` |
| `MistralOcrProvider` | trial use, hosted API; `isLocal: false` |
| `MistralOcrSelfHostedProvider` | stubbed in v1, target for `ECHTBETRIEB`; `isLocal: true` |

### 3.3 One-stage vs two-stage — evaluate, do not assume

| | Pipeline | Notes |
|---|---|---|
| One-stage | document → OCR with extraction schema → fields | Single call. Strong on structured printouts with labelled fields. |
| Two-stage | document → OCR to markdown → small model extracts to schema | More robust on narrative German text. Stage two is an easy task a modest local model handles, shortening the path to full local operation. |

Build the interface so either satisfies it. Evaluate both against the §2.5
seed documents using the §5.3 harness before committing.

### 3.4 Extraction schema

Derived from the module schema. Each field may declare:

```ts
extractable: boolean              // default false
extractionHints: string[]         // e.g. ['LVEF', 'EF', 'Ejektionsfraktion']
expectedUnit: string
plausibleRange: [number, number]  // hard sanity bound, see §4.3
```

Only `extractable: true` fields are requested. Free-text fields are never
extractable.

---

## 4. Verification — the critical control

**The failure mode this exists to prevent:** if LVEF is misread as 55 when the
document says 35, the classification rules confidently generate
`LV-Funktion ist normal.` The output contains no hedge and no visible defect.
It reads exactly like a correct report.

Deterministic generation amplifies extraction errors instead of softening
them. Verification is therefore not a nicety; it is what makes the
architecture safe.

### 4.1 Unconfirmed state

- Every extracted value enters its field as **unconfirmed**, visually distinct
  (e.g. amber background, dashed border).
- Clicking an unconfirmed value opens the source document at the recorded page
  with the bounding box highlighted.
- Confirmation is per-field, plus a **Alle bestätigen** action that still
  requires the source panel to have been opened at least once.
- Manually editing an extracted value confirms it implicitly.

### 4.2 Export block

A report cannot be exported while any unconfirmed value feeds a
classification rule or appears in generated text. Hard block, both modes, no
override setting.

### 4.3 Automatic rejection

An extracted value is discarded and the field left empty, marked
`Extraktion fehlgeschlagen`, when:

- confidence is below a configurable threshold (start at 0.85), or
- the value falls outside `plausibleRange`, or
- the unit does not match `expectedUnit`.

An empty field is safe. A wrong field is not. Fail toward empty.

### 4.4 Audit record

`extractions` table, per field per document:

| Column | Content |
|---|---|
| `study_id` | FK |
| `mode` | `TESTBETRIEB` / `ECHTBETRIEB` |
| `provider`, `model` | exact strings |
| `field_key` | |
| `raw_text` | literal text read |
| `value_extracted` | parsed value |
| `confidence`, `page`, `bbox` | provenance |
| `value_confirmed` | value after physician review |
| `was_corrected` | boolean |
| `timestamp` | |

`was_corrected` is the number that matters. Correction rate per field is the
extraction accuracy metric, the trial's primary endpoint, and the evidence for
both the hardware business case and the MDR Article 5(5) review of experience.

---

## 5. Deterministic classification and text generation

### 5.1 Rules live in the module schema

```ts
interface ClassificationRule {
  field: string;                  // 'lvef'
  source: string;                 // 'ASE/EACVI 2015' — guideline named, required
  reviewedOn: string;             // YYYY-MM-DD
  bands: Array<{
    min?: number;
    max?: number;
    label: string;                // 'normal'
    text: string;                 // 'LV-Funktion ist normal.'
  }>;
}
```

Worked example:

```json
{
  "field": "lvef",
  "source": "<guideline and version — to be entered>",
  "reviewedOn": "<date>",
  "bands": [
    { "min": 55,            "label": "normal",                "text": "LV-Funktion ist normal." },
    { "min": 45, "max": 54, "label": "leichtgradig reduziert", "text": "LV-Funktion ist leichtgradig reduziert." },
    { "min": 30, "max": 44, "label": "mittelgradig reduziert", "text": "LV-Funktion ist mittelgradig reduziert." },
    { "max": 29,            "label": "hochgradig reduziert",   "text": "LV-Funktion ist hochgradig reduziert." }
  ]
}
```

**Band boundaries and wording above are placeholders taken from the example
you gave. Enter your own cut-offs and phrasing, and name the guideline in
`source`.** These are yours to own, not mine to assert.

### 5.2 Rules that must be enforced

1. Rule sets live in editable data files under `reference/`, never hardcoded.
2. `source` and `reviewedOn` are mandatory. The validator rejects a rule set
   without them, and rejects an edit that does not update `reviewedOn`.
3. Bands must be contiguous and non-overlapping across the plausible range.
   Gaps and overlaps fail validation — a gap silently produces no sentence.
4. Every generated sentence remains editable. The physician's edit is stored
   with the study and always wins.
5. The report footer names the rule sets and versions used.
6. Classification runs only on **confirmed** values.

### 5.3 Where to auto-classify, and where not

**Auto-classify** where a guideline defines a mapping from a single value:
LVEF category, chamber dimension vs reference range, gradient category.

**Do not auto-classify** where the grade requires integrating several
findings. Carotid stenosis grading is the clear case — PSV, EDV, ratio, plaque
morphology and poststenotic flow together. `SPEC-carotis.md` keeps
`aci_stenosegrad` physician-assigned with the criteria table displayed
alongside. Leave it that way.

The line: a single value with a named guideline mapping may be classified. A
judgement integrating multiple findings may not.

### 5.4 Extraction evaluation harness

Against the §2.5 seed documents with known-correct values, per provider and
per pipeline:

- per-field accuracy and correction rate
- confidence calibration — do low scores actually predict errors
- **silent-error rate: extracted, high confidence, wrong.** This is the number
  that matters. A loud failure is an inconvenience; a confident wrong LVEF is
  a wrong report.
- cost per document, latency per document

Run one-stage and two-stage through the same harness. Decide from the numbers.

---

## 6. Configuration

| Setting | Storage | Notes |
|---|---|---|
| API key | Electron `safeStorage` (Windows DPAPI) | never in a file or the repo |
| Provider | app settings | default: none |
| Confidence threshold | app settings | default 0.85 |
| Per-document page counter | SQLite | OCR bills per page; show running cost |

The app must run with no provider configured. Manual entry is always
available and is the baseline path; extraction only ever pre-fills.

---

## 7. Required tests

1. **Mode gating:** in `ECHTBETRIEB`, cloud providers are not returned by the
   registry and cannot be invoked. Write this first.
2. **Database isolation:** studies and source documents do not cross modes.
3. **Test marking:** present in every export path, clipboard first line
   included.
4. **Egress isolation:** any network call outside the gateway fails the suite.
5. **Unconfirmed block:** export is refused while any classification-feeding
   value is unconfirmed.
6. **Provenance required:** an extraction result missing page or bounding box
   is rejected, not displayed.
7. **Plausibility rejection:** out-of-range and wrong-unit values are
   discarded, leaving the field empty.
8. **Band validation:** overlapping or non-contiguous bands fail schema
   validation.
9. **Determinism:** the same confirmed values produce byte-identical report
   text across runs and across app versions. Golden-file test.
10. **Offline and no-provider paths:** full manual entry and export both work.
11. **Provider swap:** mock and Mistral OCR are interchangeable with no
    changes outside their adapters.

Tests 5, 6 and 9 are the ones carrying the safety argument.

---

## 8. Before `ECHTBETRIEB`

Not needed for the synthetic trial. Needed before the first real document.

- Self-hosted OCR container deployed and validated on institutional hardware.
- Extraction accuracy and silent-error rate from the trial reviewed and judged
  acceptable, per field.
- All classification rule sets reviewed, `source` and `reviewedOn` populated.
- Datenschutzbeauftragter sign-off. The transport control (§2.2) is the
  supporting artefact — documents do not leave the institution.
- Medizinprodukte-Beauftragter conversation on MDR Article 5(5) in-house
  manufacture. The §4.4 correction-rate data is the review-of-experience
  evidence, and the deterministic, auditable text generation is a materially
  easier case to make than model-written prose would have been.

During the trial none of this applies: synthetic or anonymized documents,
never the report of record, no medical device.
