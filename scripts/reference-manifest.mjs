// Records the reviewed state of every rule file (content hash + reviewedOn) in
// tests/unit/reference-review.json. Run after a clinical review:
//   npm run reference:manifest
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export function contentHash(rule) {
  const { reviewedOn: _r, ...rest } = rule;
  return crypto.createHash('sha256').update(JSON.stringify(rest)).digest('hex').slice(0, 16);
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const dir = 'reference';
  const manifest = {};
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    const rule = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
    manifest[rule.id] = { reviewedOn: rule.reviewedOn, hash: contentHash(rule) };
  }
  fs.writeFileSync('tests/unit/reference-review.json', JSON.stringify(manifest, null, 2) + '\n');
  console.log(`${Object.keys(manifest).length} rule files recorded`);
}
