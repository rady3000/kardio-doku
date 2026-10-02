// Betriebsmodus (SPEC-extraction-gateway §2). Each mode has its own SQLite
// file; there is no import path between them.

export const MODES = ['TESTBETRIEB', 'ECHTBETRIEB'] as const;
export type Betriebsmodus = (typeof MODES)[number];

/** Default on first run, and the fallback whenever the stored mode is unreadable. */
export const DEFAULT_MODE: Betriebsmodus = 'TESTBETRIEB';

/** Undisableable marker for every export in TESTBETRIEB (gateway §2.4). */
export const TESTDATEN_MARKER = 'TESTDATEN – NICHT FÜR DIE PATIENTENDOKUMENTATION';

export function isMode(value: unknown): value is Betriebsmodus {
  return typeof value === 'string' && (MODES as readonly string[]).includes(value);
}

export function dbFileName(mode: Betriebsmodus): string {
  return mode === 'TESTBETRIEB' ? 'test.db' : 'live.db';
}
