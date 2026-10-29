// One form section, rendered from the schema.
import { evaluate as evalCond } from '../../core/conditions';
import type { Evaluation } from '../../core/evaluate';
import { RULES } from '../../core/rules/registry';
import type { CriteriaTable, DerivedDisplay, Field, ModuleSchema, Section } from '../../core/schema';
import { renderString } from '../../core/template';
import { formatDecimal } from '../../core/format';
import { buttonClass } from '../components/ui';
import type { StudyData } from '../../core/studyData';
import { DateFieldInput, NumberInput, SelectInput, TextInput } from './fields';

export function FormSection(props: {
  schema: ModuleSchema;
  section: Section;
  ev: Evaluation;
  data: StudyData;
  setValue: (key: string, v: string | number | null | undefined) => void;
  onNormal: () => void;
}) {
  const { section, ev, schema } = props;
  const fields = section.fields.filter((f) => ev.visible.has(f.key));
  const displays = schema.displays.filter((d) => d.section === section.key);
  const tables = schema.tables.filter((t) => t.section === section.key);
  const hasNormal = section.fields.some((f) => f.normal !== undefined);
  const warnings = ev.warnings.filter((w) => w.section === section.key);
  if (fields.length === 0 && displays.length === 0 && tables.length === 0) return null; // e.g. ICD section for a pacemaker

  return (
    <section data-section={section.key} className="rounded-sm border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-1">
        <h3 className="text-[12px] font-semibold uppercase tracking-wide text-slate-600">{section.title}</h3>
        {hasNormal && (
          <button type="button" tabIndex={-1} className={`${buttonClass} h-6 text-[12px]`} onClick={props.onNormal}>
            Alles normal <kbd>Alt+N</kbd>
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 px-3 py-2">
        {fields.map((f) => (
          <FieldRow key={f.key} field={f} {...props} />
        ))}
      </div>
      {warnings.map((w) => (
        <p key={w.text} role="note" className="mx-3 mb-2 rounded-sm border border-amber-300 bg-amber-50 px-2 py-1 text-amber-900">
          {w.text}
        </p>
      ))}
      {displays.map((d) => (
        <DisplayBox key={d.label} display={d} ev={ev} schema={schema} />
      ))}
      {tables.map((t) => (
        <CriteriaTableView key={t.title} table={t} ev={ev} />
      ))}
    </section>
  );
}

function FieldRow(props: {
  field: Field;
  ev: Evaluation;
  data: StudyData;
  setValue: (key: string, v: string | number | null | undefined) => void;
}) {
  const { field, ev } = props;
  const value = ev.values.get(field.key);
  const wide = field.type === 'text';
  return (
    <div className={`flex items-center gap-2 ${wide ? 'col-span-2' : ''}`}>
      <label htmlFor={`f-${field.key}`} className="w-36 shrink-0 truncate text-right text-slate-600" title={field.help ?? field.label}>
        {field.label}
      </label>
      <div className="min-w-0 flex-1">
        {field.type === 'number' ? (
          <NumberInput
            field={field}
            stored={props.data.values[field.key]}
            outOfRange={ev.outOfRange.has(field.key)}
            category={categoryFor(field.referenceRule, ev)}
            onChange={(v) => props.setValue(field.key, v)}
          />
        ) : field.type === 'select' ? (
          <SelectInput
            field={field}
            value={value}
            source={ev.source.get(field.key)}
            suggestion={ev.suggestions.get(field.key)}
            onChange={(v) => props.setValue(field.key, v)}
          />
        ) : field.type === 'date' ? (
          <DateFieldInput field={field} value={value} onChange={(v) => props.setValue(field.key, v)} />
        ) : (
          <TextInput field={field} value={value} onChange={(v) => props.setValue(field.key, v)} />
        )}
      </div>
    </div>
  );
}

function categoryFor(ruleId: string | undefined, ev: Evaluation): string | undefined {
  if (!ruleId) return undefined;
  const rule = RULES.rules.get(ruleId);
  if (rule?.purpose !== 'category') return undefined;
  return ev.classifications.get(ruleId)?.band.label ?? undefined;
}

function DisplayBox({ display, ev, schema }: { display: DerivedDisplay; ev: Evaluation; schema: ModuleSchema }) {
  if (display.when && !evalCond(display.when, ev.resolver)) return null;
  const text = renderString(typeof display.template === 'string' ? display.template : '', (ph) => {
    const d = ev.derived.get(ph);
    return d === undefined ? undefined : String(d);
  });
  const fields = new Map(schema.sections.flatMap((s) => s.fields).map((f) => [f.key, f]));
  const inputs = display.inputs
    .map((k) => {
      const f = fields.get(k);
      const v = ev.values.get(k);
      if (!f || v === undefined) return `${f?.label ?? k}: –`;
      const shown = typeof v === 'number' && f.type === 'number' ? `${formatDecimal(v, f.decimals)} ${f.unit}` : String(v);
      return `${f.label}: ${shown}`;
    })
    .join('\n');
  return (
    <div className="mx-3 mb-2 rounded-sm border border-slate-200 bg-slate-50 px-2 py-1.5" title={`Eingaben:\n${inputs}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium text-slate-700">{display.label}</span>
        <span className="tabular-nums text-slate-700">{text}</span>
      </div>
      {display.details && (
        <ul className="mt-1 grid grid-cols-2 gap-x-3 text-[11px] text-slate-600">
          {display.details.map((d) => {
            const ok = evalCond(d.when, ev.resolver);
            return (
              <li key={d.label} className={ok ? 'text-slate-900' : ''}>
                {ok ? '✓' : '–'} {d.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function CriteriaTableView({ table, ev }: { table: CriteriaTable; ev: Evaluation }) {
  const columnFor = (ruleId?: string) => {
    if (!ruleId) return -1;
    const c = ev.classifications.get(ruleId);
    const rule = RULES.rules.get(ruleId);
    if (!c || !rule) return -1;
    for (const set of rule.sets) {
      const i = set.bands.indexOf(c.band);
      if (i >= 0) return i;
    }
    return -1;
  };
  return (
    <div className="mx-3 mb-2 overflow-x-auto">
      <div className="mb-0.5 text-[11px] text-slate-500" title={table.source}>
        {table.title} – Grad wird ärztlich festgelegt
      </div>
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr>
            <th className="border border-slate-200 bg-slate-50 px-1 py-0.5 text-left font-medium"></th>
            {table.columns.map((c) => (
              <th key={c} className="border border-slate-200 bg-slate-50 px-1 py-0.5 text-left font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r) => {
            const col = columnFor(r.rule);
            return (
              <tr key={r.label}>
                <td className="border border-slate-200 px-1 py-0.5 text-slate-600">{r.label}</td>
                {r.cells.map((cell, i) => (
                  <td
                    key={i}
                    className={`border border-slate-200 px-1 py-0.5 tabular-nums ${i === col ? 'bg-sky-100 font-semibold text-sky-900' : ''}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
