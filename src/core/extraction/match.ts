// Deterministic label matching on OCR text (D-76 a). No model interprets the
// document: a value is taken only where a known label stands directly next to
// a number, so every value carries its page, box and the exact source text.
//
// Three layouts are recognised (all verified on real OCR output, D-77):
// 1. Table rows: a cell equal to the label, the value in the next cell
//    ("| IVSd | 1.2 cm | MV E Max | 0.62 m/s |" — several pairs per row). A label wrapped onto
//    the next row (whose value cell is empty) is joined: "G peak SL Voll" + "(Avg)".
// 2. Text lines: "Label: 57 %" / "Label 57 %".
// 3. Separate text blocks on one row: block "TAPSE" and block "2.2 cm" to its right.
import { parseDecimal, parseQualified, type Qualified } from '../format';
import type { OcrBlock, OcrPage, OcrResult } from './ocr';
import { normaliseUnit, type ExtractionSpec } from './spec';

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

/** A piece of page text with its character offset in the page text. */
interface Span {
  text: string;
  start: number;
}

const NUMBER = String.raw`[<>]?\s*-?\d+(?:[.,]\d+)?(?:\s*(?:-|–|bis|to)\s*\d+(?:[.,]\d+)?)?`;
const VALUE_CELL = new RegExp(String.raw`^(${NUMBER})\s*([^\s\d][^\s]*)?$`);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const norm = (s: string) => s.replace(/\s+/g, ' ').trim().replace(/:$/, '').trim().toLowerCase();

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

/** Markdown table rows of a page as cells with offsets. */
function tableRows(page: OcrPage): Span[][] {
  const rows: Span[][] = [];
  let pos = 0;
  for (const raw of page.text.split('\n')) {
    const lineStart = pos;
    pos += raw.length + 1;
    const t = raw.trim();
    if (!t.startsWith('|') || /^\|?\s*:?-{3,}/.test(t)) continue;
    const cells: Span[] = [];
    let cellStart = raw.indexOf('|') + 1;
    const parts = raw.slice(cellStart).split('|');
    parts.forEach((cell, i) => {
      if (i === parts.length - 1 && cell.trim() === '') return; // after the closing pipe
      const lead = cell.length - cell.trimStart().length;
      cells.push({ text: cell.trim(), start: lineStart + cellStart + lead });
      cellStart += cell.length + 1;
    });
    rows.push(cells);
  }
  return rows;
}

/** Non-table text lines ("Label: 57 %"), without markdown heading or list markers. */
function textLines(page: OcrPage): Span[] {
  const out: Span[] = [];
  let pos = 0;
  for (const raw of page.text.split('\n')) {
    const lineStart = pos;
    pos += raw.length + 1;
    const t = raw.trim();
    if (!t || t.startsWith('|')) continue;
    const body = t.replace(/^(#+|[-*])\s+/, '');
    out.push({ text: body, start: lineStart + raw.indexOf(body) });
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
}

function inTables(page: OcrPage, label: string, spec: ExtractionSpec): Found[] {
  const out: Found[] = [];
  const units = [spec.unit, ...(spec.alternatives ?? []).map((a) => a.unit)].filter(Boolean).map(normaliseUnit);
  const rows = tableRows(page);
  rows.forEach((cells, r) => {
    cells.forEach((cell, i) => {
      // A long label wraps onto the next row, whose value cell is empty
      // ("| G peak SL Voll | -16 % |" + "| (Avg) |  |"): the joined label also counts.
      const below = rows[r + 1];
      const wrapped = below?.[i]?.text && !below[i + 1]?.text ? `${cell.text} ${below[i]!.text}` : null;
      const labelText = norm(cell.text) === norm(label) ? cell.text : wrapped && norm(wrapped) === norm(label) ? wrapped : null;
      if (!labelText) return;
      const v = cells[i + 1];
      const m = v ? VALUE_CELL.exec(v.text) : null;
      if (!v || !m) return;
      let unitText = m[2] ?? '';
      // Unit in its own cell ("| 58 | % |") only when it is a unit this field accepts.
      const next = cells[i + 2];
      if (!unitText && next && units.includes(normaliseUnit(next.text))) unitText = next.text;
      const offset = v.text.indexOf(m[1]!);
      out.push({
        rawText: [labelText, v.text, unitText && !m[2] ? unitText : ''].filter(Boolean).join(' '),
        valueText: m[1]!,
        unitText,
        from: v.start + offset,
        to: v.start + offset + m[1]!.length,
        box: blockFor(page, v.start)?.box ?? null,
      });
    });
  });
  return out;
}

function inTextLines(page: OcrPage, label: string): Found[] {
  const re = new RegExp(`^${escape(label)}\\s*[:=]?\\s*(${NUMBER})\\s*([^\\s\\d][^\\s]*)?\\s*$`, 'i');
  const out: Found[] = [];
  for (const line of textLines(page)) {
    const m = re.exec(line.text);
    if (!m) continue;
    const offset = line.text.indexOf(m[1]!, label.length);
    const from = line.start + offset;
    out.push({
      rawText: line.text,
      valueText: m[1]!,
      unitText: m[2] ?? '',
      from,
      to: from + m[1]!.length,
      box: blockFor(page, from)?.box ?? null,
    });
  }
  return out;
}

/** Label block and value block side by side on the same row (vertical overlap, value to the right). */
function inBlockPairs(page: OcrPage, label: string): Found[] {
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
    });
  }
  return out;
}

/** All label matches for one field, in label priority order. */
export function findCandidates(ocr: OcrResult, fieldKey: string, spec: ExtractionSpec): Candidate[] {
  const found: Candidate[] = [];
  for (const label of spec.labels) {
    for (const page of ocr.pages) {
      for (const f of [...inTables(page, label, spec), ...inTextLines(page, label), ...inBlockPairs(page, label)]) {
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
    if (found.length) break; // higher-priority label found: lower ones are not used
  }
  return found;
}
