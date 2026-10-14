// The one report generator for all modules (CLAUDE.md "Report output").
// Same schema + rules + data → byte-identical text (golden-file tested).
import { evaluate as evalCond, type Scalar } from './conditions';
import { evaluateStudy, optionFor, type Context, type Evaluation } from './evaluate';
import { formatDecimal } from './format';
import type { RuleSet } from './rules/ruleSet';
import {
  NB,
  allFields,
  type Field,
  type LineSpec,
  type ModuleSchema,
  type ReportSectionSpec,
  type SentenceSpec,
  type Template,
} from './schema';
import type { StudyData } from './studyData';
import { renderString } from './template';

export interface ReportSentence {
  id: string;
  /** Text that goes into the report ("" when removed). */
  text: string;
  /** Generated text, if the rules currently produce one. */
  generated?: string;
  edited: boolean;
  removed: boolean;
  /** The physician's edit was based on a generated text that has changed since. */
  stale: boolean;
  /** Not editable as a sentence (free text, library block). */
  kind: 'generated' | 'extra' | 'library';
}

export interface ReportLine {
  id: string;
  label?: string;
  sentences: ReportSentence[];
  library: boolean;
}

export interface ReportSection {
  id: string;
  heading?: string;
  lines: ReportLine[];
}

export interface MeasurementItem {
  label: string;
  value: string;
  unit: string;
}

export interface MeasurementLine {
  label: string;
  items: MeasurementItem[];
}

export interface RuleUse {
  id: string;
  version: number;
  title: string;
  source: string;
  reviewedOn: string;
}

export interface ReportModel {
  moduleKey: string;
  title: string;
  head: ReportSection[];
  measurementsHeading: string;
  measurements: MeasurementLine[];
  body: ReportSection[];
  rulesUsed: RuleUse[];
}

export function generateReport(
  schema: ModuleSchema,
  rules: ReadonlyMap<string, RuleSet>,
  data: StudyData,
  ctx: Context,
  evaluation: Evaluation = evaluateStudy(schema, rules, data, ctx),
): ReportModel {
  const fields = new Map(allFields(schema).map((f) => [f.key, f]));
  const ev = evaluation;

  const lookup = (ph: string): string | undefined => {
    const parts = ph.split(':');
    if (parts[0] === 'cat') {
      const c = ev.classifications.get(parts[1]!);
      if (!c || c.band.label === null) return undefined;
      return parts[2] ? c.band.forms?.[parts[2]] : c.band.label;
    }
    const [key, form] = parts as [string, string | undefined];
    if (ev.derived.has(key)) return String(ev.derived.get(key));
    const v = ev.values.get(key);
    const field = fields.get(key);
    if (v === undefined || !field) return undefined;
    if (form) {
      const opt = optionFor(field, v);
      return form === 'short' ? opt?.short : opt?.forms?.[form];
    }
    return formatValue(field, v);
  };

  const render = (t: Template): string | undefined => {
    if (typeof t === 'string') return renderString(t, lookup);
    let out = '';
    for (const part of t) {
      if (typeof part === 'string') {
        const s = renderString(part, lookup);
        if (s === undefined) return undefined;
        out += s;
      } else {
        const items = part.items
          .map((item) => (typeof item === 'string' ? [item] : item))
          .map((alts) => alts.map((a) => renderString(a, lookup)).find((s) => s !== undefined))
          .filter((s): s is string => s !== undefined);
        if (items.length) out += (part.before ?? '') + items.join(part.join) + (part.after ?? '');
      }
    }
    return out;
  };

  const renderSentence = (s: SentenceSpec): string | undefined =>
    s.when && !evalCond(s.when, ev.resolver) ? undefined : tidy(render(s.text));

  const withOverride = (id: string, generated: string | undefined): ReportSentence | null => {
    const o = data.overrides[id];
    if (!o) {
      return generated === undefined
        ? null
        : { id, text: generated, generated, edited: false, removed: false, stale: false, kind: 'generated' };
    }
    if (generated === undefined && o.text === '') return null; // removed, and nothing to restore any more
    return {
      id,
      text: o.text,
      generated,
      edited: true,
      removed: o.text === '',
      stale: generated !== o.basis,
      kind: 'generated',
    };
  };

  const buildLine = (line: LineSpec): ReportLine => {
    const sentences: ReportSentence[] = [];
    if (line.fragments) {
      const parts: string[] = [];
      for (const item of line.items) {
        if ('nb' in item) continue;
        const text =
          'choose' in item
            ? item.choose.map(renderSentence).find((t) => t !== undefined)
            : renderSentence(item);
        if (text) parts.push(text);
      }
      const joined = parts.length ? capitalise(parts.join(', ')) + '.' : undefined;
      const s = withOverride(line.id, joined);
      if (s) sentences.push(s);
    } else {
      for (const item of line.items) {
        if ('nb' in item) {
          for (const key of item.nb) {
            if (ev.values.get(key) !== NB) continue;
            const f = fields.get(key)!;
            const s = withOverride(`nb.${key}`, `${f.reportLabel ?? f.label}: ${NB}.`);
            if (s) sentences.push(s);
          }
          continue;
        }
        const text =
          'choose' in item
            ? item.choose.map(renderSentence).find((t) => t !== undefined)
            : renderSentence(item);
        const s = withOverride(item.id, text);
        if (s) sentences.push(s);
      }
    }
    if (line.library) {
      data.blocks.forEach((b, i) => {
        sentences.push({
          id: `lib.${i}`,
          text: b.text,
          edited: false,
          removed: false,
          stale: false,
          kind: 'library',
        });
      });
    }
    const extra = data.extras[line.id]?.trim();
    if (extra) {
      sentences.push({ id: `extra.${line.id}`, text: extra, edited: false, removed: false, stale: false, kind: 'extra' });
    }
    return { id: line.id, label: line.label, sentences, library: !!line.library };
  };

  const buildSection = (sec: ReportSectionSpec): ReportSection => ({
    id: sec.id,
    heading: sec.heading,
    lines: sec.lines.map(buildLine),
  });

  const measurements: MeasurementLine[] = schema.report.measurements.map((g) => ({
    label: g.label,
    items: g.fields
      .filter((k) => ev.values.has(k))
      .map((k) => {
        const f = fields.get(k)!;
        return {
          label: f.reportLabel ?? f.label,
          value: formatValue(f, ev.values.get(k)!),
          unit: f.type === 'number' ? f.unit : '',
        };
      }),
  }));

  const rulesUsed: RuleUse[] = [...ev.classifications.keys()]
    // Only rule sets that produce report text (reference ranges and criteria tables only highlight).
    .filter((id) => schema.rules.includes(id) && rules.get(id)?.purpose === 'category')
    .sort()
    .map((id) => {
      const r = rules.get(id)!;
      return { id: r.id, version: r.version, title: r.title, source: r.source, reviewedOn: r.reviewedOn };
    });

  return {
    moduleKey: schema.key,
    title: schema.report.title,
    head: schema.report.head.map(buildSection),
    measurementsHeading: schema.report.measurementsHeading,
    measurements,
    body: schema.report.body.map(buildSection),
    rulesUsed,
  };
}

function formatValue(field: Field, v: Scalar): string {
  if (field.type === 'number' && typeof v === 'number') return formatDecimal(v, field.decimals);
  return String(v);
}

function tidy(s: string | undefined): string | undefined {
  if (s === undefined) return undefined;
  const t = s.replace(/\s+/g, ' ').replace(/\s+([.,;)])/g, '$1').replace(/\(\s+/g, '(').trim();
  return t === '' ? undefined : t;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---- Plain text (clipboard, golden files) --------------------------------

const visibleSentences = (l: ReportLine) => l.sentences.filter((s) => !s.removed && s.text.trim() !== '');

function lineText(l: ReportLine): string | null {
  const text = visibleSentences(l)
    .map((s) => s.text)
    .join(l.library ? '\n' : ' ');
  if (!text) return null;
  return l.label ? `${l.label} ${text}` : text;
}

function sectionText(s: ReportSection): string | null {
  const lines = s.lines.map(lineText).filter((t): t is string => t !== null);
  if (!lines.length) return null;
  return [s.heading, ...lines].filter(Boolean).join('\n');
}

export function measurementText(i: MeasurementItem): string {
  return `${i.label} ${i.value}${i.unit ? ` ${i.unit}` : ''}`;
}

/** Visible lines of a section as text (for DOCX/PDF). */
export function sectionLines(s: ReportSection): { label?: string; text: string }[] {
  return s.lines
    .map((l) => ({ label: l.label, text: visibleSentences(l).map((x) => x.text).join(l.library ? '\n' : ' ') }))
    .filter((l) => l.text !== '');
}

/** Report as plain text with "\n" line ends. The TESTDATEN marker is added by the export, not here. */
export function reportToText(model: ReportModel): string {
  const blocks: string[] = [model.title];
  const head = model.head.map(sectionText).filter((t): t is string => t !== null);
  if (head.length) blocks.push(head.join('\n'));
  const m = model.measurements
    .filter((g) => g.items.length)
    .map((g) => `${g.label} ${g.items.map(measurementText).join('; ')}`);
  if (m.length) blocks.push([model.measurementsHeading, ...m].join('\n'));
  for (const s of model.body) {
    const t = sectionText(s);
    if (t) blocks.push(t);
  }
  return blocks.join('\n\n') + '\n';
}

/** Values that block export: unconfirmed extractions feeding the report (gateway §4.2). */
export function exportBlockers(schema: ModuleSchema, data: StudyData, ev: Evaluation): string[] {
  const fields = new Map(allFields(schema).map((f) => [f.key, f]));
  return data.unconfirmed
    .filter((k) => ev.values.has(k))
    .map((k) => fields.get(k)?.label ?? k);
}
