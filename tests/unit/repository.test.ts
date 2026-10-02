import { beforeEach, describe, expect, it } from 'vitest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { openDatabase } from '../../src/main/database';
import { Repository } from '../../src/main/repository';

let repo: Repository;
beforeEach(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kardio-repo-'));
  let tick = 0;
  repo = new Repository(openDatabase(dir, 'TESTBETRIEB'), () => `2026-10-02T08:00:${String(tick++).padStart(2, '0')}.000Z`);
});

const input = (lastName: string, firstName = 'X') => ({
  lastName,
  firstName,
  birthDate: null,
  sex: null,
  caseId: '',
});

describe('patient record', () => {
  it('creates an empty patient without a sex default (D-40)', () => {
    const p = repo.createPatient();
    expect(p).toMatchObject({ lastName: '', firstName: '', birthDate: null, sex: null, caseId: '' });
  });

  it('updates and lists patients sorted by name', () => {
    for (const name of ['Weber', 'Albrecht', 'müller']) repo.updatePatient(repo.createPatient().id, input(name));
    expect(repo.listPatients('').map((p) => p.lastName)).toEqual(['Albrecht', 'müller', 'Weber']);
  });

  it('searches case-insensitively including umlauts', () => {
    repo.updatePatient(repo.createPatient().id, input('Müller', 'Özlem'));
    repo.updatePatient(repo.createPatient().id, input('Schmidt'));
    expect(repo.listPatients('MÜLL').map((p) => p.lastName)).toEqual(['Müller']);
    expect(repo.listPatients('özlem').map((p) => p.lastName)).toEqual(['Müller']);
  });

  it('rejects an update of a missing patient', () => {
    expect(() => repo.updatePatient(999, input('X'))).toThrow(/not found/);
  });
});

describe('studies', () => {
  it('creates, lists (newest first) and updates studies', () => {
    const p = repo.createPatient();
    const a = repo.createStudy({ patientId: p.id, moduleKey: 'tte', studyDate: '2026-01-10' });
    const b = repo.createStudy({ patientId: p.id, moduleKey: 'device', studyDate: '2026-05-01' });
    expect(repo.listStudies(p.id).map((s) => s.id)).toEqual([b.id, a.id]);

    const updated = repo.updateStudy(a.id, { studyDate: '2026-06-01', data: { lvef: 55 } });
    expect(updated).toMatchObject({ studyDate: '2026-06-01', data: { lvef: 55 } });
    expect(updated.updatedAt > a.updatedAt).toBe(true);
  });

  it('refuses a study for a missing patient', () => {
    expect(() => repo.createStudy({ patientId: 42, moduleKey: 'tte', studyDate: '2026-01-10' })).toThrow();
  });
});
