// Renders one page of a source document (PDF via pdf.js, or an image) with an
// optional highlighted box. Box coordinates are OCR page pixels; the page
// image is scaled proportionally, so the box is scaled by the same factor.
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useEffect, useRef, useState } from 'react';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export function PdfPage(props: {
  bytes: Uint8Array;
  mime: string;
  page: number;
  width: number;
  /** [x0, y0, x1, y1] in OCR page pixels, with the OCR page size. */
  box?: { box: [number, number, number, number]; pageWidth: number; pageHeight: number };
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    if (props.mime !== 'application/pdf') {
      const url = URL.createObjectURL(new Blob([props.bytes.slice()], { type: props.mime }));
      setImageUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    (async () => {
      const doc = await pdfjs.getDocument({ data: props.bytes.slice(), useWasm: false }).promise;
      const page = await doc.getPage(props.page + 1);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: props.width / base.width });
      const c = canvas.current;
      if (!c || cancelled) return;
      c.width = Math.floor(viewport.width);
      c.height = Math.floor(viewport.height);
      await page.render({ canvas: c, viewport }).promise;
      if (!cancelled) setSize({ w: c.width, h: c.height });
    })().catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
    return () => {
      cancelled = true;
    };
  }, [props.bytes, props.mime, props.page, props.width]);

  const overlay =
    props.box && size
      ? {
          left: (props.box.box[0] / props.box.pageWidth) * size.w - 3,
          top: (props.box.box[1] / props.box.pageHeight) * size.h - 3,
          width: ((props.box.box[2] - props.box.box[0]) / props.box.pageWidth) * size.w + 6,
          height: ((props.box.box[3] - props.box.box[1]) / props.box.pageHeight) * size.h + 6,
        }
      : null;

  if (error) return <p className="text-red-700">Dokument kann nicht angezeigt werden: {error}</p>;
  return (
    <div className="relative inline-block border border-slate-300 bg-white" data-testid="source-page">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="Quelldokument"
          style={{ width: props.width }}
          onLoad={(e) => setSize({ w: e.currentTarget.clientWidth, h: e.currentTarget.clientHeight })}
        />
      ) : (
        <canvas ref={canvas} />
      )}
      {overlay && (
        <div
          data-testid="source-box"
          className="pointer-events-none absolute rounded-sm border-2 border-amber-500 bg-amber-300/20"
          style={overlay}
        />
      )}
    </div>
  );
}
