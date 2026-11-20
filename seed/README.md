# Seed documents (gateway §2.5)

Synthetic, fictitious source documents with known-correct values. They serve
as the usability seed and as the extraction accuracy test set.

- `<name>.pdf` (or `.png` / `.jpg`) — the document. **No real patient data.**
- `<name>.expected.json` — `{ "module": "tte", "values": { "<field>": <value in the field's unit> } }`
- `<name>.html` — source of the synthetic PDFs made in this repository.

Anonymized real documents never go here: put them in `samples-real/` (git-ignored)
with the same file layout. The harness reads both folders.
