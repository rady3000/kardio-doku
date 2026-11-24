// Extraction evaluation harness (gateway §5.4): per field accuracy, rejection
// and the SILENT-ERROR rate (accepted with high confidence, but wrong) over
// seed/ and samples-real/. Writes harness-report.md. Live provider calls.
import fs from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';
import { extractFromOcr } from '../../src/core/extraction/run';
import { mistralOcrProvider, setKeySource } from '../../src/gateway/providers/mistralOcr';
import { MODULE_SCHEMAS } from '../../src/modules';
import { readQualified } from '../../src/core/format';

const MIME: Record<string, string> = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
const THRESHOLD = Number(process.env.HARNESS_THRESHOLD ?? 0.85);

it('evaluates extraction on all seed and sample documents', async () => {
  // The key is read from MISTRAL_API_KEY; in a cloud session the network proxy injects it.
  setKeySource(() => process.env.MISTRAL_API_KEY ?? 'proxy-injected');
  const docs = ['seed', 'samples-real']
    .filter((d) => fs.existsSync(d))
    .flatMap((d) => fs.readdirSync(d).filter((f) => MIME[path.extname(f).toLowerCase()]).map((f) => path.join(d, f)))
    .filter((f) => fs.existsSync(f.replace(/\.[^.]+$/, '.expected.json')));

  const rows: string[] = [];
  const totals = { expected: 0, correct: 0, wrong: 0, rejected: 0, missing: 0, extra: 0, pages: 0 };
  for (const file of docs) {
    const expected = JSON.parse(fs.readFileSync(file.replace(/\.[^.]+$/, '.expected.json'), 'utf-8')) as {
      module: string;
      values: Record<string, number | string>;
    };
    const schema = MODULE_SCHEMAS.get(expected.module)!;
    const t0 = Date.now();
    const ocr = await mistralOcrProvider.ocr({ fileName: path.basename(file), mime: MIME[path.extname(file).toLowerCase()]!, bytes: fs.readFileSync(file) });
    const ms = Date.now() - t0;
    totals.pages += ocr.pagesProcessed;
    for (const { field, outcome } of extractFromOcr(schema, ocr, THRESHOLD)) {
      const want = expected.values[field.key];
      let result: string;
      if (want === undefined) {
        if (!outcome.ok) continue;
        result = 'EXTRA (accepted, not expected)';
        totals.extra++;
      } else {
        totals.expected++;
        if (outcome.ok) {
          // Qualified values ("<5.6", "5.6..8") are compared as stored; plain numbers by value.
          const got = typeof want === 'string' || typeof outcome.stored === 'number' ? outcome.stored : readQualified(outcome.stored)?.a;
          if (got === want) {
            result = 'correct';
            totals.correct++;
          } else {
            result = `**SILENT ERROR** got ${got}, expected ${want}`;
            totals.wrong++;
          }
        } else if (outcome.candidate) {
          result = `rejected: ${outcome.reason}`;
          totals.rejected++;
        } else {
          result = 'missing (label not found)';
          totals.missing++;
        }
      }
      const conf = outcome.candidate?.confidence;
      rows.push(`| ${file} | ${field.key} | ${result} | ${conf === undefined || conf === null ? '–' : conf.toFixed(3)} | ${ms} ms |`);
    }
  }
  const pct = (n: number) => (totals.expected ? ((100 * n) / totals.expected).toFixed(1) : '–');
  const report = [
    `# Extraction harness – ${new Date().toISOString().slice(0, 10)}`,
    '',
    `Provider mistral-ocr (EU), threshold ${THRESHOLD}, ${docs.length} documents, ${totals.pages} pages (≈ ${(totals.pages * 0.004).toFixed(3)} USD).`,
    '',
    `Expected values: ${totals.expected} · correct ${totals.correct} (${pct(totals.correct)} %) · **silent errors ${totals.wrong} (${pct(totals.wrong)} %)** · rejected ${totals.rejected} · not found ${totals.missing} · unexpected extra ${totals.extra}`,
    '',
    '| Document | Field | Result | Confidence | Time |',
    '|---|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');
  fs.writeFileSync('harness-report.md', report);
  console.log(report);
  expect(docs.length).toBeGreaterThan(0);
});
