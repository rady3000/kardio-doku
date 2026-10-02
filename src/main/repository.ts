// Patient record and Study core persistence (SPEC-shared §2, §3, §7).
import type { Db } from './database';
import type { ModuleKey } from '../shared/modules';
import type {
  Patient,
  PatientInput,
  Study,
  StudyCreate,
  StudyUpdate,
} from '../shared/types';

interface PatientRow {
  id: number;
  last_name: string;
  first_name: string;
  birth_date: string | null;
  sex: 'weiblich' | 'männlich' | null;
  case_id: string;
  created_at: string;
  updated_at: string;
}

interface StudyRow {
  id: number;
  patient_id: number;
  module_key: string;
  study_date: string;
  data_json: string;
  created_at: string;
  updated_at: string;
}

const toPatient = (r: PatientRow): Patient => ({
  id: r.id,
  lastName: r.last_name,
  firstName: r.first_name,
  birthDate: r.birth_date,
  sex: r.sex,
  caseId: r.case_id,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toStudy = (r: StudyRow): Study => ({
  id: r.id,
  patientId: r.patient_id,
  moduleKey: r.module_key as ModuleKey,
  studyDate: r.study_date,
  data: JSON.parse(r.data_json) as Record<string, unknown>,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export class Repository {
  constructor(
    private readonly db: Db,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  listPatients(query: string): Patient[] {
    const q = query.trim().toLowerCase();
    const rows = this.db
      .prepare('SELECT * FROM patients ORDER BY last_name COLLATE NOCASE, first_name COLLATE NOCASE, id')
      .all() as PatientRow[];
    const patients = rows.map(toPatient);
    if (!q) return patients;
    // Filtered in JS: SQLite's LIKE is case-insensitive for ASCII only (Müller, Özdemir).
    return patients.filter((p) =>
      `${p.lastName} ${p.firstName} ${p.caseId} ${p.birthDate ?? ''}`.toLowerCase().includes(q),
    );
  }

  getPatient(id: number): Patient | null {
    const row = this.db.prepare('SELECT * FROM patients WHERE id = ?').get(id) as PatientRow | undefined;
    return row ? toPatient(row) : null;
  }

  createPatient(): Patient {
    const ts = this.now();
    const { lastInsertRowid } = this.db
      .prepare('INSERT INTO patients (created_at, updated_at) VALUES (?, ?)')
      .run(ts, ts);
    return this.getPatient(Number(lastInsertRowid))!;
  }

  updatePatient(id: number, input: PatientInput): Patient {
    const result = this.db
      .prepare(
        `UPDATE patients SET last_name = ?, first_name = ?, birth_date = ?, sex = ?, case_id = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(input.lastName, input.firstName, input.birthDate, input.sex, input.caseId, this.now(), id);
    if (result.changes !== 1) throw new Error(`Patient ${id} not found.`);
    return this.getPatient(id)!;
  }

  listStudies(patientId: number): Study[] {
    const rows = this.db
      .prepare('SELECT * FROM studies WHERE patient_id = ? ORDER BY study_date DESC, id DESC')
      .all(patientId) as StudyRow[];
    return rows.map(toStudy);
  }

  getStudy(id: number): Study | null {
    const row = this.db.prepare('SELECT * FROM studies WHERE id = ?').get(id) as StudyRow | undefined;
    return row ? toStudy(row) : null;
  }

  createStudy(input: StudyCreate): Study {
    const ts = this.now();
    const { lastInsertRowid } = this.db
      .prepare(
        'INSERT INTO studies (patient_id, module_key, study_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run(input.patientId, input.moduleKey, input.studyDate, ts, ts);
    return this.getStudy(Number(lastInsertRowid))!;
  }

  updateStudy(id: number, update: StudyUpdate): Study {
    const existing = this.getStudy(id);
    if (!existing) throw new Error(`Study ${id} not found.`);
    this.db
      .prepare('UPDATE studies SET study_date = ?, data_json = ?, updated_at = ? WHERE id = ?')
      .run(
        update.studyDate ?? existing.studyDate,
        JSON.stringify(update.data ?? existing.data),
        this.now(),
        id,
      );
    return this.getStudy(id)!;
  }
}
