// Switchable on-screen hint groups (D-84): e.g. the ICD programming check
// ("icd-konsensus") can be switched off in the settings. A disabled group hides
// its warnings and the fields that belong to it; nothing in the report changes,
// because hints never reach the report text.
import type { Evaluation } from './evaluate';
import { allFields, type ModuleSchema } from './schema';

/** Hint groups the settings offer, with their German label. */
export const HINT_GROUPS = [{ key: 'icd-konsensus', label: 'Hinweise zur ICD-Programmierung (Konsensus 2019)' }] as const;

export function applyHintSettings(ev: Evaluation, schema: ModuleSchema, disabled: readonly string[]): Evaluation {
  if (disabled.length === 0) return ev;
  const off = new Set(disabled);
  const visible = new Set(ev.visible);
  for (const f of allFields(schema)) if (f.group && off.has(f.group)) visible.delete(f.key);
  return { ...ev, visible, warnings: ev.warnings.filter((w) => !w.group || !off.has(w.group)) };
}
