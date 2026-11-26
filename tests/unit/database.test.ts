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

    const testAgain = openDatabase(dir, 'TESTBETRIEB');
    expect(new Repository(testAgain).listPatients('').map((x) => x.lastName)).toEqual(['Test']);
    testAgain.close(); // Windows cannot delete an open database file
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
    expect(db.pragma('user_version', { simple: true })).toBe(4);
    db.close();
  });

  it('migration 3 renames old device types (D-84) and leaves other studies alone', () => {
    let db = openDatabase(dir, 'TESTBETRIEB');
    const now = '2026-11-26T00:00:00Z';
    db.prepare("INSERT INTO patients (id, created_at, updated_at) VALUES (1, ?, ?)").run(now, now);
    const add = db.prepare('INSERT INTO studies (patient_id, module_key, study_date, data_json, created_at, updated_at) VALUES (1, ?, ?, ?, ?, ?)');
    add.run('device', '2026-11-26', JSON.stringify({ values: { device_type: 'DDD-SM', pacing_mode: 'DDDR' } }), now, now);
    add.run('device', '2026-11-26', JSON.stringify({ values: { device_type: 'CRT-D' } }), now, now);
    add.run('tte', '2026-11-26', JSON.stringify({ values: { device_type: 'DDD-SM' } }), now, now);
    db.pragma('user_version = 2');
    db.close();
    db = openDatabase(dir, 'TESTBETRIEB');
    const types = db.prepare("SELECT module_key, json_extract(data_json, '$.values.device_type') AS t FROM studies ORDER BY id").all();
    expect(types).toEqual([
      { module_key: 'device', t: '2-Kammer-Schrittmacher' },
      { module_key: 'device', t: '3-Kammer-ICD' },
      { module_key: 'tte', t: 'DDD-SM' },
    ]);
    db.close();
  });

  it('migration 4 updates the patient-condition wording (D-84)', () => {
    let db = openDatabase(dir, 'TESTBETRIEB');
    const now = '2026-11-26T00:00:00Z';
    db.prepare("INSERT INTO patients (id, created_at, updated_at) VALUES (1, ?, ?)").run(now, now);
    const add = db.prepare('INSERT INTO studies (patient_id, module_key, study_date, data_json, created_at, updated_at) VALUES (1, ?, ?, ?, ?, ?)');
    add.run('device', '2026-11-26', JSON.stringify({ values: { patient_condition: 'ist in gutem Allgemeinzustand und beschwerdefrei' } }), now, now);
    add.run('device', '2026-11-26', JSON.stringify({ values: { patient_condition: 'berichtet über Schwindel' } }), now, now);
    db.pragma('user_version = 3');
    db.close();
    db = openDatabase(dir, 'TESTBETRIEB');
    const rows = db.prepare("SELECT json_extract(data_json, '$.values.patient_condition') AS c FROM studies ORDER BY id").all();
    expect(rows).toEqual([{ c: 'in gutem Allgemeinzustand und kardial beschwerdefrei' }, { c: 'berichtet über Schwindel' }]);
    db.close();
  });
});
