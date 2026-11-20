// Source documents and the extraction audit record (gateway §2.3, §4.4).
// Documents live in the same mode-partitioned database file as the study.
import type { Db } from './database';
import type { DocumentInfo } from '../shared/types';

export const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024; // Mistral OCR limit (D-76)
export const DOCUMENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
};

interface DocRow {
  id: number;
  study_id: number;
  file_name: string;
  mime: string;
  data: Buffer;
  anonymized_at: string | null;
  created_at: string;
}

export interface AuditEntry {
  studyId: number;
  documentId: number;
  mode: string;
  provider: string;
  model: string;
  fieldKey: string;
  rawText: string | null;
  valueExtracted: string | null;
  unit: string | null;
  confidence: number | null;
  page: number | null;
  bbox: [number, number, number, number] | null;
  status: 'accepted' | 'rejected';
  reason: string | null;
}

const toInfo = (r: Omit<DocRow, 'data'>): DocumentInfo => ({
  id: r.id,
  studyId: r.study_id,
  fileName: r.file_name,
  mime: r.mime,
  anonymizedAt: r.anonymized_at,
  createdAt: r.created_at,
});

export class DocumentStore {
  constructor(
    private readonly db: Db,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  add(studyId: number, fileName: string, mime: string, data: Buffer): DocumentInfo {
    if (data.length > MAX_DOCUMENT_BYTES) throw new Error('Dokument größer als 50 MB.');
    const { lastInsertRowid } = this.db
      .prepare('INSERT INTO documents (study_id, file_name, mime, data, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(studyId, fileName, mime, data, this.now());
    return this.info(Number(lastInsertRowid))!;
  }

  list(studyId: number): DocumentInfo[] {
    const rows = this.db
      .prepare('SELECT id, study_id, file_name, mime, anonymized_at, created_at FROM documents WHERE study_id = ? ORDER BY id')
      .all(studyId) as Omit<DocRow, 'data'>[];
    return rows.map(toInfo);
  }

  info(id: number): DocumentInfo | null {
    const r = this.db
      .prepare('SELECT id, study_id, file_name, mime, anonymized_at, created_at FROM documents WHERE id = ?')
      .get(id) as Omit<DocRow, 'data'> | undefined;
    return r ? toInfo(r) : null;
  }

  data(id: number): { info: DocumentInfo; bytes: Uint8Array } | null {
    const r = this.db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as DocRow | undefined;
    return r ? { info: toInfo(r), bytes: new Uint8Array(r.data) } : null;
  }

  /** Per-document confirmation that the document is anonymized (gateway §2.6.2). */
  confirmAnonymized(id: number): DocumentInfo {
    this.db.prepare('UPDATE documents SET anonymized_at = ? WHERE id = ?').run(this.now(), id);
    return this.info(id)!;
  }

  audit(e: AuditEntry): number {
    const { lastInsertRowid } = this.db
      .prepare(
        `INSERT INTO extractions (study_id, document_id, mode, provider, model, field_key, raw_text, value_extracted, unit,
          confidence, page, bbox, status, reason, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        e.studyId, e.documentId, e.mode, e.provider, e.model, e.fieldKey, e.rawText, e.valueExtracted, e.unit,
        e.confidence, e.page, e.bbox ? JSON.stringify(e.bbox) : null, e.status, e.reason, this.now(),
      );
    return Number(lastInsertRowid);
  }

  /** Records the physician's final value; was_corrected is the trial's primary endpoint (gateway §4.4). */
  confirm(extractionId: number, valueConfirmed: string, corrected: boolean): void {
    this.db
      .prepare('UPDATE extractions SET value_confirmed = ?, was_corrected = ?, confirmed_at = ? WHERE id = ?')
      .run(valueConfirmed, corrected ? 1 : 0, this.now(), extractionId);
  }

  documentsProcessed(): number {
    const r = this.db
      .prepare("SELECT COUNT(DISTINCT document_id) AS docs FROM extractions WHERE provider != 'mock'")
      .get() as { docs: number };
    return r.docs;
  }
}
