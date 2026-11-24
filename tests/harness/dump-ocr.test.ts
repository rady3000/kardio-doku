// Dumps the raw OCR result of the files in DUMP_OCR (comma-separated, under
// samples-real/) to <file>.ocr.json next to them, for label analysis.
// samples-real/ is git-ignored; nothing from it is ever committed.
import fs from 'node:fs';
import path from 'node:path';
import { it } from 'vitest';
import { mistralOcrProvider, setKeySource } from '../../src/gateway/providers/mistralOcr';

it('dumps OCR', async () => {
  setKeySource(() => process.env.MISTRAL_API_KEY ?? 'proxy-injected');
  for (const name of (process.env.DUMP_OCR ?? '').split(',').filter(Boolean)) {
    const file = path.join('samples-real', name);
    const ocr = await mistralOcrProvider.ocr({ fileName: name, mime: 'application/pdf', bytes: fs.readFileSync(file) });
    fs.writeFileSync(file.replace(/\.pdf$/, '.ocr.json'), JSON.stringify(ocr, null, 1));
  }
});
