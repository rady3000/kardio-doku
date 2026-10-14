// Gateway test §7.3 — the TESTDATEN marker in every export path (clipboard
// first line, DOCX header, PDF watermark and page header), and none in
// ECHTBETRIEB. File names carry no patient data (D-44).
import { describe, expect, it } from 'vitest';
import { clipboardText } from '../../src/core/export/clipboard';
import { docxBuffer } from '../../src/core/export/docx';
import { pdfHeaderTemplate, reportToHtml } from '../../src/core/export/html';
import { exportFileName, type ExportMeta } from '../../src/core/export/meta';
import { reportToText } from '../../src/core/report';
import { TESTDATEN_MARKER } from '../../src/shared/mode';
import { run } from '../helpers/tte';
import { unzip } from '../helpers/unzip';

const { model } = run({ indication: 'Dyspnoe', lvef: 60, perikarderguss: 'kein Perikarderguss', lvedd: 50 });
const meta = (mode: ExportMeta['mode']): ExportMeta => ({
  mode,
  patientLine: 'Patient: Test, Max, geb. 01.02.1950',
  studyDate: '14.10.2026',
  appVersion: '0.2.0',
});

describe('clipboard', () => {
  it('TESTBETRIEB: marker is the first line, CRLF on Windows', () => {
    const t = clipboardText(reportToText(model), 'TESTBETRIEB', 'win32');
    expect(t.split('\r\n')[0]).toBe(TESTDATEN_MARKER);
    expect(t).not.toMatch(/[^\r]\n/);
  });
  it('ECHTBETRIEB: no marker', () => {
    expect(clipboardText(reportToText(model), 'ECHTBETRIEB', 'linux')).not.toContain('TESTDATEN');
  });
});

describe('PDF (HTML for Chromium print)', () => {
  it('TESTBETRIEB: watermark and marker on every page', () => {
    const html = reportToHtml(model, meta('TESTBETRIEB'));
    expect(html).toContain('class="watermark"');
    expect(html).toContain(TESTDATEN_MARKER);
    expect(pdfHeaderTemplate(meta('TESTBETRIEB'))).toContain(TESTDATEN_MARKER);
  });
  it('ECHTBETRIEB: no marker', () => {
    expect(reportToHtml(model, meta('ECHTBETRIEB'))).not.toContain('TESTDATEN');
    expect(pdfHeaderTemplate(meta('ECHTBETRIEB'))).not.toContain('TESTDATEN');
  });
  it('contains the report text, the measurement table and the rule sets', () => {
    const html = reportToHtml(model, meta('TESTBETRIEB'));
    expect(html).toContain('Die globale systolische Pumpfunktion ist normal.');
    expect(html).toContain('<td>LVEF</td><td>60 %</td>');
    expect(html).toContain('tte-lvef v1');
  });
  it('escapes entered text', () => {
    const r = run({ indication: 'Sonstige (Freitext)', indication_text: '<script>x</script>' }).model;
    expect(reportToHtml(r, meta('TESTBETRIEB'))).not.toContain('<script>x');
  });
});

describe('DOCX', () => {
  it('TESTBETRIEB: marker in the page header', async () => {
    const files = unzip(await docxBuffer(model, meta('TESTBETRIEB')));
    const headers = [...files].filter(([n]) => /word\/header\d*\.xml$/.test(n)).map(([, c]) => c).join();
    expect(headers).toContain(TESTDATEN_MARKER);
    expect(files.get('word/document.xml')).toContain('Die globale systolische Pumpfunktion ist normal.');
  });
  it('ECHTBETRIEB: no marker anywhere', async () => {
    const files = unzip(await docxBuffer(model, meta('ECHTBETRIEB')));
    expect([...files.values()].join()).not.toContain('TESTDATEN');
  });
});

describe('file names', () => {
  it('carry no patient data', () => {
    expect(exportFileName('tte', '2026-10-14', 7, 'pdf')).toBe('TTE_2026-10-14_U7.pdf');
  });
});
