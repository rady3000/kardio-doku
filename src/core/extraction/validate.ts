// Automatic rejection (gateway §4.3): no provenance, low confidence, wrong or
// missing unit, implausible value, or ambiguous source → the field stays empty.
import { storeQualified } from '../format';
import type { Candidate } from './match';
import { normaliseUnit, type ExtractionSpec } from './spec';

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
  if (c.value.q !== null && !qualified) return { ok: false, candidate: c, reason: 'Wert mit Bereich oder ">"/"<" nicht zulässig' };

  let factor: number | null = null;
  const unit = normaliseUnit(c.unitText);
  if (unit === '') factor = spec.unitOptional || spec.unit === '' ? 1 : null;
  else if (unit === normaliseUnit(spec.unit)) factor = 1;
  else factor = spec.alternatives?.find((a) => normaliseUnit(a.unit) === unit)?.factor ?? null;
  if (factor === null) return { ok: false, candidate: c, reason: unit ? `Einheit "${c.unitText}" nicht erwartet` : 'Einheit fehlt' };

  const conv = { ...c.value, a: round(c.value.a * factor), b: c.value.b === undefined ? undefined : round(c.value.b * factor) };
  const check = spec.rangeOnAbsolute ? Math.abs(conv.a) : conv.a;
  if (check < spec.range[0] || check > spec.range[1]) {
    return { ok: false, candidate: c, reason: `außerhalb des Plausibilitätsbereichs ${spec.range[0]}–${spec.range[1]}` };
  }
  return { ok: true, candidate: c, stored: storeQualified(conv), unit: spec.unit };
}
