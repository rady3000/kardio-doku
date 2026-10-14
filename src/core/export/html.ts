// Printable HTML of a report, rendered to PDF by the main process. In
// TESTBETRIEB every page carries the TESTDATEN marker (watermark and page
// header; gateway §2.4).
import { TESTDATEN_MARKER } from '../../shared/mode';
import { sectionLines, type ReportModel } from '../report';
import type { ExportMeta } from './meta';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const br = (s: string) => esc(s).replace(/\n/g, '<br>');

export function reportToHtml(model: ReportModel, meta: ExportMeta): string {
  const test = meta.mode === 'TESTBETRIEB';
  const sections = (list: ReportModel['body']) =>
    list
      .map((s) => {
        const lines = sectionLines(s);
        if (!lines.length) return '';
        const heading = s.heading ? `<h2>${esc(s.heading)}</h2>` : '';
        const body = lines
          .map((l) => `<p>${l.label ? `<strong>${esc(l.label)}</strong> ` : ''}${br(l.text)}</p>`)
          .join('');
        return `<section>${heading}${body}</section>`;
      })
      .join('');

  const groups = model.measurements.filter((g) => g.items.length);
  const table = groups.length
    ? `<section><h2>${esc(model.measurementsHeading)}</h2><table>${groups
        .map(
          (g) =>
            `<tr><th colspan="2">${esc(g.label.replace(/:$/, ''))}</th></tr>` +
            g.items.map((i) => `<tr><td>${esc(i.label)}</td><td>${esc(i.value)}${i.unit ? ` ${esc(i.unit)}` : ''}</td></tr>`).join(''),
        )
        .join('')}</table></section>`
    : '';

  const rules = model.rulesUsed.length
    ? `<footer><div>Regelwerke: ${model.rulesUsed
        .map((r) => `${esc(r.id)} v${r.version} (geprüft ${esc(r.reviewedOn)})`)
        .join(', ')}</div><div>Erstellt mit Kardio-Doku ${esc(meta.appVersion)} – Prototyp, kein Medizinprodukt.</div></footer>`
    : `<footer><div>Erstellt mit Kardio-Doku ${esc(meta.appVersion)} – Prototyp, kein Medizinprodukt.</div></footer>`;

  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>${esc(model.title)}</title><style>
@page { size: A4; margin: 20mm 18mm; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #111; line-height: 1.35; }
h1 { font-size: 13pt; margin: 0 0 2mm; }
h2 { font-size: 10pt; margin: 4mm 0 1mm; }
p { margin: 0 0 1.5mm; }
.meta { color: #333; margin-bottom: 4mm; }
table { border-collapse: collapse; font-size: 9pt; }
th { text-align: left; padding: 1.5mm 0 0.5mm; }
td { padding: 0.3mm 6mm 0.3mm 0; }
footer { margin-top: 8mm; font-size: 7.5pt; color: #555; }
.marker { color: #b45309; font-weight: bold; text-align: center; margin-bottom: 3mm; }
.watermark { position: fixed; top: 45%; left: 0; right: 0; text-align: center; transform: rotate(-30deg);
  font-size: 34pt; font-weight: bold; color: rgba(180, 83, 9, 0.13); white-space: nowrap; }
</style></head><body>
${test ? `<div class="watermark">TESTDATEN</div><div class="marker">${esc(TESTDATEN_MARKER)}</div>` : ''}
<h1>${esc(model.title.replace(/:$/, ''))}</h1>
<div class="meta">${esc(meta.patientLine)}<br>Untersuchungsdatum: ${esc(meta.studyDate)}</div>
${sections(model.head)}${table}${sections(model.body)}${rules}
</body></html>`;
}

/** Page header for Chromium's PDF printer: the marker on every page in TESTBETRIEB. */
export function pdfHeaderTemplate(meta: ExportMeta): string {
  return meta.mode === 'TESTBETRIEB'
    ? `<div style="font-size:8px;width:100%;text-align:center;color:#b45309;font-weight:bold;font-family:Arial">${esc(TESTDATEN_MARKER)}</div>`
    : '<div></div>';
}

export const PDF_FOOTER_TEMPLATE =
  '<div style="font-size:7px;width:100%;text-align:right;padding-right:18mm;color:#555;font-family:Arial">Seite <span class="pageNumber"></span> / <span class="totalPages"></span></div>';
