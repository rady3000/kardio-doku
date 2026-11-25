// End-to-end: import a synthetic document, confirm anonymization, extract
// (network-free mock provider replaying a recorded Mistral OCR response),
// verify against the highlighted source, confirm, export.
import { _electron as electron, expect, test } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'kardio-e2e-ext-'));
const shots = process.env.KARDIO_SCREENSHOTS;
const root = process.cwd(); // Playwright runs from the repository root

test.afterAll(() => {
  try {
    fs.rmSync(userData, { recursive: true, force: true });
  } catch {
    // Windows may still lock the database while the app closes.
  }
});

test('extraction: import, anonymization, unconfirmed values, source, confirm, export', async () => {
  const args = process.platform === 'linux' ? ['--no-sandbox', '.'] : ['.'];
  const app = await electron.launch({
    args,
    env: {
      ...process.env,
      KARDIO_E2E_USER_DATA: userData,
      KARDIO_E2E_MOCK_OCR: path.join(root, 'tests/fixtures/ocr/tte-text-synthetic.json'),
      KARDIO_E2E_IMPORT_FILE: path.join(root, 'seed/tte-text-synthetic.pdf'),
    },
  });
  const page = await app.firstWindow();
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.waitForSelector('header');

  await page.keyboard.press('Control+n');
  await expect(page.locator('#p-last')).toBeFocused();
  await page.keyboard.type('Synthetisch');
  await page.locator('#p-sex').selectOption('männlich');
  await page.keyboard.press('Control+u');
  await page.getByRole('button', { name: 'Anlegen' }).click();

  const bar = page.getByTestId('documents-bar');
  await bar.getByRole('button', { name: 'Dokument importieren' }).click();
  // Per-document anonymization confirmation with preview (gateway §2.6.2).
  const confirm = page.getByRole('button', { name: 'Bestätigen', exact: true });
  await expect(confirm).toBeDisabled();
  await page.getByLabel(/Dokument ist anonymisiert/).check();
  await confirm.click();

  await bar.getByRole('button', { name: 'Werte extrahieren' }).click();
  await expect(bar.getByRole('status')).toContainText('Werte übernommen (unbestätigt)');
  await expect(page.locator('#f-lvef')).toHaveValue('57');
  await expect(page.locator('#f-rv')).toHaveValue('32'); // 3,2 cm → mm in code
  await expect(page.getByTestId('unconfirmed-bar')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Kopieren/ })).toBeDisabled(); // export block (gateway §4.2)
  // Source not opened yet: "Alle bestätigen" first opens the source (gateway §4.1, D-82).
  await expect(page.getByRole('button', { name: 'Alle bestätigen' })).not.toHaveAttribute('data-source-viewed');

  // Source view: page with the box and the exact source line.
  await page.getByRole('button', { name: 'Alle bestätigen' }).click();
  await expect(page.getByTestId('source-box')).toBeVisible();
  await expect(page.getByTestId('source-line')).not.toBeEmpty();
  if (shots) await page.screenshot({ path: path.join(shots, 'm4-source.png') });
  await page.getByRole('button', { name: 'Bestätigen', exact: true }).click();

  // A manual edit confirms implicitly (as a correction).
  await page.locator('#f-tapse').fill('19');
  await page.getByRole('button', { name: 'Alle bestätigen' }).click();
  await expect(page.getByTestId('unconfirmed-bar')).toHaveCount(0);
  if (shots) await page.screenshot({ path: path.join(shots, 'm4-confirmed.png') });

  await page.keyboard.press('Control+Shift+C');
  await expect(page.getByText('Befund in die Zwischenablage kopiert.')).toBeVisible();
  const clip = await app.evaluate(({ clipboard }) => clipboard.readText());
  expect(clip).toContain('LVEF 57 %');
  expect(clip).toContain('TAPSE 19 mm');
  await app.close();
});
