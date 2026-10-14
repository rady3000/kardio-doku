// Report exports: clipboard (primary), DOCX, PDF. The main process rebuilds
// the report from the stored study and applies the TESTDATEN marker from its
// own Betriebsmodus, so the renderer cannot export without it.
import { BrowserWindow, clipboard, dialog, app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { formatGermanDate } from '../shared/dates';
import type { Betriebsmodus } from '../shared/mode';
import type { ExportFormat, ExportResult, Patient, Study } from '../shared/types';
import { clipboardText } from '../core/export/clipboard';
import { docxBuffer } from '../core/export/docx';
import { PDF_FOOTER_TEMPLATE, pdfHeaderTemplate, reportToHtml } from '../core/export/html';
import { exportFileName, type ExportMeta } from '../core/export/meta';
import { reportToText } from '../core/report';
import { buildStudyReport } from '../core/studyReport';

function patientLine(p: Patient): string {
  const name = [p.lastName, p.firstName].filter((s) => s.trim()).join(', ') || '(ohne Namen)';
  return `Patient: ${name}${p.birthDate ? `, geb. ${formatGermanDate(p.birthDate)}` : ''}`;
}

export async function exportStudy(
  win: BrowserWindow | null,
  study: Study,
  patient: Patient,
  mode: Betriebsmodus,
  format: ExportFormat,
  /** For tests: write here instead of asking. */
  targetPath?: string,
): Promise<ExportResult> {
  const report = buildStudyReport(study, patient);
  if (!report) return { ok: false, message: 'Für dieses Modul gibt es noch kein Formular.' };
  if (report.blockers.length) {
    return { ok: false, message: `Export gesperrt – unbestätigte Werte: ${report.blockers.join(', ')}` };
  }
  const text = reportToText(report.model);

  if (format === 'clipboard') {
    clipboard.writeText(clipboardText(text, mode, process.platform));
    return { ok: true, message: 'Befund in die Zwischenablage kopiert.' };
  }

  const meta: ExportMeta = {
    mode,
    patientLine: patientLine(patient),
    studyDate: formatGermanDate(study.studyDate),
    appVersion: app.getVersion(),
  };
  const fileName = exportFileName(study.moduleKey, study.studyDate, study.id, format);
  let file = targetPath;
  if (!file) {
    const options = {
      defaultPath: path.join(app.getPath('documents'), fileName),
      filters: [format === 'docx' ? { name: 'Word-Dokument', extensions: ['docx'] } : { name: 'PDF', extensions: ['pdf'] }],
    };
    const res = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options);
    if (res.canceled || !res.filePath) return { ok: false, message: 'Export abgebrochen.' };
    file = res.filePath;
  }

  if (format === 'docx') {
    fs.writeFileSync(file, await docxBuffer(report.model, meta));
  } else {
    fs.writeFileSync(file, await renderPdf(reportToHtml(report.model, meta), meta));
  }
  return { ok: true, message: `Gespeichert: ${path.basename(file)}`, path: file };
}

async function renderPdf(html: string, meta: ExportMeta): Promise<Buffer> {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, javascript: false, contextIsolation: true, nodeIntegration: false, spellcheck: false },
  });
  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    return await win.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: pdfHeaderTemplate(meta),
      footerTemplate: PDF_FOOTER_TEMPLATE,
      margins: { top: 0.75, bottom: 0.75, left: 0.7, right: 0.7 },
    });
  } finally {
    win.destroy();
  }
}
