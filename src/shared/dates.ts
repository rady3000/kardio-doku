// Date entry in German notation. Stored as ISO (YYYY-MM-DD), shown as DD.MM.YYYY.
// Two-digit years are rejected: for birth dates they are ambiguous.

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

function toIso(day: number, month: number, year: number): string | null {
  if (year < MIN_YEAR || year > MAX_YEAR || month < 1 || month > 12 || day < 1) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Accepts "1.2.1950", "01.02.1950", "01021950" and "1950-02-01". Returns ISO or null. */
export function parseGermanDate(input: string): string | null {
  const s = input.trim();
  let m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s);
  if (m) return toIso(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{2})(\d{2})(\d{4})$/.exec(s);
  if (m) return toIso(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return toIso(Number(m[3]), Number(m[2]), Number(m[1]));
  return null;
}

export function formatGermanDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
}

/** Today's date as ISO in local time. */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${mo}-${d}`;
}
