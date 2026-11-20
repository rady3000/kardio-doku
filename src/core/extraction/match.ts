// Deterministic label matching on OCR text (D-76 a). No model interprets the
// document: a value is taken only where a known label is followed by a number,
// so every value carries its page, box and the exact source line.
import { parseDecimal, parseQualified, type Qualified } from '../format';
import type { OcrPage, OcrResult } from './ocr';
import type { ExtractionSpec } from './spec';

export interface Candidate {
  fieldKey: string;
  label: string;
  /** The source line as printed (table cells joined with spaces). */
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

interface Line {
  text: string;
  /** Offset of each character of `text` in the page text. */
  offsets: number[];
}

const NUMBER = String.raw`[<>]?\s*-?\d+(?:[.,]\d+)?(?:\s*(?:-|–|bis|to)\s*\d+(?:[.,]\d+)?)?`;

/** Splits the page text into lines; a markdown table row becomes its cells joined by single spaces. */
function lines(page: OcrPage): Line[] {
  const out: Line[] = [];
  let pos = 0;
  for (const raw of page.text.split('\n')) {
    const start = pos;
    pos += raw.length + 1;
    const trimmed = raw.trim();
    if (!trimmed || /^\|?\s*:?-{3,}/.test(trimmed)) continue;
    let text = '';
    const offsets: number[] = [];
    const push = (s: string, at: number) => {
      for (let i = 0; i < s.length; i++) {
        text += s[i];
        offsets.push(at + i);
      }
    };
    if (trimmed.startsWith('|')) {
      let cellStart = raw.indexOf('|') + 1;
      for (const cell of raw.slice(cellStart).split('|')) {
        const lead = cell.length - cell.trimStart().length;
        const value = cell.trim();
        if (value) {
          if (text) push(' ', start + cellStart - 1);
          push(value, start + cellStart + lead);
        }
        cellStart += cell.length + 1;
      }
    } else {
      const lead = raw.length - raw.trimStart().length;
      const body = trimmed.replace(/^(#+|[-*])\s+/, '');
      push(body, start + lead + (trimmed.length - body.length));
    }
    if (text) out.push({ text, offsets });
  }
  return out;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function confidenceFor(page: OcrPage, from: number, to: number): number | null {
  const words = page.words.filter((w) => w.start < to && w.start + w.text.length > from);
  if (words.length) return Math.min(...words.map((w) => w.confidence));
  const block = blockFor(page, from);
  return block?.minConfidence ?? null;
}

function blockFor(page: OcrPage, offset: number) {
  return page.blocks.find((b) => b.start >= 0 && offset >= b.start && offset < b.start + b.content.length) ?? null;
}

/** All label matches for one field, in label priority order. */
export function findCandidates(ocr: OcrResult, fieldKey: string, spec: ExtractionSpec): Candidate[] {
  const found: Candidate[] = [];
  for (const label of spec.labels) {
    // Label at the start of a line or cell row, then optional ":" / "=", then the number and an optional unit.
    const re = new RegExp(`^${escape(label)}\\s*[:=]?\\s*(${NUMBER})\\s*([^\\s\\d][^\\s]*)?\\s*$`, 'i');
    for (const page of ocr.pages) {
      for (const line of lines(page)) {
        const m = re.exec(line.text);
        if (!m) continue;
        const valueText = m[1]!;
        const text = valueText.replace(/\s+/g, ' ');
        const negative = parseDecimal(text);
        const value: Qualified | null = parseQualified(text) ?? (negative !== null ? { q: null, a: negative } : null);
        if (!value) continue;
        const vStart = line.text.indexOf(valueText, label.length);
        const from = line.offsets[vStart]!;
        const to = line.offsets[vStart + valueText.length - 1]! + 1;
        const block = blockFor(page, from);
        found.push({
          fieldKey,
          label,
          rawText: line.text,
          valueText,
          value,
          unitText: m[2] ?? '',
          page: page.index,
          box: block ? block.box : null,
          pageSize: { width: page.width, height: page.height },
          confidence: confidenceFor(page, from, to),
        });
      }
    }
    if (found.length) break; // higher-priority label found: lower ones are not used
  }
  return found;
}
