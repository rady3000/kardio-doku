// Gateway test §7.2 — database isolation between the two modes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ModeMismatchError, databasePath, openDatabase } from '../../src/main/database';
import { Repository } from '../../src/main/repository';

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kardio-db-'));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('database per Betriebsmodus', () => {
  it('uses test.db and live.db', () => {
    expect(path.basename(databasePath(dir, 'TESTBETRIEB'))).toBe('test.db');
    expect(path.basename(databasePath(dir, 'ECHTBETRIEB'))).toBe('live.db');
  });

  it('keeps patients and studies of one mode out of the other', () => {
    const test = openDatabase(dir, 'TESTBETRIEB');
    const repo = new Repository(test);
    const p = repo.createPatient();
    repo.updatePatient(p.id, { lastName: 'Test', firstName: 'Anna', birthDate: '1950-01-01', sex: 'weiblich', caseId: '' });
    repo.createStudy({ patientId: p.id, moduleKey: 'tte', studyDate: '2026-10-02' });
    test.close();

    const live = openDatabase(dir, 'ECHTBETRIEB');
    const liveRepo = new Repository(live);
    expect(liveRepo.listPatients('')).toEqual([]);
    expect(liveRepo.getPatient(p.id)).toBeNull();
    live.close();

    const reopened = new Repository(openDatabase(dir, 'TESTBETRIEB'));
    expect(reopened.listPatients('').map((x) => x.lastName)).toEqual(['Test']);
  });

  it('refuses a test database opened as live database (renamed file)', () => {
    openDatabase(dir, 'TESTBETRIEB').close();
    fs.renameSync(path.join(dir, 'test.db'), path.join(dir, 'live.db'));
    for (const suffix of ['-wal', '-shm']) {
      if (fs.existsSync(path.join(dir, `test.db${suffix}`))) {
        fs.renameSync(path.join(dir, `test.db${suffix}`), path.join(dir, `live.db${suffix}`));
      }
    }
    expect(() => openDatabase(dir, 'ECHTBETRIEB')).toThrow(ModeMismatchError);
  });

  it('migrates idempotently', () => {
    openDatabase(dir, 'TESTBETRIEB').close();
    const db = openDatabase(dir, 'TESTBETRIEB');
    expect(db.pragma('user_version', { simple: true })).toBe(1);
    db.close();
  });
});
