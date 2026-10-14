// Gateway §5.2 item 2: an edit of a rule file must update reviewedOn. The
// reviewed state is recorded in reference-review.json (npm run reference:manifest).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain JS helper shared with the manifest script
import { contentHash } from '../../scripts/reference-manifest.mjs';
import manifest from './reference-review.json';

const dir = path.resolve(__dirname, '../../reference');
const recorded = manifest as Record<string, { reviewedOn: string; hash: string }>;

describe('rule file review record', () => {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  it.each(files)('%s is unchanged since its review, or carries a new reviewedOn', (file) => {
    const rule = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
    const entry = recorded[rule.id];
    expect(entry, `${rule.id} is not recorded – run npm run reference:manifest after review`).toBeDefined();
    if (contentHash(rule) !== entry!.hash) {
      expect(rule.reviewedOn, `${rule.id} was edited without updating reviewedOn`).not.toBe(entry!.reviewedOn);
      throw new Error(`${rule.id}: edited and re-reviewed – run npm run reference:manifest to record the review`);
    }
    expect(rule.reviewedOn).toBe(entry!.reviewedOn);
  });
});
