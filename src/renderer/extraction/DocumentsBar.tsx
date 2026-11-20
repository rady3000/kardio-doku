// Source documents of a study: import, per-document anonymization
// confirmation (gateway §2.6.2), and extraction. Extraction only pre-fills;
// manual entry is always available.
import { useEffect, useState } from 'react';
import type { DocumentInfo, ExtractionSettings, ExtractionSummary } from '../../shared/types';
import { api } from '../api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { buttonClass } from '../components/ui';
import { PdfPage } from './PdfPage';

export const ANONYMIZATION_TEXT =
  'Dokument ist anonymisiert (Kopfzeile, Name, Geburtsdatum, Fallnummer, Untersuchungsdatum, Geräte-Seriennummer entfernt).';

export function DocumentsBar(props: {
  studyId: number;
  /** Called before import/extraction so that pending edits are saved first. */
  beforeChange: () => Promise<void>;
  /** Called after an extraction changed the stored study. */
  onExtracted: () => Promise<void>;
}) {
  const [docs, setDocs] = useState<DocumentInfo[]>([]);
  const [settings, setSettings] = useState<ExtractionSettings | null>(null);
  const [confirming, setConfirming] = useState<DocumentInfo | null>(null);
  const [result, setResult] = useState<ExtractionSummary | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = () => api.listDocuments(props.studyId).then(setDocs);
  useEffect(() => {
    void reload();
    void api.getExtractionSettings().then(setSettings);
  }, [props.studyId]);

  const providerReady = settings !== null && settings.provider !== 'none';

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-1.5" data-testid="documents-bar">
      <span className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Dokumente</span>
      {docs.map((d) => (
        <span key={d.id} className="flex items-center gap-1.5 rounded-sm border border-slate-200 bg-slate-50 px-2 py-0.5">
          <span className="max-w-48 truncate" title={d.fileName}>
            {d.fileName}
          </span>
          {d.anonymizedAt ? (
            <button
              type="button"
              className={`${buttonClass} h-6`}
              disabled={!providerReady || busy}
              title={providerReady ? undefined : 'Kein Extraktionsanbieter konfiguriert (Einstellungen)'}
              onClick={async () => {
                setBusy(true);
                setResult(null);
                try {
                  await props.beforeChange();
                  const r = await api.extractDocument(props.studyId, d.id);
                  setResult(r);
                  await props.onExtracted();
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Extraktion läuft …' : 'Werte extrahieren'}
            </button>
          ) : (
            <button type="button" className={`${buttonClass} h-6 border-amber-400`} onClick={() => setConfirming(d)}>
              Anonymisierung bestätigen
            </button>
          )}
        </span>
      ))}
      <button
        type="button"
        className={`${buttonClass} h-6`}
        onClick={async () => {
          await props.beforeChange();
          const d = await api.importDocument(props.studyId);
          if (d) {
            await reload();
            setConfirming(d);
          }
        }}
      >
        Dokument importieren
      </button>
      {!providerReady && settings && <span className="text-[11px] text-slate-500">Extraktion: kein Anbieter konfiguriert</span>}
      {result && (
        <span role="status" className={result.ok ? 'text-[12px] text-slate-700' : 'text-[12px] text-red-700'} title={tooltip(result)}>
          {result.message}
        </span>
      )}
      {confirming && (
        <AnonymizeDialog
          doc={confirming}
          onCancel={() => setConfirming(null)}
          onConfirm={async () => {
            await api.confirmAnonymized(confirming.id);
            setConfirming(null);
            await reload();
          }}
        />
      )}
    </div>
  );
}

function tooltip(r: ExtractionSummary): string {
  return [
    ...r.accepted.map((a) => `übernommen: ${a}`),
    ...r.rejected.map((x) => `verworfen: ${x.field} – ${x.reason}`),
    ...r.skipped.map((s) => `bereits eingegeben: ${s}`),
  ].join('\n');
}

/** Not a remembered setting: every document is confirmed on its own, with a page preview (gateway §2.6.2). */
function AnonymizeDialog(props: { doc: DocumentInfo; onCancel: () => void; onConfirm: () => Promise<void> }) {
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  useEffect(() => {
    void api.documentData(props.doc.id).then((d) => setBytes(d?.bytes ?? null));
  }, [props.doc.id]);
  return (
    <ConfirmDialog
      title="Anonymisierung bestätigen"
      confirmLabel="Bestätigen"
      acknowledge={ANONYMIZATION_TEXT}
      onConfirm={() => void props.onConfirm()}
      onCancel={props.onCancel}
    >
      <p>
        <strong>{props.doc.fileName}</strong> – die App anonymisiert nicht. Bitte prüfen Sie die Vorschau.
      </p>
      <div className="max-h-[55vh] overflow-auto">{bytes && <PdfPage bytes={bytes} mime={props.doc.mime} page={0} width={480} />}</div>
    </ConfirmDialog>
  );
}
