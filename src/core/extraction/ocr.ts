// Provider-neutral OCR result (gateway §3) and the parser for Mistral OCR 4.1
// responses (SPEC-decisions D-76, verified 2026-11-20). Coordinates are pixels
// of the rendered page, origin top left.
import { z } from 'zod';

export interface OcrWord {
  text: string;
  confidence: number;
  /** Character offset in the page text. */
  start: number;
}

export interface OcrBlock {
  type: string;
  /** [x0, y0, x1, y1] in page pixels. */
  box: [number, number, number, number];
  content: string;
  /** Character offset of `content` in the page text, -1 if not found. */
  start: number;
  /** Minimum content confidence of the block, if the provider returned one. */
  minConfidence: number | null;
}

export interface OcrPage {
  /** 0-based page index. */
  index: number;
  width: number;
  height: number;
  dpi: number;
  text: string;
  blocks: OcrBlock[];
  words: OcrWord[];
}

export interface OcrResult {
  provider: string;
  model: string;
  pages: OcrPage[];
  pagesProcessed: number;
}

const BlockSchema = z
  .object({
    type: z.string(),
    top_left_x: z.number(),
    top_left_y: z.number(),
    bottom_right_x: z.number(),
    bottom_right_y: z.number(),
    content: z.string().nullable().optional(),
    confidence_scores: z.object({ minimum_content_confidence_score: z.number().nullable().optional() }).passthrough().nullable().optional(),
  })
  .passthrough();

const PageSchema = z
  .object({
    index: z.number().int(),
    markdown: z.string(),
    dimensions: z.object({ dpi: z.number(), height: z.number(), width: z.number() }),
    blocks: z.array(BlockSchema).nullable().optional(),
    confidence_scores: z
      .object({
        word_confidence_scores: z
          .array(z.object({ text: z.string(), confidence: z.number(), start_index: z.number().int() }))
          .nullable()
          .optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

const ResponseSchema = z
  .object({
    model: z.string(),
    pages: z.array(PageSchema),
    usage_info: z.object({ pages_processed: z.number().int() }).passthrough(),
  })
  .passthrough();

/** Parses a Mistral /v1/ocr response. Throws on an unexpected format (nothing is guessed). */
export function parseMistralOcr(raw: unknown): OcrResult {
  const r = ResponseSchema.parse(raw);
  return {
    provider: 'mistral-ocr',
    model: r.model,
    pagesProcessed: r.usage_info.pages_processed,
    pages: r.pages.map((p) => {
      let cursor = 0;
      const blocks: OcrBlock[] = (p.blocks ?? []).map((b) => {
        const content = b.content ?? '';
        let start = content ? p.markdown.indexOf(content, cursor) : -1;
        if (start < 0 && content) start = p.markdown.indexOf(content);
        if (start >= 0) cursor = start + content.length;
        return {
          type: b.type,
          box: [b.top_left_x, b.top_left_y, b.bottom_right_x, b.bottom_right_y],
          content,
          start,
          minConfidence: b.confidence_scores?.minimum_content_confidence_score ?? null,
        };
      });
      return {
        index: p.index,
        width: p.dimensions.width,
        height: p.dimensions.height,
        dpi: p.dimensions.dpi,
        text: p.markdown,
        blocks,
        words: (p.confidence_scores?.word_confidence_scores ?? []).map((w) => ({
          text: w.text,
          confidence: w.confidence,
          start: w.start_index,
        })),
      };
    }),
  };
}
