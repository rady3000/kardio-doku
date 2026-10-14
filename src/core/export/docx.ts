// DOCX export. In TESTBETRIEB the TESTDATEN marker is the document header
// (on every page; gateway §2.4).
import {
  AlignmentType,
  Document,
  Footer,
  Header,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  BorderStyle,
} from 'docx';
import { TESTDATEN_MARKER } from '../../shared/mode';
import { sectionLines, type ReportModel, type ReportSection } from '../report';
import type { ExportMeta } from './meta';

const FONT = 'Arial';
const run = (text: string, opts: { bold?: boolean; size?: number; color?: string } = {}) =>
  new TextRun({ text, font: FONT, size: opts.size ?? 20, bold: opts.bold, color: opts.color });

/** A paragraph; "\n" inside the text becomes a line break. */
function para(label: string | undefined, text: string, after = 80): Paragraph {
  const parts = text.split('\n');
  const children: TextRun[] = [];
  if (label) children.push(run(`${label} `, { bold: true }));
  parts.forEach((p, i) => children.push(new TextRun({ text: p, font: FONT, size: 20, break: i > 0 ? 1 : undefined })));
  return new Paragraph({ children, spacing: { after } });
}

function sections(list: readonly ReportSection[]): Paragraph[] {
  const out: Paragraph[] = [];
  for (const s of list) {
    const lines = sectionLines(s);
    if (!lines.length) continue;
    if (s.heading) out.push(new Paragraph({ children: [run(s.heading, { bold: true })], spacing: { before: 160, after: 40 } }));
    for (const l of lines) out.push(para(l.label, l.text));
  }
  return out;
}

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const cell = (text: string, bold = false, span = 1) =>
  new TableCell({
    columnSpan: span,
    borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER },
    children: [new Paragraph({ children: [run(text, { bold, size: 18 })] })],
  });

export function buildDocx(model: ReportModel, meta: ExportMeta): Document {
  const test = meta.mode === 'TESTBETRIEB';
  const groups = model.measurements.filter((g) => g.items.length);
  const measurement: (Paragraph | Table)[] = groups.length
    ? [
        new Paragraph({ children: [run(model.measurementsHeading, { bold: true })], spacing: { before: 160, after: 40 } }),
        new Table({
          width: { size: 70, type: WidthType.PERCENTAGE },
          rows: groups.flatMap((g) => [
            new TableRow({ children: [cell(g.label.replace(/:$/, ''), true, 2)] }),
            ...g.items.map((i) => new TableRow({ children: [cell(i.label), cell(`${i.value}${i.unit ? ` ${i.unit}` : ''}`)] })),
          ]),
        }),
      ]
    : [];

  const footerLines = [
    model.rulesUsed.length
      ? `Regelwerke: ${model.rulesUsed.map((r) => `${r.id} v${r.version} (geprüft ${r.reviewedOn})`).join(', ')}`
      : '',
    `Erstellt mit Kardio-Doku ${meta.appVersion} – Prototyp, kein Medizinprodukt.`,
  ].filter(Boolean);

  return new Document({
    creator: 'Kardio-Doku',
    title: model.title,
    sections: [
      {
        properties: { page: { margin: { top: 1134, bottom: 1134, left: 1021, right: 1021 } } },
        headers: {
          default: new Header({
            children: test
              ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [run(TESTDATEN_MARKER, { bold: true, color: 'B45309' })] })]
              : [new Paragraph({ children: [] })],
          }),
        },
        footers: {
          default: new Footer({ children: footerLines.map((l) => new Paragraph({ children: [run(l, { size: 14, color: '555555' })] })) }),
        },
        children: [
          new Paragraph({ children: [run(model.title.replace(/:$/, ''), { bold: true, size: 26 })], spacing: { after: 60 } }),
          new Paragraph({ children: [run(meta.patientLine)] }),
          new Paragraph({ children: [run(`Untersuchungsdatum: ${meta.studyDate}`)], spacing: { after: 160 } }),
          ...sections(model.head),
          ...measurement,
          ...sections(model.body),
        ],
      },
    ],
  });
}

export async function docxBuffer(model: ReportModel, meta: ExportMeta): Promise<Buffer> {
  return Packer.toBuffer(buildDocx(model, meta));
}
