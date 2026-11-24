// Deterministic label matching on OCR text (D-76 a). No model interprets the
// document: a value is taken only where a known label stands directly next to
// a number, so every value carries its page, box and the exact source text.
//
// Layouts recognised (all verified on real OCR output, D-77, D-79):
// 1. Table rows: a cell equal to the label, the value in the next cell
//    ("| IVSd | 1.2 cm | MV E Max | 0.62 m/s |" — several pairs per row). A label wrapped onto
//    the next row (whose value cell is empty) is joined: "G peak SL Voll" + "(Avg)".
//    With `column`, the value is taken from the named column instead
//    ("|  | Atrial Lead | Ventricular Lead |" → "| Measured Impedance | 354 ohms | 621 ohms |").
// 2. Text lines and single table cells: "Label: 57 %", "R-wave 5.60 mV - 8.00 mV",
//    "Measured Threshold: 0.500 V at 0.40 ms" (first value, or the second with `second`).
// 3. Separate text blocks on one row: block "TAPSE" and block "2.2 cm" to its right.
// Optional filters: the section heading above the value (`section`) and preferred
// pages (module `preferPages`, e.g. the final report of a device interrogation).
import { parseDecimal, parseQualified, type Qualified } from '../format';
import type { OcrBlock, OcrPage, OcrResult } from './ocr';
import { normaliseUnit, type ExtractionSpec, type ModuleExtraction } from './spec';

export interface Candidate {
  fieldKey: string;
  label: string;
  /** The source text as printed (label and value; table cells joined with spaces). */
  rawText: string;
  valueText: string;
  value: Qualified;
  unitText: string;
  page: number;
  box: [number, number, number, number] | null;
  pageSize: { width: number; height: number };
  /** Minimum word confidence over the value characters (or the block minimum). */
  confidence: number | null;
}

/** A text line or a table cell, with its character offset in the page text. */
interface Segment {
  text: string;
  start: number;
  /** Table cells only: table number on the page, row within the table, column. */
  table?: number;
  row?: number;
  col?: number;
}

const NUM = String.raw`[<>]?\s*-?\d+(?:[.,]\d+)?`;
const NUMBER = String.raw`${NUM}(?:\s*(?:-|–|bis|to)\s*\d+(?:[.,]\d+)?)?`;
const UNIT = String.raw`(?![-–])[^\s\d]\S*`;
const VALUE_CELL = new RegExp(String.raw`^(${NUMBER})\s*([^\s\d][^\s]*)?$`);
/** "5.60 mV - 8.00 mV", "2.00 - 2.80 mV", "0.500 V", "22.8%". Groups: n1, u1, n2, u2. */
const VALUE = String.raw`(${NUM})\s*(${UNIT})?(?:\s*(?:-|–|bis|to)\s*(\d+(?:[.,]\d+)?)\s*(${UNIT})?)?`;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const norm = (s: string) => s.replace(/\s+/g, ' ').trim().replace(/:$/, '').trim().toLowerCase();
const startsWithAny = (text: string, prefixes: readonly string[] | undefined) =>
  !!prefixes?.some((p) => norm(text).startsWith(norm(p)));

function parseValue(text: string): Qualified | null {
  const t = text.replace(/\s+/g, ' ');
  const n = parseDecimal(t);
  return parseQualified(t) ?? (n !== null ? { q: null, a: n } : null);
}

function blockFor(page: OcrPage, offset: number): OcrBlock | null {
  return page.blocks.find((b) => b.start >= 0 && offset >= b.start && offset < b.start + b.content.length) ?? null;
}

function confidenceFor(page: OcrPage, from: number, to: number): number | null {
  const words = page.words.filter((w) => w.start < to && w.start + w.text.length > from);
  if (words.length) return Math.min(...words.map((w) => w.confidence));
  return blockFor(page, from)?.minConfidence ?? null;
}

/** Text lines and table cells of a page in reading order. */
function segments(page: OcrPage): Segment[] {
  const out: Segment[] = [];
  let pos = 0;
  let table = -1;
  let row = 0;
  let inTable = false;
  for (const raw of page.text.split('\n')) {
    const lineStart = pos;
    pos += raw.length + 1;
    const t = raw.trim();
    if (!t.startsWith('|')) {
      if (t) inTable = false; // a blank line between table rows does not end the table
      if (!t) continue;
      const body = t.replace(/^(#+|[-*])\s+/, '');
      out.push({ text: body, start: lineStart + raw.indexOf(body) });
      continue;
    }
    if (/^\|?\s*:?-{3,}/.test(t)) continue; // separator row
    if (!inTable) {
      table++;
      row = 0;
      inTable = true;
    }
    let cellStart = raw.indexOf('|') + 1;
    const parts = raw.slice(cellStart).split('|');
    parts.forEach((cell, col) => {
      if (col === parts.length - 1 && cell.trim() === '') return; // after the closing pipe
      const lead = cell.length - cell.trimStart().length;
      out.push({ text: cell.trim(), start: lineStart + cellStart + lead, table, row, col });
      cellStart += cell.length + 1;
    });
    row++;
  }
  return out;
}

interface Found {
  rawText: string;
  valueText: string;
  unitText: string;
  /** Offsets of the value characters in the page text. */
  from: number;
  to: number;
  box: [number, number, number, number] | null;
  /** Index of the segment the value belongs to (for the section lookup). */
  seg: number;
}

const cellAt = (segs: Segment[], table: number, row: number, col: number) =>
  segs.find((s) => s.table === table && s.row === row && s.col === col);

/**
 * Column of the value for a label cell: the cell of `names` in the nearest header row
 * above (a row with any known column name). A header naming a single lead
 * ("| Ventricular Lead |  |", "| V. Elektrode |  |") is printed above the value column but
 * OCR may place it in the first cell; it is accepted only if the label row has exactly
 * one value, which is then that value.
 */
function columnIndex(segs: Segment[], cell: Segment, names: readonly string[], known: readonly string[]): number | null {
  const isKnown = (s: Segment) => known.some((k) => norm(k) === norm(s.text));
  const isName = (s: Segment) => names.some((n) => norm(n) === norm(s.text));
  const inRow = (r: number) => segs.filter((s) => s.table === cell.table && s.row === r);
  for (let r = cell.row! - 1; r >= 0; r--) {
    const header = inRow(r);
    const knownCells = header.filter(isKnown);
    if (!knownCells.length) continue;
    const hit = header.find(isName);
    if (!hit) return null;
    if (hit.col! > cell.col!) return hit.col!;
    const values = inRow(cell.row!).filter((s) => s.col! > cell.col! && s.text);
    return knownCells.length === 1 && values.length === 1 ? values[0]!.col! : null;
  }
  return null;
}

function inTables(page: OcrPage, segs: Segment[], label: string, spec: ExtractionSpec, known: readonly string[]): Found[] {
  const out: Found[] = [];
  const units = [spec.unit, ...(spec.alternatives ?? []).map((a) => a.unit)].filter(Boolean).map(normaliseUnit);
  segs.forEach((cell, idx) => {
    if (cell.table === undefined) return;
    // A long label wraps onto the next row, whose value cell is empty
    // ("| G peak SL Voll | -16 % |" + "| (Avg) |  |"): the joined label also counts.
    const below = cellAt(segs, cell.table, cell.row! + 1, cell.col!);
    const belowValue = cellAt(segs, cell.table, cell.row! + 1, cell.col! + 1);
    const wrapped = below?.text && !belowValue?.text ? `${cell.text} ${below.text}` : null;
    const labelText = norm(cell.text) === norm(label) ? cell.text : wrapped && norm(wrapped) === norm(label) ? wrapped : null;
    if (!labelText) return;
    let col = cell.col! + 1;
    if (spec.column) {
      const c = columnIndex(segs, cell, spec.column, known);
      if (c === null || c <= cell.col!) return;
      col = c;
    }
    const v = cellAt(segs, cell.table, cell.row!, col);
    const m = v ? VALUE_CELL.exec(v.text) : null;
    if (!v || !m) return;
    let unitText = m[2] ?? '';
    // Unit in its own cell ("| 58 | % |") only when it is a unit this field accepts.
    const next = cellAt(segs, cell.table, cell.row!, col + 1);
    if (!unitText && next && units.includes(normaliseUnit(next.text))) unitText = next.text;
    const offset = v.text.indexOf(m[1]!);
    out.push({
      rawText: [labelText, v.text, unitText && !m[2] ? unitText : ''].filter(Boolean).join(' '),
      valueText: m[1]!,
      unitText,
      from: v.start + offset,
      to: v.start + offset + m[1]!.length,
      box: blockFor(page, v.start)?.box ?? null,
      seg: idx,
    });
  });
  return out;
}

/** "Label: value" in a text line or a single table cell. */
function inLines(page: OcrPage, segs: Segment[], label: string, spec: ExtractionSpec): Found[] {
  const re = new RegExp(`^${escape(label)}\\s*[:=]?\\s*${VALUE}(?:\\s+(?:at|bei|@)\\s+${VALUE})?\\s*$`, 'id');
  const out: Found[] = [];
  segs.forEach((seg, idx) => {
    const m = re.exec(seg.text);
    if (!m) return;
    const g = spec.second ? 5 : 1; // groups 1–4: first value, 5–8: value after "at"/"bei"
    if (m[g] === undefined) return;
    const [n1, u1, n2, u2] = [m[g], m[g + 1], m[g + 2], m[g + 3]];
    if (u1 && u2 && normaliseUnit(u1) !== normaliseUnit(u2)) return; // "5 mV - 8 ms": not one range
    const from = seg.start + m.indices![g]![0];
    const to = seg.start + m.indices![n2 !== undefined ? g + 2 : g]![1];
    out.push({
      rawText: seg.text,
      valueText: n2 !== undefined ? `${n1} - ${n2}` : n1!,
      unitText: u2 ?? u1 ?? '',
      from,
      to,
      box: blockFor(page, from)?.box ?? null,
      seg: idx,
    });
  });
  return out;
}

/** Label block and value block side by side on the same row (vertical overlap, value to the right). */
function inBlockPairs(page: OcrPage, segs: Segment[], label: string): Found[] {
  const out: Found[] = [];
  const textBlocks = page.blocks.filter((b) => b.type !== 'table' && b.start >= 0);
  for (const lb of textBlocks) {
    if (norm(lb.content) !== norm(label)) continue;
    const [, ly0, lx1, ly1] = lb.box;
    const right = textBlocks
      .filter((b) => b !== lb && b.box[0] >= lx1 && Math.min(ly1, b.box[3]) - Math.max(ly0, b.box[1]) > 0.5 * (ly1 - ly0))
      .sort((a, b) => a.box[0] - b.box[0])[0];
    const m = right ? VALUE_CELL.exec(right.content.trim()) : null;
    if (!right || !m) continue;
    const offset = right.content.indexOf(m[1]!);
    out.push({
      rawText: `${lb.content.trim()} ${right.content.trim()}`,
      valueText: m[1]!,
      unitText: m[2] ?? '',
      from: right.start + offset,
      to: right.start + offset + m[1]!.length,
      box: [
        Math.min(lb.box[0], right.box[0]),
        Math.min(lb.box[1], right.box[1]),
        Math.max(lb.box[2], right.box[2]),
        Math.max(lb.box[3], right.box[3]),
      ],
      seg: segs.findIndex((s) => s.start === lb.start),
    });
  }
  return out;
}

/**
 * The section heading above a segment: the nearest earlier text line, or table cell in
 * the same column, that starts with a declared heading. Null if there is none.
 */
function sectionOf(segs: Segment[], idx: number, headings: readonly string[]): string | null {
  const own = segs[idx];
  for (let j = idx - 1; j >= 0; j--) {
    const s = segs[j]!;
    if (own?.col !== undefined && s.col !== undefined && s.col !== own.col) continue;
    const h = headings.find((p) => norm(s.text).startsWith(norm(p)));
    if (h) return h;
  }
  return null;
}

/**
 * All label matches for one field, in label priority order. With preferred pages
 * (module setting), values on those pages win; other pages count only if the field
 * is not found on them at all.
 */
export function findCandidates(ocr: OcrResult, fieldKey: string, spec: ExtractionSpec, module: ModuleExtraction = {}): Candidate[] {
  const preferred = ocr.pages.filter((p) => startsWithAnyLine(p.text, module.preferPages));
  const pageSets = preferred.length ? [preferred, ocr.pages] : [ocr.pages];
  const known = (module.columns ?? []) as readonly string[];
  for (const pages of pageSets) {
    for (const label of spec.labels) {
      const found: Candidate[] = [];
      for (const page of pages) {
        const segs = segments(page);
        const all = [...inTables(page, segs, label, spec, known), ...inLines(page, segs, label, spec), ...inBlockPairs(page, segs, label)];
        for (const f of all) {
          if (spec.section) {
            const h = f.seg >= 0 ? sectionOf(segs, f.seg, module.sections ?? []) : null;
            if (!h || !spec.section.some((s) => norm(s) === norm(h))) continue;
          }
          const value = parseValue(f.valueText);
          if (!value) continue;
          found.push({
            fieldKey,
            label,
            rawText: f.rawText,
            valueText: f.valueText,
            value,
            unitText: f.unitText,
            page: page.index,
            box: f.box,
            pageSize: { width: page.width, height: page.height },
            confidence: confidenceFor(page, f.from, f.to),
          });
        }
      }
      if (found.length) return dedupe(found); // higher-priority label found: lower ones are not used
    }
  }
  return [];
}

/** The same source text found by two layouts (a cell read as a pair and as a line) counts once. */
function dedupe(found: Candidate[]): Candidate[] {
  const seen = new Set<string>();
  return found.filter((c) => {
    const k = `${c.page}|${c.valueText}|${c.unitText}|${c.confidence}|${c.box?.join(',')}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** A page is preferred if one of its lines (or cells) starts with a marker. */
function startsWithAnyLine(text: string, markers: readonly string[] | undefined): boolean {
  if (!markers?.length) return false;
  return text.split('\n').some((l) => startsWithAny(l.replace(/^[|#\s]+/, ''), markers));
}
