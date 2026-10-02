// Patient header (SPEC-shared §2.2) with autosave, plus the patient's studies.
import { useEffect, useRef, useState } from 'react';
import { formatGermanDate, todayIso } from '../../shared/dates';
import { MODULES, moduleName, type ModuleKey } from '../../shared/modules';
import { SEXES, type Patient, type PatientInput, type Sex, type Study } from '../../shared/types';
import { api } from '../api';
import { useAutosave } from '../autosave';
import { DateInput } from './DateInput';
import { Field, SaveIndicator, SectionTitle, buttonClass, inputClass, primaryButtonClass } from './ui';

function toInput(p: Patient): PatientInput {
  return { lastName: p.lastName, firstName: p.firstName, birthDate: p.birthDate, sex: p.sex, caseId: p.caseId };
}

export function PatientDetail(props: {
  patient: Patient;
  autoFocusName: boolean;
  onSaved: (p: Patient) => void;
  onOpenStudy: (id: number) => void;
}) {
  const { patient, onSaved } = props;
  const [draft, setDraft] = useState<PatientInput>(() => toInput(patient));
  const [birthError, setBirthError] = useState<string | null>(null);
  const [studies, setStudies] = useState<Study[]>([]);
  const [creating, setCreating] = useState(false);

  const status = useAutosave(draft, async (value) => {
    onSaved(await api.updatePatient(patient.id, value));
  });

  useEffect(() => {
    void api.listStudies(patient.id).then(setStudies);
  }, [patient.id]);

  const set = <K extends keyof PatientInput>(key: K, value: PatientInput[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="max-w-3xl space-y-6">
        <section>
          <SectionTitle right={<SaveIndicator status={status} />}>Patient</SectionTitle>
          <div className="max-w-xl space-y-1.5">
            <Field label="Nachname" htmlFor="p-last" required missing={!draft.lastName.trim()}>
              <input
                id="p-last"
                className={inputClass}
                value={draft.lastName}
                autoFocus={props.autoFocusName}
                onChange={(e) => set('lastName', e.target.value)}
              />
            </Field>
            <Field label="Vorname" htmlFor="p-first" required missing={!draft.firstName.trim()}>
              <input
                id="p-first"
                className={inputClass}
                value={draft.firstName}
                onChange={(e) => set('firstName', e.target.value)}
              />
            </Field>
            <Field label="Geburtsdatum" htmlFor="p-birth" required missing={!draft.birthDate && !birthError} error={birthError}>
              <DateInput id="p-birth" value={draft.birthDate} onChange={(v) => set('birthDate', v)} onError={setBirthError} />
            </Field>
            <Field label="Geschlecht" htmlFor="p-sex" required missing={!draft.sex}>
              <select
                id="p-sex"
                className={`${inputClass} w-40`}
                value={draft.sex ?? ''}
                onChange={(e) => set('sex', e.target.value === '' ? null : (e.target.value as Sex))}
              >
                <option value="">– bitte wählen –</option>
                {SEXES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Fallnummer" htmlFor="p-case">
              <input
                id="p-case"
                className={`${inputClass} w-48`}
                value={draft.caseId}
                onChange={(e) => set('caseId', e.target.value)}
              />
            </Field>
          </div>
        </section>

        <section>
          <SectionTitle
            right={
              !creating && (
                <button type="button" className={buttonClass} onClick={() => setCreating(true)}>
                  Neue Untersuchung <kbd>Strg+U</kbd>
                </button>
              )
            }
          >
            Untersuchungen
          </SectionTitle>
          {creating && (
            <NewStudyForm
              onCancel={() => setCreating(false)}
              onCreate={async (moduleKey, studyDate) => {
                await status.flush();
                const study = await api.createStudy({ patientId: patient.id, moduleKey, studyDate });
                setCreating(false);
                props.onOpenStudy(study.id);
              }}
            />
          )}
          <StudyTable studies={studies} onOpen={props.onOpenStudy} />
        </section>
      </div>
      <ShortcutNewStudy onTrigger={() => setCreating(true)} />
    </div>
  );
}

function ShortcutNewStudy({ onTrigger }: { onTrigger: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        onTrigger();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onTrigger]);
  return null;
}

function NewStudyForm(props: {
  onCancel: () => void;
  onCreate: (moduleKey: ModuleKey, studyDate: string) => Promise<void>;
}) {
  const [moduleKey, setModuleKey] = useState<ModuleKey>('tte');
  const [studyDate, setStudyDate] = useState<string | null>(todayIso());
  const [dateError, setDateError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Enter may arrive in the same event as the date commit; read the latest values from refs.
  const latest = useRef({ moduleKey, studyDate, dateError });
  latest.current = { moduleKey, studyDate, dateError };

  const submit = () => {
    // Deferred so that a date committed by the same Enter key is already applied.
    setTimeout(async () => {
      const { moduleKey: key, studyDate: date, dateError: err } = latest.current;
      if (!date || err || busy) return;
      setBusy(true);
      try {
        await props.onCreate(key, date);
      } finally {
        setBusy(false);
      }
    }, 0);
  };

  return (
    <form
      className="mb-3 flex flex-wrap items-end gap-3 rounded-sm border border-slate-200 bg-white p-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          props.onCancel();
        }
        // A native <select> does not submit on Enter; make it do so for keyboard-only entry.
        if (e.key === 'Enter' && e.target instanceof HTMLSelectElement) {
          e.preventDefault();
          submit();
        }
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="text-slate-600">Untersuchung</span>
        <select
          className={`${inputClass} w-80`}
          value={moduleKey}
          autoFocus
          onChange={(e) => setModuleKey(e.target.value as ModuleKey)}
        >
          {MODULES.map((m) => (
            <option key={m.key} value={m.key}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-slate-600">Untersuchungsdatum</span>
        <DateInput id="s-date" value={studyDate} onChange={setStudyDate} onError={setDateError} allowEmpty={false} />
      </label>
      <button type="submit" className={primaryButtonClass} disabled={busy || !studyDate || !!dateError}>
        Anlegen
      </button>
      <button type="button" className={buttonClass} onClick={props.onCancel}>
        Abbrechen
      </button>
      {dateError && <span className="text-[11px] text-amber-700">{dateError}</span>}
    </form>
  );
}

function StudyTable({ studies, onOpen }: { studies: Study[]; onOpen: (id: number) => void }) {
  if (studies.length === 0) return <p className="text-slate-500">Noch keine Untersuchungen.</p>;
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
          <th className="w-28 py-1 font-medium">Datum</th>
          <th className="py-1 font-medium">Untersuchung</th>
          <th className="w-40 py-1 font-medium">Zuletzt geändert</th>
        </tr>
      </thead>
      <tbody>
        {studies.map((s) => (
          <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50">
            <td className="py-1 tabular-nums">{formatGermanDate(s.studyDate)}</td>
            <td className="py-1">
              <button type="button" className="text-left text-sky-800 hover:underline" onClick={() => onOpen(s.id)}>
                {moduleName(s.moduleKey)}
              </button>
            </td>
            <td className="py-1 tabular-nums text-slate-500">{new Date(s.updatedAt).toLocaleString('de-DE')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
