// Extraction service against the database: values enter unconfirmed with
// provenance, the audit record is written, entered values are never
// overwritten, and the export stays blocked until confirmation (§4.1–4.4).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildStudyReport } from '../../src/core/studyReport';
import { parseStudyData } from '../../src/core/studyData';
import { mockProvider } from '../../src/gateway/providers/mock';
import { openDatabase } from '../../src/main/database';
import { DocumentStore } from '../../src/main/documents';
import { runExtraction } from '../../src/main/extraction';
import { Repository } from '../../src/main/repository';

const fixture = path.resolve(__dirname, '../fixtures/ocr/tte-text-synthetic.json');
let repo: Repository;
let docs: DocumentStore;
let db: ReturnType<typeof openDatabase>;

beforeEach(() => {
  process.env.KARDIO_E2E_MOCK_OCR = fixture;
  db = openDatabase(fs.mkdtempSync(path.join(os.tmpdir(), 'kardio-ext-')), 'TESTBETRIEB');
  repo = new Repository(db);
  docs = new DocumentStore(db);
});

function setup(values: Record<string, unknown> = {}) {
  const p = repo.createPatient();
  repo.updatePatient(p.id, { lastName: 'T', firstName: 'X', birthDate: null, sex: 'männlich', caseId: '' });
  const s = repo.createStudy({ patientId: p.id, moduleKey: 'tte', studyDate: '2026-11-20' });
  repo.updateStudy(s.id, { data: { values } });
  const d = docs.add(s.id, 'befund.pdf', 'application/pdf', Buffer.from('%PDF-1.4 synthetic'));
  return { study: s, doc: d };
}

const run = (studyId: number, documentId: number) =>
  runExtraction({ repo, docs, provider: mockProvider, mode: 'TESTBETRIEB', threshold: 0.85, studyId, documentId });

describe('extraction service', () => {
  it('requires the per-document anonymization confirmation (gateway §2.6.2)', async () => {
    const { study, doc } = setup();
    const r = await run(study.id, doc.id);
    expect(r.ok).toBe(false);
    expect(parseStudyData(repo.getStudy(study.id)!.data).values).toEqual({});
  });

  it('values enter unconfirmed with provenance; audit rows are written', async () => {
    const { study, doc } = setup();
    docs.confirmAnonymized(doc.id);
    const r = await run(study.id, doc.id);
    expect(r.ok).toBe(true);
    const data = parseStudyData(repo.getStudy(study.id)!.data);
    expect(data.values.lvef).toBe(57);
    expect(data.unconfirmed).toContain('lvef');
    expect(data.provenance.lvef).toMatchObject({ documentId: doc.id, page: 0, rawText: 'LVEF_BiP_Q: 57 %' });
    const rows = db.prepare('SELECT field_key, status, model FROM extractions WHERE study_id = ?').all(study.id) as { field_key: string; status: string; model: string }[];
    expect(rows.find((x) => x.field_key === 'lvef')).toMatchObject({ status: 'accepted', model: 'mistral-ocr-4-1' });
  });

  it('export is blocked until the values are confirmed (test §7.5)', async () => {
    const { study, doc } = setup();
    docs.confirmAnonymized(doc.id);
    await run(study.id, doc.id);
    const s = repo.getStudy(study.id)!;
    expect(buildStudyReport(s, { sex: 'männlich' })!.blockers).toContain('LVEF');
    const data = parseStudyData(s.data);
    data.unconfirmed = [];
    expect(buildStudyReport({ ...s, data }, { sex: 'männlich' })!.blockers).toEqual([]);
  });

  it('never overwrites an entered value', async () => {
    const { study, doc } = setup({ lvef: 45 });
    docs.confirmAnonymized(doc.id);
    const r = await run(study.id, doc.id);
    expect(r.skipped).toContain('LVEF');
    const data = parseStudyData(repo.getStudy(study.id)!.data);
    expect(data.values.lvef).toBe(45);
    expect(data.unconfirmed).not.toContain('lvef');
  });

  it('records the physician confirmation and corrections', async () => {
    const { study, doc } = setup();
    docs.confirmAnonymized(doc.id);
    await run(study.id, doc.id);
    const id = parseStudyData(repo.getStudy(study.id)!.data).provenance.lvef!.extractionId;
    docs.confirm(id, '55', true);
    expect(db.prepare('SELECT value_confirmed, was_corrected FROM extractions WHERE id = ?').get(id)).toEqual({ value_confirmed: '55', was_corrected: 1 });
  });
});
