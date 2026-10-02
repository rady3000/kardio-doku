// End-to-end check of the M1 shell in the real Electron app: TESTDATEN banner,
// patient record with autosave, persistence across restarts, Betriebsmodus
// switch with separate databases, and no network requests from the UI.
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TESTDATEN_MARKER } from '../../src/shared/mode';

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'kardio-e2e-'));
const requests: string[] = [];
const shots = process.env.KARDIO_SCREENSHOTS;

async function launch(): Promise<{ app: ElectronApplication; page: Page }> {
  const args = process.platform === 'linux' ? ['--no-sandbox', '.'] : ['.'];
  const app = await electron.launch({ args, env: { ...process.env, KARDIO_E2E_USER_DATA: userData } });
  app.context().on('request', (r) => requests.push(r.url()));
  const page = await app.firstWindow();
  await page.waitForSelector('header');
  return { app, page };
}

test.afterAll(() => fs.rmSync(userData, { recursive: true, force: true }));

test('M1 shell', async () => {
  let { app, page } = await launch();

  // Test mode is the default and the banner cannot be missed.
  await expect(page.getByTestId('testdaten-banner')).toHaveText(TESTDATEN_MARKER);
  await expect(page.getByTestId('mode-badge')).toHaveText('TESTBETRIEB');
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.getTitle())).toBe(
    'Kardio-Doku – TESTBETRIEB',
  );

  // Keyboard-only patient entry with autosave.
  await page.keyboard.press('Control+n');
  await expect(page.locator('#p-last')).toBeFocused();
  await page.keyboard.type('Mustermann');
  await page.keyboard.press('Tab');
  await page.keyboard.type('Erika');
  await page.keyboard.press('Tab');
  await page.keyboard.type('1.2.1950');
  await page.keyboard.press('Tab');
  await expect(page.locator('#p-birth')).toHaveValue('01.02.1950');
  await page.locator('#p-sex').selectOption('weiblich');
  await expect(page.getByRole('status').first()).toContainText('Gespeichert');
  await expect(page.getByRole('list', { name: 'Patienten' })).toContainText('Mustermann, Erika');

  // New study via keyboard; opens the study page; Esc returns.
  await page.keyboard.press('Control+u');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Das Formular für dieses Modul folgt in Meilenstein M2.')).toBeVisible();
  if (shots) await page.screenshot({ path: path.join(shots, 'm1-study.png') });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Transthorakale Echokardiographie (TTE)' })).toBeVisible();
  if (shots) await page.screenshot({ path: path.join(shots, 'm1-patient.png') });

  // Persistence across a restart.
  await app.close();
  ({ app, page } = await launch());
  await page.getByRole('button', { name: /Mustermann, Erika/ }).click();
  await expect(page.locator('#p-sex')).toHaveValue('weiblich');
  await expect(page.getByRole('button', { name: 'Transthorakale Echokardiographie (TTE)' })).toBeVisible();

  // Switching to ECHTBETRIEB needs the explicit acknowledgement; then live.db is empty.
  await page.keyboard.press('Alt+2');
  await page.getByRole('button', { name: 'Wechseln zu ECHTBETRIEB' }).click();
  const confirm = page.getByRole('button', { name: 'In den Echtbetrieb wechseln' });
  await expect(confirm).toBeDisabled();
  if (shots) await page.screenshot({ path: path.join(shots, 'm1-mode-dialog.png') });
  await page.getByLabel('Ich habe die Folgen gelesen.').check();
  await confirm.click();
  await expect(page.getByTestId('mode-badge')).toHaveText('ECHTBETRIEB');
  await expect(page.getByTestId('testdaten-banner')).toHaveCount(0);
  await expect(page.getByText('Im Echtbetrieb gesperrt', { exact: false })).toBeVisible();
  await page.keyboard.press('Alt+1');
  await expect(page.getByText('Noch keine Patienten angelegt.')).toBeVisible();

  // Back to TESTBETRIEB: the test patient is still there.
  await page.keyboard.press('Alt+2');
  await page.getByRole('button', { name: 'Wechseln zu TESTBETRIEB' }).click();
  await page.getByRole('button', { name: 'In den Testbetrieb wechseln' }).click();
  await expect(page.getByTestId('testdaten-banner')).toBeVisible();
  await page.keyboard.press('Alt+1');
  await expect(page.getByRole('list', { name: 'Patienten' })).toContainText('Mustermann, Erika');
  await app.close();

  expect(fs.existsSync(path.join(userData, 'data', 'test.db'))).toBe(true);
  expect(fs.existsSync(path.join(userData, 'data', 'live.db'))).toBe(true);

  // The UI made no network request.
  expect(requests.filter((u) => !/^(file|data|blob|devtools):/.test(u))).toEqual([]);
});
