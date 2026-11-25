// Study page: generic form (left) and live report (right) for any module.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { allFields, type ModuleSchema } from '../../core/schema';
import { buildStudyReport } from '../../core/studyReport';
import { parseStudyData, type StudyData } from '../../core/studyData';
import { formatGermanDate } from '../../shared/dates';
import { MODULES } from '../../shared/modules';
import type { ExportFormat, LibraryBlockInfo, Patient, Study } from '../../shared/types';
import { api } from '../api';
import { flushAllAutosaves, useAutosave } from '../autosave';
import { DateInput } from '../components/DateInput';
import { patientDisplayName } from '../components/PatientList';
import { SaveIndicator, buttonClass } from '../components/ui';
import { FormSection } from './FormSection';
import { ReportPanel, type ReportActions } from './ReportPanel';
import { DocumentsBar } from '../extraction/DocumentsBar';
import { SourceDialog } from '../extraction/SourceDialog';
import type { ExtractionUi } from './FormSection';

type Value = string | number | null | undefined;

export function StudyView(props: { study: Study; patient: Patient; onBack: () => void }) {
  const { study, patient } = props;
  const [studyDate, setStudyDate] = useState<string | null>(study.studyDate);
  const [dateError, setDateError] = useState<string | null>(null);
  const [data, setData] = useState<StudyData>(() => parseStudyData(study.data));
  const [library, setLibrary] = useState<LibraryBlockInfo[]>([]);
  const [exportMessage, setExportMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const module = MODULES.find((m) => m.key === study.moduleKey);

  const saved = useMemo(() => ({ studyDate, data }), [studyDate, data]);
  const status = useAutosave(saved, async (v) => {
    await api.updateStudy(study.id, { studyDate: v.studyDate ?? undefined, data: v.data });
  });

  const report = useMemo(() => buildStudyReport(study, patient, data), [study, patient, data]);

  useEffect(() => {
    void api.libraryBlocks(study.moduleKey).then(setLibrary);
  }, [study.moduleKey]);

  const dataRef = useRef(data);
  dataRef.current = data;
  const [sourceKey, setSourceKey] = useState<string | null>(null);

  const setValue = useCallback((key: string, v: Value) => {
    // Editing an unconfirmed extracted value confirms it implicitly, as a correction (gateway §4.1, §4.4).
    const prov = dataRef.current.provenance[key];
    if (prov && dataRef.current.unconfirmed.includes(key)) {
      void api.confirmExtraction(prov.extractionId, String(v ?? ''), true);
    }
    setData((d) => {
      const values = { ...d.values };
      if (v === undefined) delete values[key];
      else values[key] = v;
      const extractionFailed = { ...d.extractionFailed };
      delete extractionFailed[key];
      return {
        ...d,
        values,
        presets: d.presets.filter((k) => k !== key),
        unconfirmed: d.unconfirmed.filter((k) => k !== key),
        extractionFailed,
      };
    });
  }, []);

  /** Confirms extracted values unchanged (audit: was_corrected = false). */
  const confirmFields = useCallback((keys: string[]) => {
    for (const key of keys) {
      const prov = dataRef.current.provenance[key];
      if (prov) void api.confirmExtraction(prov.extractionId, String(dataRef.current.values[key] ?? ''), false);
    }
    setData((d) => ({ ...d, unconfirmed: d.unconfirmed.filter((k) => !keys.includes(k)) }));
  }, []);

  const showSource = useCallback((key: string) => {
    const doc = dataRef.current.provenance[key]?.documentId;
    if (doc === undefined) return;
    setSourceKey(key);
    setData((d) => (d.sourceViewed.includes(doc) ? d : { ...d, sourceViewed: [...d.sourceViewed, doc] }));
  }, []);

  const reloadData = useCallback(async () => {
    const fresh = await api.getStudy(study.id);
    if (fresh) setData(parseStudyData(fresh.data));
  }, [study.id]);

  /** "Alles normal": fills empty fields with their normal value; computed categories still win (presets). */
  const applyNormal = useCallback(
    (schema: ModuleSchema, sectionKeys: string[] | 'all') => {
      setData((d) => {
        const values = { ...d.values };
        const presets = new Set(d.presets);
        for (const section of schema.sections) {
          if (sectionKeys !== 'all' && !sectionKeys.includes(section.key)) continue;
          for (const f of section.fields) {
            if (f.normal === undefined || Object.prototype.hasOwnProperty.call(values, f.key)) continue;
            values[f.key] = f.normal;
            presets.add(f.key);
          }
        }
        return { ...d, values, presets: [...presets] };
      });
    },
    [],
  );

  const doExport = useCallback(
    async (format: ExportFormat) => {
      await flushAllAutosaves();
      try {
        const res = await api.exportStudy(study.id, format);
        setExportMessage({ ok: res.ok, text: res.message });
      } catch (err) {
        setExportMessage({ ok: false, text: err instanceof Error ? err.message : String(err) });
      }
    },
    [study.id],
  );

  const actions: ReportActions = useMemo(
    () => ({
      saveSentence: (s, text) =>
        setData((d) => {
          if (s.kind === 'library') {
            const i = Number(s.id.split('.')[1]);
            return { ...d, blocks: d.blocks.map((b, j) => (j === i ? { ...b, text } : b)) };
          }
          const overrides = { ...d.overrides };
          if (s.generated !== undefined && text === s.generated) delete overrides[s.id];
          else overrides[s.id] = { text, basis: s.generated ?? '' };
          return { ...d, overrides };
        }),
      removeSentence: (s) =>
        setData((d) => {
          if (s.kind === 'library') {
            const i = Number(s.id.split('.')[1]);
            return { ...d, blocks: d.blocks.filter((_, j) => j !== i) };
          }
          return { ...d, overrides: { ...d.overrides, [s.id]: { text: '', basis: s.generated ?? '' } } };
        }),
      restoreSentence: (s) =>
        setData((d) => {
          const overrides = { ...d.overrides };
          delete overrides[s.id];
          return { ...d, overrides };
        }),
      setExtra: (lineId, text) =>
        setData((d) => {
          const extras = { ...d.extras };
          if (text.trim()) extras[lineId] = text;
          else delete extras[lineId];
          return { ...d, extras };
        }),
      insertBlock: (b) => setData((d) => ({ ...d, blocks: [...d.blocks, { id: b.id, text: b.text }] })),
    }),
    [],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return;
      const key = e.key.toLowerCase();
      if (e.key === 'Escape' && !(e.target instanceof HTMLTextAreaElement)) {
        props.onBack();
      } else if (e.ctrlKey && e.shiftKey && ['c', 'd', 'p'].includes(key)) {
        e.preventDefault();
        void doExport(key === 'c' ? 'clipboard' : key === 'd' ? 'docx' : 'pdf');
      } else if (e.altKey && key === 'n' && report) {
        e.preventDefault();
        if (e.shiftKey) applyNormal(report.schema, 'all');
        else {
          const sec = (document.activeElement as HTMLElement | null)?.closest('[data-section]')?.getAttribute('data-section');
          if (sec) applyNormal(report.schema, [sec]);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props, doExport, applyNormal, report]);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 py-1.5">
        <button type="button" className={buttonClass} onClick={props.onBack}>
          ← Zurück <kbd>Esc</kbd>
        </button>
        <div className="min-w-0">
          <div className="truncate font-semibold">{module?.name ?? study.moduleKey}</div>
          <div className="truncate text-[12px] text-slate-500">
            {patientDisplayName(patient)}
            {patient.birthDate && `, geb. ${formatGermanDate(patient.birthDate)}`}
            {patient.sex ? `, ${patient.sex}` : ', Geschlecht nicht angegeben'}
          </div>
        </div>
        <label className="ml-4 flex items-center gap-2 text-slate-600">
          Untersuchungsdatum
          <DateInput id="s-date-edit" value={studyDate} onChange={setStudyDate} onError={setDateError} allowEmpty={false} />
        </label>
        {dateError && <span className="text-[11px] text-amber-700">{dateError}</span>}
        <div className="ml-auto flex items-center gap-3">
          <SaveIndicator status={status} />
          {report && (
            <button type="button" className={buttonClass} onClick={() => applyNormal(report.schema, 'all')}>
              Alles normal (gesamt) <kbd>Alt+Umschalt+N</kbd>
            </button>
          )}
        </div>
      </div>

      {report && allFields(report.schema).some((f) => f.type === 'number' && f.extraction) && (
        <DocumentsBar studyId={study.id} beforeChange={flushAllAutosaves} onExtracted={reloadData} />
      )}
      {report && sourceKey && data.provenance[sourceKey] && (
        <SourceDialog
          label={allFields(report.schema).find((f) => f.key === sourceKey)?.label ?? sourceKey}
          unit={(() => {
            const f = allFields(report.schema).find((x) => x.key === sourceKey);
            return f?.type === 'number' ? f.unit : '';
          })()}
          value={data.values[sourceKey]}
          provenance={data.provenance[sourceKey]!}
          unconfirmed={data.unconfirmed.includes(sourceKey)}
          onConfirm={() => {
            confirmFields([sourceKey]);
            setSourceKey(null);
          }}
          onDiscard={() => {
            setValue(sourceKey, undefined);
            setSourceKey(null);
          }}
          onClose={() => setSourceKey(null)}
        />
      )}
      {report ? (
        <div className="flex min-h-0 flex-1">
          <StudyForm
            schema={report.schema}
            data={data}
            report={report}
            extraction={{ onSource: showSource, onConfirm: (k) => confirmFields([k]) }}
            onConfirmAll={() => confirmFields(data.unconfirmed)}
            setValue={setValue}
            onNormal={(key) => applyNormal(report.schema, [key])}
            sexMissing={!patient.sex}
          />
          <ReportPanel
            model={report.model}
            blockers={report.blockers}
            warnings={report.evaluation.warnings.map((w) => w.text)}
            library={library}
            extras={data.extras}
            actions={actions}
            onExport={(f) => void doExport(f)}
            exportMessage={exportMessage}
          />
        </div>
      ) : (
        <div className="m-4 rounded-sm border border-dashed border-slate-300 bg-white p-4 text-slate-600">
          Das Formular für dieses Modul folgt in Meilenstein {module?.milestone ?? '–'}.
        </div>
      )}
    </div>
  );
}

function StudyForm(props: {
  schema: ModuleSchema;
  data: StudyData;
  report: NonNullable<ReturnType<typeof buildStudyReport>>;
  extraction: ExtractionUi;
  onConfirmAll: () => void;
  setValue: (key: string, v: Value) => void;
  onNormal: (sectionKey: string) => void;
  sexMissing: boolean;
}) {
  const { schema, report } = props;
  // Enter moves to the next field (keyboard-first entry).
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (e.key !== 'Enter' || !(t instanceof HTMLInputElement || t instanceof HTMLSelectElement)) return;
    e.preventDefault();
    const all = [...e.currentTarget.querySelectorAll<HTMLElement>('input, select, textarea')].filter(
      (el) => el.tabIndex !== -1 && !(el as HTMLInputElement).disabled,
    );
    all[all.indexOf(t) + 1]?.focus();
  };
  const sexRules = allFields(schema).length > 0 && props.sexMissing;
  const pending = props.data.unconfirmed.filter((k) => props.data.provenance[k]);
  // "Alle bestätigen" requires the source panel to have been opened at least once per document (gateway §4.1).
  const docsPending = [...new Set(pending.map((k) => props.data.provenance[k]!.documentId))];
  const allViewed = docsPending.every((d) => props.data.sourceViewed.includes(d));
  return (
    <div className="min-w-0 flex-1 space-y-2 overflow-y-auto p-3" onKeyDown={onKeyDown}>
      {sexRules && (
        <p className="rounded-sm border border-amber-300 bg-amber-50 px-2 py-1 text-amber-900">
          Geschlecht des Patienten fehlt – geschlechtsabhängige Einteilungen (z. B. LVEF, LVEDD) erzeugen keinen Text.
        </p>
      )}
      {pending.length > 0 && (
        <div className="flex items-center gap-3 rounded-sm border border-amber-400 bg-amber-50 px-2 py-1 text-amber-900" data-testid="unconfirmed-bar">
          <span>
            {pending.length} extrahierte Werte unbestätigt – bitte mit der Quelle vergleichen („Quelle“). Export bis zur Bestätigung gesperrt.
          </span>
          {/* D-82: one click confirms all. If the source was not opened yet (gateway §4.1), the click
              opens it first; after a look at the source the next click confirms all values. */}
          <button
            type="button"
            className="ml-auto rounded-sm border border-amber-600 bg-white px-2 py-0.5"
            title={allViewed ? 'Alle extrahierten Werte bestätigen' : 'Öffnet zuerst die Quelle; danach bestätigt ein weiterer Klick alle Werte'}
            data-source-viewed={allViewed || undefined}
            onClick={() => {
              if (allViewed) return props.onConfirmAll();
              const first = pending.find((k) => !props.data.sourceViewed.includes(props.data.provenance[k]!.documentId));
              if (first) props.extraction.onSource(first);
            }}
          >
            Alle bestätigen
          </button>
        </div>
      )}
      {schema.sections.map((s) => (
        <FormSection
          key={s.key}
          schema={schema}
          section={s}
          ev={report.evaluation}
          data={props.data}
          extraction={props.extraction}
          setValue={props.setValue}
          onNormal={() => props.onNormal(s.key)}
        />
      ))}
    </div>
  );
}
