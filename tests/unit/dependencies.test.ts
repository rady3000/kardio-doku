// CLAUDE.md: "No other dependencies without asking me first." Every package
// in package.json must be on this list, which records the approval.
import pkg from '../../package.json';
import { describe, expect, it } from 'vitest';

const APPROVED = new Set([
  // Stack fixed in CLAUDE.md
  'electron', 'react', 'react-dom', 'typescript', 'better-sqlite3', 'zod',
  'tailwindcss', '@tailwindcss/vite', 'vitest',
  // Approved with PLAN.md (2026-10-02): P1–P5
  'vite', '@vitejs/plugin-react', 'electron-builder', 'docx', '@playwright/test', 'pdfjs-dist',
  // Type definitions for the packages above
  '@types/react', '@types/react-dom', '@types/better-sqlite3', '@types/node',
]);

describe('dependencies', () => {
  it('uses approved packages only', () => {
    const used = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})];
    expect(used.filter((name) => !APPROVED.has(name))).toEqual([]);
  });

  it('ships only better-sqlite3 as a runtime module (everything else is bundled)', () => {
    expect(Object.keys(pkg.dependencies)).toEqual(['better-sqlite3']);
  });
});
