// Number entry and output in German notation. Output must be byte-identical
// across runs and app versions, so no Intl/locale APIs are used here.

/** Parses "12,5", "12.5", " 12 ". Returns null for anything else (incl. thousands separators). */
export function parseDecimal(input: string): number | null {
  const s = input.trim().replace(',', '.');
  if (!/^[-+]?(\d+(\.\d*)?|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Formats with at most `decimals` places, trailing zeros removed, decimal comma. */
export function formatDecimal(value: number, decimals: number): string {
  const fixed = value.toFixed(decimals);
  const trimmed = fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed;
  return (trimmed === '-0' ? '0' : trimmed).replace('.', ',');
}

/**
 * A measurement with an optional qualifier (D-72 b): "> 2,8", "< 200",
 * "5,6–22,4" (also "5,6 - 22,4", "5,6 bis 22,4", "5.6 to 22.4").
 * Stored canonically as ">2.8", "<200", "5.6..22.4" or a plain number.
 * The value used for range checks is the number after ">" / "<" or the lower
 * end of a range.
 */
export interface Qualified {
  q: '>' | '<' | 'range' | null;
  a: number;
  b?: number;
}

const NUM = String.raw`(\d+(?:[.,]\d*)?|[.,]\d+)`;

export function parseQualified(input: string): Qualified | null {
  const s = input.trim();
  let m = new RegExp(String.raw`^([<>])\s*${NUM}$`).exec(s);
  if (m) return { q: m[1] as '<' | '>', a: parseDecimal(m[2]!)! };
  m = new RegExp(String.raw`^${NUM}\s*(?:-|–|bis|to)\s*${NUM}$`, 'i').exec(s);
  if (m) {
    const a = parseDecimal(m[1]!)!;
    const b = parseDecimal(m[2]!)!;
    return a <= b ? { q: 'range', a, b } : null;
  }
  const n = parseDecimal(s);
  return n === null || n < 0 ? null : { q: null, a: n };
}

/** Canonical stored form: a number, or a string such as ">2.8" / "5.6..22.4". */
export function storeQualified(v: Qualified): number | string {
  if (v.q === null) return v.a;
  return v.q === 'range' ? `${v.a}..${v.b}` : `${v.q}${v.a}`;
}

export function readQualified(stored: unknown): Qualified | null {
  if (typeof stored === 'number') return Number.isFinite(stored) && stored >= 0 ? { q: null, a: stored } : null;
  if (typeof stored !== 'string') return null;
  let m = /^([<>])(\d+(?:\.\d+)?)$/.exec(stored);
  if (m) return { q: m[1] as '<' | '>', a: Number(m[2]) };
  m = /^(\d+(?:\.\d+)?)\.\.(\d+(?:\.\d+)?)$/.exec(stored);
  if (m && Number(m[1]) <= Number(m[2])) return { q: 'range', a: Number(m[1]), b: Number(m[2]) };
  return null;
}

export function formatQualified(v: Qualified, decimals: number): string {
  const f = (n: number) => formatDecimal(n, decimals);
  if (v.q === 'range') return `${f(v.a)}–${f(v.b!)}`;
  return v.q ? `${v.q} ${f(v.a)}` : f(v.a);
}
