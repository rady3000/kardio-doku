// Gateway test §7.4 / CLAUDE.md "One network egress path": no source file
// outside src/gateway may contain a network call, and the renderer may load
// local resources only.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isAllowedRendererUrl } from '../../src/main/egress';

const SRC = path.resolve(__dirname, '../../src');
const GATEWAY = path.join(SRC, 'gateway');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx|js|mjs|cjs|html|css)$/.test(entry.name) ? [full] : [];
  });
}

/** Removes comments so that cited URLs in comments do not count as calls. */
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const FORBIDDEN: Array<[string, RegExp]> = [
  ['fetch()', /\bfetch\s*\(/],
  ['XMLHttpRequest', /\bXMLHttpRequest\b/],
  ['WebSocket', /\bWebSocket\b/],
  ['EventSource', /\bEventSource\b/],
  ['sendBeacon', /\bsendBeacon\b/],
  ['node network module', /(from|require\()\s*['"](node:)?(http|https|http2|net|tls|dgram|dns)['"]/],
  ['electron net', /\bnet\s*\.\s*(request|fetch)\b|import\s*\{[^}]*\bnet\b[^}]*\}\s*from\s*['"]electron['"]/],
  ['autoUpdater', /\bautoUpdater\b/],
  ['shell.openExternal', /\bopenExternal\b/],
  ['remote URL', /\b(https?|wss?):\/\//],
  ['CSS @import url', /@import\s+url\(/],
];

describe('network egress', () => {
  const files = sourceFiles(SRC).filter((f) => !f.startsWith(GATEWAY + path.sep));

  it('scans the application sources', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it('finds no network call outside src/gateway', () => {
    const offences: string[] = [];
    for (const file of files) {
      const code = stripComments(fs.readFileSync(file, 'utf-8'));
      for (const [name, pattern] of FORBIDDEN) {
        if (pattern.test(code)) offences.push(`${path.relative(SRC, file)}: ${name}`);
      }
    }
    expect(offences).toEqual([]);
  });

  it('detects a forbidden call (self-check of the scanner)', () => {
    const code = stripComments("const r = await fetch('https://example.org'); // fine in comment: https://x");
    expect(FORBIDDEN.some(([, p]) => p.test(code))).toBe(true);
  });

  it('lets the renderer load local resources only', () => {
    expect(isAllowedRendererUrl('file:///C:/app/index.html')).toBe(true);
    expect(isAllowedRendererUrl('data:image/png;base64,AAAA')).toBe(true);
    expect(isAllowedRendererUrl('https://fonts.googleapis.com/css')).toBe(false);
    expect(isAllowedRendererUrl('http://localhost:5173/')).toBe(false);
    expect(isAllowedRendererUrl('wss://example.org')).toBe(false);
    expect(isAllowedRendererUrl('not a url')).toBe(false);
  });

  it('declares a Content-Security-Policy without network connections', () => {
    const html = fs.readFileSync(path.join(SRC, 'renderer', 'index.html'), 'utf-8');
    expect(html).toMatch(/connect-src 'none'/);
  });
});
