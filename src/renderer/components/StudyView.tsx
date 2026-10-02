// Study page. In M1 it holds the study metadata only; the module forms come
// with the schema engine (M2 onwards).
import { useEffect, useState } from 'react';
import { formatGermanDate } from '../../shared/dates';
import { MODULES } from '../../shared/modules';
import type { Patient, Study } from '../../shared/types';
import { api } from '../api';
import { useAutosave } from '../autosave';
import { DateInput } from './DateInput';
import { patientDisplayName } from './PatientList';
import { Field, SaveIndicator, SectionTitle, buttonClass } from './ui';

export function StudyView(props: { study: Study; patient: Patient; onBack: () => void }) {
  const { study } = props;
  const [studyDate, setStudyDate] = useState<string | null>(study.studyDate);
  const [dateError, setDateError] = useState<string | null>(null);
  const status = useAutosave(studyDate, async (value) => {
    if (value) await api.updateStudy(study.id, { studyDate: value });
  });
  const module = MODULES.find((m) => m.key === study.moduleKey);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('dialog[open]')) props.onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props]);

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <button type="button" className={buttonClass} onClick={props.onBack}>
            ← Zurück <kbd>Esc</kbd>
          </button>
          <div>
            <div className="text-[15px] font-semibold">{module?.name ?? study.moduleKey}</div>
            <div className="text-slate-500">
              {patientDisplayName(props.patient)}
              {props.patient.birthDate && `, geb. ${formatGermanDate(props.patient.birthDate)}`}
            </div>
          </div>
        </div>

        <section>
          <SectionTitle right={<SaveIndicator status={status} />}>Untersuchungsdaten</SectionTitle>
          <Field label="Untersuchungsdatum" htmlFor="s-date-edit" required error={dateError}>
            <DateInput
              id="s-date-edit"
              value={studyDate}
              onChange={setStudyDate}
              onError={setDateError}
              allowEmpty={false}
              autoFocus
            />
          </Field>
        </section>

        <div className="rounded-sm border border-dashed border-slate-300 bg-white p-4 text-slate-600">
          Das Formular für dieses Modul folgt in Meilenstein {module?.milestone ?? '–'}.
        </div>
      </div>
    </div>
  );
}
