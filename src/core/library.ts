/// <reference types="vite/client" />
// Text-block library (CLAUDE.md "Recommendations only as physician-selected
// text blocks"): blocks are inserted only by the physician, never
// automatically. Unreviewed drafts are usable in TESTBETRIEB only.
import { z } from 'zod';
import type { Betriebsmodus } from '../shared/mode';

export const LibraryBlockSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    status: z.enum(['draft', 'approved']),
    source: z.string().min(10),
    reviewedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    text: z.string().min(1),
  })
  .strict()
  .refine((b) => b.status === 'draft' || b.reviewedOn !== null, 'approved blocks need reviewedOn');
export type LibraryBlock = z.infer<typeof LibraryBlockSchema>;

const LibrarySchema = z.object({ module: z.string(), blocks: z.array(LibraryBlockSchema) }).strict();

const files = import.meta.glob('../../reference/library/*.json', { eager: true, import: 'default' });

export function loadLibraries(raw: Record<string, unknown> = files): Map<string, LibraryBlock[]> {
  const out = new Map<string, LibraryBlock[]>();
  for (const content of Object.values(raw)) {
    const lib = LibrarySchema.parse(content);
    out.set(lib.module, lib.blocks);
  }
  return out;
}

export const LIBRARIES = loadLibraries();

/** Blocks the physician may insert in this mode. */
export function insertableBlocks(module: string, mode: Betriebsmodus): LibraryBlock[] {
  return (LIBRARIES.get(module) ?? []).filter((b) => b.status === 'approved' || mode === 'TESTBETRIEB');
}
