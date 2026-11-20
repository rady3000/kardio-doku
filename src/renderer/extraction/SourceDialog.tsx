// Verification (gateway §4.1): the source page with the box highlighted, the
// source line and the confidence, next to the extracted value.
import { useEffect, useRef, useState } from 'react';
import type { StudyData } from '../../core/studyData';
import { formatQualified, readQualified } from '../../core/format';
import { api } from '../api';
import { buttonClass, primaryButtonClass } from '../components/ui';
import { PdfPage } from './PdfPage';

type Provenance = StudyData['provenance'][string];

export function SourceDialog(props: {
  label: string;
  unit: string;
  value: unknown;
  provenance: Provenance;
  unconfirmed: boolean;
  onConfirm: () => void;
  onDiscard: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [doc, setDoc] = useState<{ bytes: Uint8Array; mime: string; name: string } | null>(null);
  const p = props.provenance;
  useEffect(() => {
    ref.current?.showModal();
    void api.documentData(p.documentId).then((d) => d && setDoc({ bytes: d.bytes, mime: d.info.mime, name: d.info.fileName }));
  }, [p.documentId]);
  const q = readQualified(props.value);
  const shown = q ? formatQualified(q, 6).replace('.', ',') : String(props.value ?? '');

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        props.onClose();
      }}
      className="m-auto w-[min(56rem,95vw)] rounded-sm border border-slate-300 p-0 shadow-lg backdrop:bg-slate-900/30"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
        <span className="text-[14px] font-semibold">Quelle: {props.label}</span>
        <span className="text-slate-500">{doc?.name} · Seite {p.page + 1}</span>
      </div>
      <div className="grid grid-cols-[1fr_16rem] gap-4 p-4">
        <div className="max-h-[70vh] overflow-auto">
          {doc && (
            <PdfPage
              bytes={doc.bytes}
              mime={doc.mime}
              page={p.page}
              width={560}
              box={{ box: p.box, pageWidth: p.pageWidth, pageHeight: p.pageHeight }}
            />
          )}
        </div>
        <dl className="space-y-2">
          <div>
            <dt className="text-[11px] uppercase text-slate-500">Zeile im Dokument</dt>
            <dd className="font-mono text-[12px]" data-testid="source-line">
              {p.rawText}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase text-slate-500">Übernommener Wert</dt>
            <dd className="text-[15px] font-semibold">
              {shown} {props.unit}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase text-slate-500">Konfidenz</dt>
            <dd>{p.confidence.toFixed(3).replace('.', ',')}</dd>
          </div>
          <p className="text-[11px] text-slate-500">
            Der Rahmen markiert den Textblock (bei Tabellen die ganze Tabelle). Bitte mit der Zeile oben vergleichen.
          </p>
        </dl>
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-2">
        {props.unconfirmed && (
          <button type="button" className={buttonClass} onClick={props.onDiscard}>
            Verwerfen
          </button>
        )}
        <button type="button" className={buttonClass} onClick={props.onClose}>
          Schließen
        </button>
        {props.unconfirmed && (
          <button type="button" className={primaryButtonClass} autoFocus onClick={props.onConfirm}>
            Bestätigen
          </button>
        )}
      </div>
    </dialog>
  );
}
