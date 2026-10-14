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
