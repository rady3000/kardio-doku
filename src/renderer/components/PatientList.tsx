import { forwardRef } from 'react';
import { formatGermanDate } from '../../shared/dates';
import type { Patient } from '../../shared/types';
import { buttonClass, inputClass } from './ui';

export function patientDisplayName(p: Pick<Patient, 'lastName' | 'firstName'>): string {
  const name = [p.lastName, p.firstName].filter((s) => s.trim() !== '').join(', ');
  return name || '(ohne Namen)';
}

export const PatientList = forwardRef<
  HTMLInputElement,
  {
    patients: Patient[];
    query: string;
    selectedId: number | null;
    onQueryChange: (q: string) => void;
    onSelect: (id: number) => void;
    onCreate: () => void;
  }
>(function PatientList(props, searchRef) {
  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="space-y-2 border-b border-slate-200 p-2">
        <input
          ref={searchRef}
          className={inputClass}
          placeholder="Patient suchen …"
          aria-label="Patient suchen"
          value={props.query}
          onChange={(e) => props.onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            const first = props.patients[0];
            if (e.key === 'Enter' && first) props.onSelect(first.id);
          }}
        />
        <button type="button" className={`${buttonClass} w-full justify-between`} onClick={props.onCreate}>
          Neuer Patient <kbd>Strg+N</kbd>
        </button>
      </div>
      <ul className="flex-1 overflow-y-auto" aria-label="Patienten">
        {props.patients.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => props.onSelect(p.id)}
              className={`flex w-full items-baseline justify-between gap-2 border-b border-slate-100 px-3 py-1.5 text-left hover:bg-slate-50 ${
                p.id === props.selectedId ? 'bg-sky-50 font-medium text-sky-900' : ''
              }`}
            >
              <span className="truncate">{patientDisplayName(p)}</span>
              <span className="shrink-0 tabular-nums text-[11px] text-slate-500">
                {formatGermanDate(p.birthDate)}
              </span>
            </button>
          </li>
        ))}
        {props.patients.length === 0 && (
          <li className="px-3 py-3 text-slate-500">
            {props.query ? 'Kein Patient gefunden.' : 'Noch keine Patienten angelegt.'}
          </li>
        )}
      </ul>
    </aside>
  );
});
