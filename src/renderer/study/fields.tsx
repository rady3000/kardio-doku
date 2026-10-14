// Generic field controls for any module schema (no module-specific UI).
import { useEffect, useState } from 'react';
import type { Scalar } from '../../core/conditions';
import type { ValueSource } from '../../core/evaluate';
import { formatDecimal, parseDecimal } from '../../core/format';
import { selectOptions, type NumberField, type SelectField, type TextField } from '../../core/schema';
import { inputClass } from '../components/ui';

export function NumberInput(props: {
  field: NumberField;
  value: Scalar | undefined;
  outOfRange: boolean;
  category?: string;
  onChange: (v: number | undefined) => void;
}) {
  const { field, value } = props;
  const [text, setText] = useState(typeof value === 'number' ? formatDecimal(value, 6) : '');
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    const parsed = parseDecimal(text);
    if (typeof value === 'number' && parsed !== value) setText(formatDecimal(value, 6));
    if (value === undefined && parsed !== null) setText('');
  }, [value]);

  return (
    <div className="flex items-center gap-1.5">
      <input
        id={`f-${field.key}`}
        className={`${inputClass.replace('w-full', 'w-20')} shrink-0 text-right tabular-nums ${
          invalid ? 'border-red-600' : props.outOfRange ? 'border-amber-500 bg-amber-50' : ''
        }`}
        inputMode="decimal"
        value={text}
        title={props.outOfRange ? 'außerhalb des Referenzbereichs' : undefined}
        onChange={(e) => {
          const t = e.target.value;
          setText(t);
          if (t.trim() === '') {
            setInvalid(false);
            props.onChange(undefined);
            return;
          }
          const n = parseDecimal(t);
          setInvalid(n === null);
          if (n !== null) props.onChange(n);
        }}
      />
      <span className="w-10 shrink-0 text-[11px] text-slate-500">{field.unit}</span>
      {invalid ? (
        <span className="text-[11px] text-red-700">ungültige Zahl</span>
      ) : props.category ? (
        <span className={`truncate text-[11px] ${props.outOfRange ? 'text-amber-800' : 'text-slate-500'}`}>{props.category}</span>
      ) : props.outOfRange ? (
        <span className="text-[11px] text-amber-800">außerhalb des Referenzbereichs</span>
      ) : null}
    </div>
  );
}

export function SelectInput(props: {
  field: SelectField;
  value: Scalar | undefined;
  source: ValueSource | undefined;
  suggestion?: string;
  onChange: (v: string | null | undefined) => void;
}) {
  const { field, value, source, suggestion } = props;
  const options = selectOptions(field);
  const auto = source === 'auto';
  return (
    <div className="flex items-center gap-1.5">
      <select
        id={`f-${field.key}`}
        className={`${inputClass} ${auto ? 'border-dashed border-sky-600 bg-sky-50' : ''}`}
        value={value === undefined ? '' : String(value)}
        title={auto ? 'Automatisch aus dem Messwert vorausgewählt' : undefined}
        onChange={(e) => {
          const v = e.target.value;
          if (v === '') props.onChange(field.autoFrom ? null : undefined);
          else props.onChange(v);
        }}
      >
        <option value="">–</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.short ? `${o.value} (${o.short})` : o.value}
          </option>
        ))}
      </select>
      {auto && <span className="shrink-0 text-[10px] font-semibold uppercase text-sky-700">auto</span>}
      {!auto && suggestion !== undefined && suggestion !== value && (
        <button
          type="button"
          tabIndex={-1}
          className="shrink-0 text-[11px] text-sky-800 underline"
          title="Vorschlag aus dem Messwert übernehmen"
          onClick={() => props.onChange(undefined)}
        >
          Vorschlag: {suggestion}
        </button>
      )}
    </div>
  );
}

export function TextInput(props: { field: TextField; value: Scalar | undefined; onChange: (v: string | undefined) => void }) {
  const { field } = props;
  const common = {
    id: `f-${field.key}`,
    value: props.value === undefined ? '' : String(props.value),
    onChange: (e: { target: { value: string } }) => props.onChange(e.target.value === '' ? undefined : e.target.value),
  };
  return field.multiline ? (
    <textarea {...common} rows={2} className={`${inputClass} h-auto py-1`} />
  ) : (
    <input {...common} className={inputClass} />
  );
}
