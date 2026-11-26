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
import { normaliseUnit, type ExtractionSpec, type ModuleExtraction, type ValueExtractionSpec } from './spec';

export interface Candidate {
  fieldKey: string;
  label: string;
  /** The source text as printed (label and value; table cells joined with spaces). */
  rawText: string;
  valueText: string;
  /** Parsed number (number fields); null for choice, text and date fields. */
  value: Qualified | null;
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
    if (/^\|?\s*:?-{3,}/.test(t)) {
      // A separator row follows a table's header row: if the current table already has rows
      // before that header, the header starts a new table.
      if (inTable && row > 1) {
        table++;
        for (const c of out) if (c.table === table - 1 && c.row === row - 1) Object.assign(c, { table, row: 0 });
        row = 1;
      }
      continue;
    }
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
  /** Set when the number is not simply the value text ("8 J. 5 Mo." → 8.42). */
  value?: Qualified;
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
function columnIndex(segs: Segment[], cell: Segment, names: readonly string[], known: readonly string[]): number | null | 'no-header' {
  const isKnownText = (s: Segment) => known.some((k) => norm(k) === norm(s.text));
  const isName = (s: Segment) => names.some((n) => norm(n) === norm(s.text));
  const inRow = (r: number) => segs.filter((s) => s.table === cell.table && s.row === r);
  for (let r = cell.row! - 1; r >= 0; r--) {
    const header = inRow(r);
    const filled = header.filter((s) => s.text);
    // A known name in the first cell is a row label ("| V | 0,75V … |"), unless it is the row's only
    // entry (a single-lead header such as "| Ventricular Lead |  |").
    const knownCells = header.filter((s) => isKnownText(s) && (s.col! > 0 || filled.length === 1));
    if (!knownCells.length) continue;
    const hit = header.find(isName);
    if (!hit) return null;
    if (hit.col! > cell.col!) return hit.col!;
    const values = inRow(cell.row!).filter((s) => s.col! > cell.col! && s.text);
    return knownCells.length === 1 && values.length === 1 ? values[0]!.col! : null;
  }
  return 'no-header';
}

interface Pair {
  labelText: string;
  value: Segment;
  idx: number;
  row: Segment[];
}

/** Table cells equal to the label and the cell holding its value (next cell, or the named column). */
function pairs(
  segs: Segment[],
  label: string,
  spec: { column?: readonly string[]; columnOptional?: boolean },
  known: readonly string[],
): Pair[] {
  const out: Pair[] = [];
  segs.forEach((cell, idx) => {
    if (cell.table === undefined) return;
    // A long label wraps onto the next row, whose value cell is empty
    // ("| G peak SL Voll | -16 % |" + "| (Avg) |  |"): the joined label also counts.
    const below = cellAt(segs, cell.table, cell.row! + 1, cell.col!);
    const belowValue = cellAt(segs, cell.table, cell.row! + 1, cell.col! + 1);
    const wrapped = below?.text && !belowValue?.text ? `${cell.text} ${below.text}` : null;
    const labelText = norm(cell.text) === norm(label) ? cell.text : wrapped && norm(wrapped) === norm(label) ? wrapped : null;
    if (!labelText) return;
    // A one- or two-letter label ("V", "HV", "VP") counts only as a row label (first filled cell),
    // never as a column header such as "|  | A | V |".
    if (label.length <= 2) {
      const first = segs.find((s) => s.table === cell.table && s.row === cell.row && s.text);
      if (first !== cell) return;
    }
    let col = cell.col! + 1;
    if (spec.column) {
      const c = columnIndex(segs, cell, spec.column, known);
      if (c === 'no-header') {
        if (!spec.columnOptional) return;
      } else {
        if (c === null || c <= cell.col!) return;
        col = c;
      }
    }
    const v = cellAt(segs, cell.table, cell.row!, col);
    if (!v) return;
    out.push({ labelText, value: v, idx, row: segs.filter((s) => s.table === cell.table && s.row === cell.row) });
  });
  return out;
}

function inTables(page: OcrPage, segs: Segment[], label: string, spec: ExtractionSpec, known: readonly string[]): Found[] {
  const out: Found[] = [];
  const units = [spec.unit, ...(spec.alternatives ?? []).map((a) => a.unit), ...Object.values(spec.unitField?.units ?? {}).flat()]
    .filter(Boolean)
    .map(normaliseUnit);
  for (const { labelText, value: v, idx, row } of pairs(segs, label, spec, known)) {
    // "590 Ω (Bi)", "73 Ω (RV zu Gehäuse)": a trailing remark in brackets is not part of the value.
    const cellText = v.text.replace(/\s*\([^()]*\)\s*$/, '');
    if (spec.pattern) {
      const pm = new RegExp(spec.pattern, 'i').exec(v.text);
      if (!pm?.[1]) continue;
      const offset = pm.index + pm[0].indexOf(pm[1]);
      out.push({ rawText: `${labelText} ${v.text}`, valueText: pm[1], unitText: spec.unit, from: v.start + offset, to: v.start + offset + pm[1].length, box: blockFor(page, v.start)?.box ?? null, seg: idx });
      continue;
    }
    const partNo = spec.parts?.[label];
    if (partNo !== undefined) {
      // "Stimulation in A/V [%] | 1/14": one part of an "a/b" pair.
      const pm = /^(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)\s*(%?)$/.exec(cellText);
      if (!pm) continue;
      const part = pm[partNo + 1]!;
      const offset = v.text.indexOf(part, partNo === 1 ? pm[1]!.length : 0);
      out.push({ rawText: `${labelText} ${v.text}`, valueText: part, unitText: pm[3] ?? '', from: v.start + offset, to: v.start + offset + part.length, box: blockFor(page, v.start)?.box ?? null, seg: idx });
      continue;
    }
    const m = VALUE_CELL.exec(cellText);
    if (!m) continue;
    let unitText = m[2] ?? '';
    // Unit in its own cell ("| 58 | % |") only when it is a unit this field accepts.
    const next = row.find((s) => s.col === v.col! + 1);
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
  }
  return out;
}

/** "Label: value" in a text line or a single table cell. */
function inLines(page: OcrPage, segs: Segment[], label: string, spec: ExtractionSpec, known: readonly string[] = []): Found[] {
  const tail = spec.trailing ? String.raw`(?:[\s,;(].*)?$` : String.raw`\s*(?:\([^()]*\))?\s*$`;
  const re = new RegExp(`^${escape(label)}\\s*[:=]?\\s*${VALUE}(?:\\s+(?:at|bei|@)\\s+${VALUE})?${tail}`, 'id');
  const out: Found[] = [];
  // A label cell and its value cell read as one line: values with text after them ("8 J. 5 Mo.") or two
  // values ("0,75V @ 0,5ms (Bi)").
  const lines = segs.map((seg, idx) => ({ seg, idx }));
  if (spec.parts?.[label] === undefined) {
    for (const p of pairs(segs, label, spec, known)) {
      lines.push({ seg: { text: `${label} ${p.value.text}`, start: p.value.start - label.length - 1 }, idx: p.idx });
    }
  }
  lines.forEach(({ seg, idx }) => {
    const m = re.exec(seg.text);
    if (!m) return;
    const g = spec.second ? 5 : 1; // groups 1–4: first value, 5–8: value after "at"/"bei"
    if (m[g] === undefined) return;
    const [n1, u1, n2, u2] = [m[g], m[g + 1], m[g + 2], m[g + 3]];
    if (u1 && u2 && normaliseUnit(u1) !== normaliseUnit(u2)) return; // "5 mV - 8 ms": not one range
    const from = seg.start + m.indices![g]![0];
    let to = seg.start + m.indices![n2 !== undefined ? g + 2 : g]![1];
    let valueText = n2 !== undefined ? `${n1} - ${n2}` : n1!;
    let value: Qualified | undefined;
    // "8 J. 5 Mo.": the second part is added (in code, never by a model).
    const end = m.indices![u1 !== undefined ? g + 1 : g]![1];
    const cm = spec.compound && n2 === undefined ? /^\s*(\d+(?:[.,]\d+)?)\s*(\S+)/.exec(seg.text.slice(end)) : null;
    if (cm && spec.compound!.units.map(normaliseUnit).includes(normaliseUnit(cm[2]!))) {
      const major = parseDecimal(n1!);
      const minor = parseDecimal(cm[1]!);
      if (major === null || minor === null || /[<>]/.test(n1!)) return;
      const f = 10 ** spec.compound!.decimals;
      value = { q: null, a: Math.round((major + minor * spec.compound!.factor) * f) / f };
      valueText = seg.text.slice(m.indices![g]![0], end + cm[0].length).trim();
      to = seg.start + end + cm[0].length;
    }
    out.push({
      rawText: seg.text,
      valueText,
      unitText: u2 ?? u1 ?? '',
      from,
      to,
      box: blockFor(page, from)?.box ?? null,
      seg: idx,
      value,
    });
  });
  return out;
}

/** Label block and value block side by side on the same row (vertical overlap, value to the right). */
function inBlockPairs(page: OcrPage, segs: Segment[], label: string, partNo?: 0 | 1): Found[] {
  const out: Found[] = [];
  const textBlocks = page.blocks.filter((b) => b.type !== 'table' && b.start >= 0);
  for (const lb of textBlocks) {
    if (norm(lb.content) !== norm(label)) continue;
    const [, ly0, lx1, ly1] = lb.box;
    const right = textBlocks
      .filter((b) => b !== lb && b.box[0] >= lx1 && Math.min(ly1, b.box[3]) - Math.max(ly0, b.box[1]) > 0.5 * (ly1 - ly0))
      .sort((a, b) => a.box[0] - b.box[0])[0];
    if (!right) continue;
    const box: [number, number, number, number] = [
      Math.min(lb.box[0], right.box[0]),
      Math.min(lb.box[1], right.box[1]),
      Math.max(lb.box[2], right.box[2]),
      Math.max(lb.box[3], right.box[3]),
    ];
    if (partNo !== undefined) {
      const pm = /^(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)\s*(%?)$/.exec(right.content.trim());
      if (!pm) continue;
      const part = pm[partNo + 1]!;
      const offset = right.content.indexOf(part, partNo === 1 ? right.content.indexOf('/') : 0);
      out.push({ rawText: `${lb.content.trim()} ${right.content.trim()}`, valueText: part, unitText: pm[3] ?? '', from: right.start + offset, to: right.start + offset + part.length, box, seg: segs.findIndex((s) => s.start === lb.start) });
      continue;
    }
    const m = VALUE_CELL.exec(right.content.trim());
    if (!m) continue;
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
        const tables = inTables(page, segs, label, spec, known);
        // A value already read as a table pair (with its unit cell) is not read again as a line.
        // A pattern field is read from its table cell only.
        const lines = spec.pattern ? [] : inLines(page, segs, label, spec, known).filter((l) => !tables.some((t) => t.from === l.from));
        // Side-by-side blocks carry no column information: never used for a field bound to a column
        // (otherwise "Elektrodenimpedanz [Ω]" would pair with the atrial value for the RV field, D-83).
        const blocks = spec.column ? [] : inBlockPairs(page, segs, label, spec.parts?.[label]);
        const all = [...tables, ...lines, ...blocks];
        for (const f of all) {
          if (spec.section) {
            const h = f.seg >= 0 ? sectionOf(segs, f.seg, module.sections ?? []) : null;
            if (!h || !spec.section.some((s) => norm(s) === norm(h))) continue;
          }
          const value = f.value ?? parseValue(f.valueText);
          if (!value) continue;
          // Biotronik prints the unit in the label ("Elektrodenimpedanz [Ω] | 604").
          const labelUnit = /\[([^\]]+)\]\s*$/.exec(label)?.[1];
          if (!f.unitText && labelUnit) f.unitText = labelUnit;
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

/** A page is preferred if one of its lines (or first cells) is a marker, e.g. the title "Final Report". */
function startsWithAnyLine(text: string, markers: readonly string[] | undefined): boolean {
  if (!markers?.length) return false;
  return text.split('\n').some((l) => {
    const t = norm(l.replace(/^[|#\s]+/, '').split('|')[0]!);
    return markers.some((m) => norm(m) === t);
  });
}

// ---- Choice, text and date fields (D-83) -------------------------------------

/** The value text after a label: cut before a stop word (e.g. "Serial Number"), trimmed. */
function cutValue(text: string, stopAt: readonly string[] | undefined): string {
  let end = text.length;
  for (const w of stopAt ?? []) {
    const i = text.toLowerCase().indexOf(w.toLowerCase());
    if (i >= 0 && i < end) end = i;
  }
  return text.slice(0, end).replace(/[\s:;,]+$/, '').trim();
}

/**
 * Value text next to (or below) a label, for choice, text and date fields. The same
 * provenance as for numbers: page, box, the source text and the word confidences.
 */
export function findValueCandidates(ocr: OcrResult, fieldKey: string, spec: ValueExtractionSpec, module: ModuleExtraction = {}): Candidate[] {
  const preferred = ocr.pages.filter((p) => startsWithAnyLine(p.text, module.preferPages));
  const pageSets = preferred.length ? [preferred, ocr.pages] : [ocr.pages];
  const known = (module.columns ?? []) as readonly string[];
  for (const pages of pageSets) {
    // A choice is decided by its mapping rules, so all labels count (the "Implantat" line names no
    // manufacturer; the "BIOTRONIK" letterhead does). Text and date fields: the first label found wins.
    const choices: Candidate[] = [];
    for (const label of spec.labels) {
      const found: Candidate[] = [];
      for (const page of pages) {
        const segs = segments(page);
        const hits: Found[] = [];
        const add = (rawText: string, seg: Segment, segIdx: number, valueText: string, offset: number) => {
          if (!valueText) return;
          const from = seg.start + offset;
          hits.push({ rawText, valueText, unitText: '', from, to: from + valueText.length, box: blockFor(page, from)?.box ?? null, seg: segIdx });
        };
        if (spec.presence?.includes(label)) {
          segs.forEach((seg, i) => {
            if (norm(seg.text).startsWith(norm(label))) add(seg.text, seg, i, seg.text.slice(0, label.length), 0);
          });
        } else {
          // Table: label cell, value in the next cell or the named column.
          for (const { labelText, value: v, idx } of pairs(segs, label, spec, known)) {
            const valueText = cutValue(v.text, spec.stopAt);
            add(`${labelText} ${valueText}`, v, idx, valueText, v.text.indexOf(valueText));
          }
          // Line or single cell: "Label: value".
          const re = new RegExp(`^${escape(label)}\\s*[:=]?\\s+(\\S.*)$`, 'i');
          segs.forEach((seg, i) => {
            const m = re.exec(seg.text);
            if (!m) return;
            const valueText = cutValue(m[1]!, spec.stopAt);
            add(`${label} ${valueText}`, seg, i, valueText, seg.text.length - m[1]!.length);
          });
          // Value on the next line: "Indikationen für die Implantation" / "Kammerflimmern, …".
          if (spec.below) {
            segs.forEach((seg, i) => {
              if (norm(seg.text) !== norm(label)) return;
              // The cell below in a table; the next line outside tables.
              const next = seg.table !== undefined ? cellAt(segs, seg.table, seg.row! + 1, seg.col!) : segs[i + 1]?.table === undefined ? segs[i + 1] : undefined;
              if (!next) return;
              const valueText = cutValue(next.text, spec.stopAt);
              add(`${seg.text} ${valueText}`, next, i, valueText, next.text.indexOf(valueText));
            });
          }
        }
        for (const f of hits) {
          if (spec.section) {
            const h = f.seg >= 0 ? sectionOf(segs, f.seg, module.sections ?? []) : null;
            if (!h || !spec.section.some((x) => norm(x) === norm(h))) continue;
          }
          found.push({
            fieldKey,
            label,
            rawText: f.rawText,
            valueText: f.valueText,
            value: null,
            unitText: '',
            page: page.index,
            box: f.box,
            pageSize: { width: page.width, height: page.height },
            confidence: confidenceFor(page, f.from, f.to),
          });
        }
      }
      if (found.length && spec.kind !== 'choice') return dedupe(found);
      choices.push(...found);
    }
    if (choices.length) return dedupe(choices);
  }
  return [];
}
