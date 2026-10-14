// End-to-end: a TTE documented by keyboard, report preview, sentence edit,
// and all three exports with the TESTDATEN marker.
import { _electron as electron, expect, test } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TESTDATEN_MARKER } from '../../src/shared/mode';

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'kardio-e2e-tte-'));
const exportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kardio-e2e-export-'));
const shots = process.env.KARDIO_SCREENSHOTS;

test.afterAll(() => {
  for (const dir of [userData, exportDir]) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // Windows may still lock the database while the app closes.
    }
  }
});

test('TTE: entry, report, edit, export', async () => {
  const args = process.platform === 'linux' ? ['--no-sandbox', '.'] : ['.'];
  const app = await electron.launch({
    args,
    env: { ...process.env, KARDIO_E2E_USER_DATA: userData, KARDIO_E2E_EXPORT_DIR: exportDir },
  });
  const page = await app.firstWindow();
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.waitForSelector('header');

  await page.keyboard.press('Control+n');
  await page.keyboard.type('Test');
  await page.keyboard.press('Tab');
  await page.keyboard.type('Max');
  await page.keyboard.press('Tab');
  await page.keyboard.type('03.04.1955');
  await page.keyboard.press('Tab');
  await page.locator('#p-sex').selectOption('männlich');
  await page.keyboard.press('Control+u');
  await page.keyboard.press('Enter');

  const preview = page.getByTestId('report-preview');
  await expect(preview).toContainText('Transthorakale Echokardiographie:');

  await page.locator('#f-indication').selectOption('Dyspnoe');
  // Numbers by keyboard; Enter moves on, decimal comma accepted.
  await page.locator('#f-lvedd').click();
  for (const v of ['61', '38', '12', '10', '58,5']) {
    await page.keyboard.type(v);
    await page.keyboard.press('Enter');
  }
  await expect(page.locator('#f-lvedd')).toHaveClass(/border-amber-500/); // out of range, highlighted only
  await page.locator('#f-tapse').fill('15');
  await page.locator('#f-tasv').fill('11');

  // Alles normal for the whole study fills the remaining selects.
  await page.keyboard.press('Alt+Shift+N');
  await expect(preview).toContainText('Der LVEDD ist leicht dilatiert, der LVESD ist normal dimensioniert.');
  await expect(preview).toContainText('Das Septum ist leicht hypertrophiert, die Hinterwand ist normwertig.');
  await expect(preview).toContainText('Die globale systolische Pumpfunktion ist normal.');
  await expect(preview).toContainText('Die rechtsventrikuläre systolische Funktion ist normal.');
  await expect(preview).toContainText('LVEF 58,5 %');
  await expect(page.locator('#f-lvedd_dim')).toHaveValue('leicht dilatiert'); // auto category wins over "normal"

  // Edit one sentence; the edit is stored and wins.
  await preview.getByText('Kein Perikarderguss.', { exact: true }).click();
  await page.keyboard.press('Control+a');
  await page.keyboard.type('Kein Perikarderguss nachweisbar.');
  await page.keyboard.press('Enter');
  await expect(preview).toContainText('Kein Perikarderguss nachweisbar.');
  if (shots) await page.screenshot({ path: path.join(shots, 'm2-tte.png') });

  await page.keyboard.press('Control+Shift+C');
  await expect(page.getByText('Befund in die Zwischenablage kopiert.')).toBeVisible();
  const clip = await app.evaluate(({ clipboard }) => clipboard.readText());
  expect(clip.split(/\r?\n/)[0]).toBe(TESTDATEN_MARKER);
  expect(clip).toContain('Kein Perikarderguss nachweisbar.');
  expect(clip).toContain('Indikation: Dyspnoe');

  await page.getByRole('button', { name: /^DOCX/ }).click();
  await expect(page.getByText('Gespeichert: export.docx')).toBeVisible();
  await page.getByRole('button', { name: /^PDF/ }).click();
  await expect(page.getByText('Gespeichert: export.pdf')).toBeVisible();
  expect(fs.statSync(path.join(exportDir, 'export.docx')).size).toBeGreaterThan(3000);
  expect(fs.readFileSync(path.join(exportDir, 'export.pdf')).subarray(0, 4).toString()).toBe('%PDF');

  // Persistence: reopen the study.
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Transthorakale Echokardiographie (TTE)' }).click();
  await expect(preview).toContainText('Kein Perikarderguss nachweisbar.');
  await expect(page.locator('#f-lvef')).toHaveValue('58,5');
  await app.close();
});
