// Small shared UI building blocks: dense, calm, consistent.
import type { ReactNode } from 'react';
import type { AutosaveStatus } from '../autosave';

export const inputClass =
  'h-7 w-full rounded-sm border border-slate-300 bg-white px-2 text-[13px] text-slate-900 focus:border-sky-600 focus:outline-none disabled:bg-slate-100';

export const buttonClass =
  'inline-flex h-7 items-center gap-1.5 rounded-sm border border-slate-300 bg-white px-2.5 text-[13px] text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50';

export const primaryButtonClass =
  'inline-flex h-7 items-center gap-1.5 rounded-sm border border-sky-800 bg-sky-800 px-2.5 text-[13px] font-medium text-white hover:bg-sky-900 disabled:cursor-not-allowed disabled:opacity-50';

export function Field(props: {
  label: string;
  htmlFor: string;
  required?: boolean;
  missing?: boolean;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[9rem_1fr] items-center gap-x-3 gap-y-0.5">
      <label htmlFor={props.htmlFor} className="text-right text-slate-600">
        {props.label}
        {props.required && <span className="text-slate-400"> *</span>}
      </label>
      <div>{props.children}</div>
      {(props.error || props.missing) && (
        <div className="col-start-2 text-[11px] text-amber-700">{props.error ?? 'Pflichtfeld'}</div>
      )}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between border-b border-slate-200 pb-1">
      <h2 className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">{children}</h2>
      {right}
    </div>
  );
}

export function SaveIndicator({ status }: { status: AutosaveStatus }) {
  const time = status.savedAt?.toLocaleTimeString('de-DE');
  const text: Record<AutosaveStatus['state'], string> = {
    idle: '',
    pending: 'Ungespeicherte Änderung …',
    saving: 'Speichert …',
    saved: `Gespeichert ${time ?? ''}`,
    error: `Speichern fehlgeschlagen: ${status.error ?? ''}`,
  };
  return (
    <span
      role="status"
      className={status.state === 'error' ? 'text-[11px] text-red-700' : 'text-[11px] text-slate-500'}
    >
      {text[status.state]}
    </span>
  );
}
