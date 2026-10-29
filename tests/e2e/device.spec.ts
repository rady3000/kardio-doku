// End-to-end: a Device-Abfrage entered by keyboard and mouse, with qualified
// values, device-type visibility, the "regelrecht" warning and the clipboard.
import { _electron as electron, expect, test } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TESTDATEN_MARKER } from '../../src/shared/mode';

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'kardio-e2e-dev-'));
const shots = process.env.KARDIO_SCREENSHOTS;

test.afterAll(() => {
  try {
    fs.rmSync(userData, { recursive: true, force: true });
  } catch {
    // Windows may still lock the database while the app closes.
  }
});

test('Device-Abfrage: entry, report, warning, clipboard', async () => {
  const args = process.platform === 'linux' ? ['--no-sandbox', '.'] : ['.'];
  const app = await electron.launch({ args, env: { ...process.env, KARDIO_E2E_USER_DATA: userData } });
  const page = await app.firstWindow();
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.waitForSelector('header');

  await page.keyboard.press('Control+n');
  await expect(page.locator('#p-last')).toBeFocused();
  await page.keyboard.type('Muster');
  await page.keyboard.press('Tab');
  await page.keyboard.type('Erika');
  await page.locator('#p-sex').selectOption('weiblich');
  await page.keyboard.press('Control+u');
  await page.locator('form select').selectOption('device');
  await page.getByRole('button', { name: 'Anlegen' }).click();

  const preview = page.getByTestId('report-preview');
  await expect(preview).toContainText('Device-Abfrage:');
  await expect(page.getByText('Muster, Erika, weiblich')).toBeVisible(); // study header shows the saved patient

  await page.locator('#f-device_type').selectOption('DDD-SM');
  await expect(page.locator('#f-crt_lv_impedance')).toHaveCount(0); // CRT section hidden for a pacemaker
  await page.locator('#f-pacing_mode').selectOption('DDDR');
  await page.locator('#f-device_company').selectOption('Vitatron');
  await page.locator('#f-device_model').fill('Q50A2');
  await page.locator('#f-implantation_date').fill('3.5.2021');
  await page.locator('#f-implantation_date').press('Tab');
  await page.locator('#f-device_indication').selectOption('Sick-Sinus-Syndrom');
  await page.locator('#f-sensing_ra').fill('> 2,8');
  await page.locator('#f-sensing_rv').fill('3,9');
  await expect(page.locator('#f-sensing_rv')).toHaveClass(/border-amber-500/);
  await page.locator('#f-conclusion').selectOption('Regelrechte Aggregat- und Sondenfunktion');
  await page.keyboard.press('Alt+Shift+N');

  await expect(preview).toContainText('Abfrage eines DDD-SM (Vitatron Q50A2). Programmierter Modus: DDDR. Das Aggregat wurde am 03.05.2021 bei Sick-Sinus-Syndrom implantiert.');
  await expect(preview).toContainText('Die Patientin ist in gutem Allgemeinzustand und beschwerdefrei.');
  await expect(preview).toContainText('Wahrnehmung: RA > 2,8 mV / RV 3,9 mV.');
  await expect(page.getByRole('note').first()).toContainText('außerhalb des Referenzbereichs');
  if (shots) await page.screenshot({ path: path.join(shots, 'm3-device.png') });

  await page.keyboard.press('Control+Shift+C');
  await expect(page.getByText('Befund in die Zwischenablage kopiert.')).toBeVisible();
  const clip = await app.evaluate(({ clipboard }) => clipboard.readText());
  expect(clip.split(/\r?\n/)[0]).toBe(TESTDATEN_MARKER);
  expect(clip).toContain('Regelrechte Aggregat- und Sondenfunktion.');
  expect(clip).not.toContain('Hinweis:'); // warnings never enter the report

  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Device-Abfrage' }).click();
  await expect(page.locator('#f-sensing_ra')).toHaveValue('> 2,8');
  await app.close();
});
