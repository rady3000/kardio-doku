// One SQLite file per Betriebsmodus (gateway §2.3): test.db and live.db.
// Each file is stamped with its mode at creation. Opening a file under the
// other mode fails, so a renamed or copied file cannot bring test data into
// ECHTBETRIEB or the reverse.
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { dbFileName, type Betriebsmodus } from '../shared/mode';

export type Db = Database.Database;

export class ModeMismatchError extends Error {
  constructor(expected: Betriebsmodus, found: string) {
    super(`Database belongs to ${found}, expected ${expected}.`);
    this.name = 'ModeMismatchError';
  }
}

/** Schema migrations, applied in order. Never edit a released entry; append a new one. */
const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE patients (
    id          INTEGER PRIMARY KEY,
    last_name   TEXT NOT NULL DEFAULT '',
    first_name  TEXT NOT NULL DEFAULT '',
    birth_date  TEXT,
    sex         TEXT CHECK (sex IN ('weiblich', 'männlich')),
    case_id     TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );
  CREATE TABLE studies (
    id          INTEGER PRIMARY KEY,
    patient_id  INTEGER NOT NULL REFERENCES patients(id),
    module_key  TEXT NOT NULL,
    study_date  TEXT NOT NULL,
    data_json   TEXT NOT NULL DEFAULT '{}',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );
  CREATE INDEX studies_patient ON studies(patient_id);
  `,
];

export function databasePath(dataDir: string, mode: Betriebsmodus): string {
  return path.join(dataDir, dbFileName(mode));
}

export function openDatabase(dataDir: string, mode: Betriebsmodus): Db {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(databasePath(dataDir, mode));
  try {
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');

    const stamp = db.prepare("SELECT value FROM meta WHERE key = 'mode'").get() as
      | { value: string }
      | undefined;
    if (stamp && stamp.value !== mode) throw new ModeMismatchError(mode, stamp.value);
    if (!stamp) db.prepare("INSERT INTO meta (key, value) VALUES ('mode', ?)").run(mode);

    migrate(db);
    return db;
  } catch (err) {
    db.close();
    throw err;
  }
}

function migrate(db: Db): void {
  const current = db.pragma('user_version', { simple: true }) as number;
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]!);
      db.pragma(`user_version = ${v + 1}`);
    })();
  }
}
