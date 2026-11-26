// Automatic rejection (gateway §4.3): no provenance, low confidence, wrong or
// missing unit, implausible value, or ambiguous source → the field stays empty.
import { storeQualified, type Qualified } from '../format';
import type { Candidate } from './match';
import { normaliseUnit, type ExtractionSpec, type ValueExtractionSpec } from './spec';

export type Outcome =
  | { ok: true; candidate: Candidate; stored: number | string; unit: string }
  | { ok: false; candidate: Candidate | null; reason: string };

const round = (n: number) => Math.round(n * 1e6) / 1e6;

export function validateCandidates(
  spec: ExtractionSpec,
  candidates: Candidate[],
  threshold: number,
  qualified: boolean,
): Outcome {
  if (!candidates.length) return { ok: false, candidate: null, reason: 'nicht gefunden' };
  const distinct = new Set(candidates.map((c) => `${c.valueText}|${c.unitText}`));
  if (distinct.size > 1) return { ok: false, candidate: candidates[0]!, reason: 'mehrdeutig (verschiedene Werte im Dokument)' };
  const c = candidates[0]!;
  if (c.box === null) return { ok: false, candidate: c, reason: 'keine Position im Dokument' };
  if (c.confidence === null) return { ok: false, candidate: c, reason: 'keine Konfidenz' };
  if (c.confidence < threshold) return { ok: false, candidate: c, reason: `Konfidenz ${c.confidence.toFixed(2)} unter ${threshold}` };
  if (c.value === null) return { ok: false, candidate: c, reason: 'kein Zahlenwert' };
  if (c.value.q !== null && !qualified) return { ok: false, candidate: c, reason: 'Wert mit Bereich oder ">"/"<" nicht zulässig' };

  let factor: number | null = null;
  const unit = normaliseUnit(c.unitText);
  const companion = unitOption(spec, c.unitText);
  if (spec.unitField) factor = companion ? 1 : null; // the unit is kept as printed (companion field)
  else if (unit === '') factor = spec.unitOptional || spec.unit === '' ? 1 : null;
  else if (unit === normaliseUnit(spec.unit)) factor = 1;
  else factor = spec.alternatives?.find((a) => normaliseUnit(a.unit) === unit)?.factor ?? null;
  if (factor === null) return { ok: false, candidate: c, reason: unit ? `Einheit "${c.unitText}" nicht erwartet` : 'Einheit fehlt' };

  const conv: Qualified = { ...c.value, a: round(c.value.a * factor) };
  if (c.value.b !== undefined) conv.b = round(c.value.b * factor);
  const check = spec.rangeOnAbsolute ? Math.abs(conv.a) : conv.a;
  if (check < spec.range[0] || check > spec.range[1]) {
    return { ok: false, candidate: c, reason: `außerhalb des Plausibilitätsbereichs ${spec.range[0]}–${spec.range[1]}` };
  }
  return { ok: true, candidate: c, stored: storeQualified(conv), unit: companion ?? spec.unit };
}

/** The companion option for a printed unit ("Mon." → "Monate"), or null. */
export function unitOption(spec: ExtractionSpec, unitText: string): string | null {
  if (!spec.unitField) return null;
  const u = normaliseUnit(unitText);
  for (const [option, spellings] of Object.entries(spec.unitField.units)) {
    if (spellings.some((x) => normaliseUnit(x) === u)) return option;
  }
  return null;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, mär: 3, mrz: 3, apr: 4, may: 5, mai: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, okt: 10, nov: 11, dec: 12, dez: 12,
};

/**
 * Unambiguous date formats only (SPEC-textgen X-6): DD.MM.YYYY, DD.MM.YY, YYYY-MM-DD,
 * "16-Feb-2026", "30 Okt 2026". Slash dates (day/month order unknown) are discarded.
 */
export function parseDocumentDate(text: string, today: Date = new Date()): string | null {
  const t = text.trim();
  let y: number, m: number, d: number;
  let r = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/.exec(t);
  if (r) {
    d = +r[1]!;
    m = +r[2]!;
    y = +r[3]!;
    if (r[3]!.length === 2) y += 2000 + y > today.getFullYear() ? 1900 : 2000;
  } else if ((r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t))) {
    y = +r[1]!;
    m = +r[2]!;
    d = +r[3]!;
  } else if ((r = /^(\d{1,2})[-\s.]+([A-Za-zä]{3,4})\.?[-\s]+(\d{4})$/.exec(t))) {
    const mm = MONTHS[r[2]!.toLowerCase().slice(0, 3)];
    if (!mm) return null;
    d = +r[1]!;
    m = mm;
    y = +r[3]!;
  } else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Choice, text and date fields: same provenance and confidence checks; the value must map cleanly. */
export function validateValueCandidates(spec: ValueExtractionSpec, candidates: Candidate[], threshold: number, options: readonly string[] = []): Outcome {
  if (!candidates.length) return { ok: false, candidate: null, reason: 'nicht gefunden' };
  const all = candidates.map((c) => ({ c, v: valueOf(spec, c, options) }));
  // A text that maps to nothing is no evidence (e.g. the model line without the manufacturer);
  // with no mapped text at all the field stays empty.
  // Dates stay strict: an unreadable date next to the label could be a different one.
  const results = spec.kind === 'choice' ? all.filter((r) => r.v !== null) : all;
  if (!results.length || results.some((r) => r.v === null)) {
    const bad = all.find((r) => r.v === null) ?? all[0]!;
    return { ok: false, candidate: bad.c, reason: spec.kind === 'date' ? 'kein eindeutiges Datum' : spec.kind === 'choice' ? `"${bad.c.valueText}" passt zu keiner Auswahl` : 'leer' };
  }
  // Several printed items ("Kammerflimmern, Vorhofflimmern (AF)") are taken only if every item maps
  // to the same choice; otherwise the physician chooses (two indications: "Andere" + free text, D-84).
  if (spec.kind === 'choice' && spec.singleItem) {
    for (const { c: x } of results) {
      const items = x.valueText.split(/\s*(?:[,;]|\bund\b)\s*/).filter(Boolean);
      const mapped = items.map((i) => mapChoice(spec, i, options));
      if (items.length > 1 && (mapped.includes(null) || new Set(mapped).size > 1)) {
        return { ok: false, candidate: x, reason: 'mehrere Angaben (bitte selbst auswählen)' };
      }
    }
  }
  const c = results[0]!.c;
  if (new Set(results.map((r) => r.v)).size > 1) return { ok: false, candidate: c, reason: 'mehrdeutig (verschiedene Werte im Dokument)' };
  for (const { c: x } of results) {
    if (x.box === null) return { ok: false, candidate: x, reason: 'keine Position im Dokument' };
    if (x.confidence === null) return { ok: false, candidate: x, reason: 'keine Konfidenz' };
    if (x.confidence < threshold) return { ok: false, candidate: x, reason: `Konfidenz ${x.confidence.toFixed(2)} unter ${threshold}` };
  }
  const v = results[0]!.v!;
  if (spec.kind === 'date') {
    const min = spec.minDate ?? '1980-01-01';
    const max = new Date().toISOString().slice(0, 10);
    if (v < min || v > max) return { ok: false, candidate: c, reason: `Datum außerhalb ${min} – heute` };
  }
  return { ok: true, candidate: c, stored: v, unit: '' };
}

function valueOf(spec: ValueExtractionSpec, c: Candidate, options: readonly string[]): string | null {
  if (spec.kind === 'date') return parseDocumentDate(c.valueText);
  if (spec.kind === 'choice') return mapChoice(spec, spec.mapOn === 'value' ? c.valueText : `${c.label} ${c.valueText}`, options);
  let t = c.valueText;
  for (const p of spec.strip ?? []) t = t.replace(new RegExp(p, 'gi'), '');
  t = t.replace(/\s+/g, ' ').trim();
  return t || null;
}

/** First mapping rule that matches the text; null if none does or its option is not offered. */
function mapChoice(spec: ValueExtractionSpec, text: string, options: readonly string[]): string | null {
  for (const [pattern, option] of spec.map ?? []) {
    if (new RegExp(pattern, 'i').test(text)) return options.length && !options.includes(option) ? null : option;
  }
  return null;
}
