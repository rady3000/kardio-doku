// Live report preview. Every generated sentence is editable and removable;
// the physician's edit is stored and wins (CLAUDE.md rule 6).
import { useState } from 'react';
import type { ReportLine, ReportModel, ReportSection, ReportSentence } from '../../core/report';
import { measurementText } from '../../core/report';
import type { ExportFormat, LibraryBlockInfo } from '../../shared/types';
import { buttonClass, primaryButtonClass } from '../components/ui';

export interface ReportActions {
  saveSentence: (s: ReportSentence, text: string) => void;
  removeSentence: (s: ReportSentence) => void;
  restoreSentence: (s: ReportSentence) => void;
  setExtra: (lineId: string, text: string) => void;
  insertBlock: (b: LibraryBlockInfo) => void;
}

export function ReportPanel(props: {
  model: ReportModel;
  blockers: string[];
  library: LibraryBlockInfo[];
  extras: Record<string, string>;
  actions: ReportActions;
  onExport: (f: ExportFormat) => void;
  exportMessage: { ok: boolean; text: string } | null;
}) {
  const { model } = props;
  const blocked = props.blockers.length > 0;
  return (
    <aside className="flex w-[42rem] shrink-0 flex-col border-l border-slate-200 bg-white">
      <div className="space-y-1.5 border-b border-slate-200 p-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" className={primaryButtonClass} disabled={blocked} onClick={() => props.onExport('clipboard')}>
            Kopieren <kbd className="border-sky-700 bg-sky-900 text-sky-100">Strg+Umschalt+C</kbd>
          </button>
          <button type="button" className={buttonClass} disabled={blocked} onClick={() => props.onExport('docx')}>
            DOCX <kbd>Strg+Umschalt+D</kbd>
          </button>
          <button type="button" className={buttonClass} disabled={blocked} onClick={() => props.onExport('pdf')}>
            PDF <kbd>Strg+Umschalt+P</kbd>
          </button>
          <LibraryPicker blocks={props.library} onInsert={props.actions.insertBlock} />
        </div>
        {blocked && <p className="text-red-700">Export gesperrt – unbestätigte Werte: {props.blockers.join(', ')}</p>}
        {props.exportMessage && (
          <p role="status" className={props.exportMessage.ok ? 'text-emerald-700' : 'text-red-700'}>
            {props.exportMessage.text}
          </p>
        )}
        <p className="text-[11px] text-slate-500">
          Satz anklicken oder <kbd>Enter</kbd> zum Bearbeiten, <kbd>Entf</kbd> zum Entfernen. Ihre Änderung bleibt erhalten.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 leading-relaxed" data-testid="report-preview">
        <p className="font-semibold">{model.title}</p>
        {model.head.map((s) => (
          <SectionView key={s.id} section={s} {...props} />
        ))}
        {model.measurements.some((g) => g.items.length > 0) && (
          <div className="mt-3">
            <p className="font-semibold">{model.measurementsHeading}</p>
            {model.measurements
              .filter((g) => g.items.length)
              .map((g) => (
                <p key={g.label}>
                  <span className="font-medium">{g.label}</span> {g.items.map(measurementText).join('; ')}
                </p>
              ))}
          </div>
        )}
        {model.body.map((s) => (
          <SectionView key={s.id} section={s} {...props} />
        ))}
        {model.rulesUsed.length > 0 && (
          <p className="mt-4 border-t border-slate-200 pt-1 text-[11px] text-slate-500">
            Regelwerke:{' '}
            {model.rulesUsed.map((r) => (
              <span key={r.id} title={`${r.title}\n${r.source}`} className="mr-2 inline-block">
                {r.id} v{r.version} ({r.reviewedOn})
              </span>
            ))}
          </p>
        )}
      </div>
    </aside>
  );
}

function SectionView(props: { section: ReportSection; extras: Record<string, string>; actions: ReportActions }) {
  const { section } = props;
  const lines = section.lines.filter((l) => l.sentences.length > 0 || !l.library);
  if (!lines.some((l) => l.sentences.length > 0) && section.lines.every((l) => l.library)) return null;
  return (
    <div className="mt-3">
      {section.heading && <p className="font-semibold">{section.heading}</p>}
      {lines.map((l) => (
        <LineView key={l.id} line={l} extras={props.extras} actions={props.actions} />
      ))}
    </div>
  );
}

function LineView({ line, extras, actions }: { line: ReportLine; extras: Record<string, string>; actions: ReportActions }) {
  const [addingExtra, setAddingExtra] = useState(false);
  const generated = line.sentences.filter((s) => s.kind !== 'extra');
  const extra = line.sentences.find((s) => s.kind === 'extra');
  if (generated.length === 0 && !extra && !line.label) return null;
  return (
    <p className="group">
      {line.label && <span className="font-medium">{line.label} </span>}
      {generated.map((s) => (
        <SentenceView key={s.id} s={s} actions={actions} />
      ))}
      {(extra || addingExtra) && (
        <EditableText
          initial={extras[line.id] ?? ''}
          startEditing={addingExtra}
          className="text-slate-800"
          onSave={(t) => {
            setAddingExtra(false);
            actions.setExtra(line.id, t);
          }}
          onCancel={() => setAddingExtra(false)}
        />
      )}
      {!extra && !addingExtra && (
        <button
          type="button"
          tabIndex={-1}
          className="ml-1 rounded-sm px-1 text-[11px] text-slate-400 opacity-0 hover:bg-slate-100 group-hover:opacity-100"
          title="Freitext ergänzen"
          onClick={() => setAddingExtra(true)}
        >
          + Text
        </button>
      )}
    </p>
  );
}

function SentenceView({ s, actions }: { s: ReportSentence; actions: ReportActions }) {
  if (s.removed) {
    return (
      <button
        type="button"
        className="mx-0.5 rounded-sm border border-dashed border-slate-300 px-1 text-[11px] text-slate-400 hover:text-slate-700"
        title={`Entfernt: ${s.generated ?? ''}\nEnter: wiederherstellen`}
        onClick={() => actions.restoreSentence(s)}
      >
        [entfernt]
      </button>
    );
  }
  return (
    <>
      <EditableText
        initial={s.text}
        className={`${s.edited ? 'underline decoration-sky-600 decoration-dotted underline-offset-2' : ''} ${
          s.kind === 'library' ? 'whitespace-pre-line' : ''
        }`}
        title={s.edited ? `Geändert. Automatischer Text: ${s.generated ?? '(keiner)'}` : undefined}
        onSave={(t) => (t.trim() === '' ? actions.removeSentence(s) : actions.saveSentence(s, t))}
        onDelete={() => actions.removeSentence(s)}
      />
      {s.stale && (
        <button
          type="button"
          className="mx-0.5 rounded-sm bg-amber-100 px-1 text-[11px] text-amber-900"
          title={`Der automatische Text hat sich seit Ihrer Änderung geändert:\n${s.generated ?? '(kein automatischer Text mehr)'}\nKlicken: automatischen Text übernehmen`}
          onClick={() => actions.restoreSentence(s)}
        >
          geändert ↺
        </button>
      )}{' '}
    </>
  );
}

function EditableText(props: {
  initial: string;
  className?: string;
  title?: string;
  startEditing?: boolean;
  onSave: (text: string) => void;
  onDelete?: () => void;
  onCancel?: () => void;
}) {
  const [editing, setEditing] = useState(!!props.startEditing);
  if (editing) {
    return (
      <textarea
        autoFocus
        defaultValue={props.initial}
        rows={Math.max(1, Math.ceil(props.initial.length / 70))}
        className="my-0.5 block w-full rounded-sm border border-sky-600 px-1 py-0.5 text-[13px] focus:outline-none"
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            setEditing(false);
            props.onSave(e.currentTarget.value);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            setEditing(false);
            props.onCancel?.();
          }
        }}
        onBlur={(e) => {
          setEditing(false);
          if (e.target.value !== props.initial) props.onSave(e.target.value);
          else props.onCancel?.();
        }}
      />
    );
  }
  return (
    <span
      role="button"
      tabIndex={0}
      title={props.title}
      className={`cursor-text rounded-sm hover:bg-sky-50 focus:bg-sky-50 ${props.className ?? ''}`}
      onClick={() => setEditing(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          setEditing(true);
        } else if ((e.key === 'Delete' || e.key === 'Backspace') && props.onDelete) {
          e.preventDefault();
          props.onDelete();
        }
      }}
    >
      {props.initial}
    </span>
  );
}

function LibraryPicker({ blocks, onInsert }: { blocks: LibraryBlockInfo[]; onInsert: (b: LibraryBlockInfo) => void }) {
  if (blocks.length === 0) return null;
  return (
    <select
      aria-label="Textbaustein einfügen"
      className="ml-auto h-7 rounded-sm border border-slate-300 bg-white px-1 text-[13px]"
      value=""
      onChange={(e) => {
        const b = blocks.find((x) => x.id === e.target.value);
        if (b) onInsert(b);
      }}
    >
      <option value="">Textbaustein einfügen …</option>
      {blocks.map((b) => (
        <option key={b.id} value={b.id}>
          {b.title}
          {b.status === 'draft' ? ' (Entwurf, nicht geprüft)' : ` (geprüft ${b.reviewedOn})`}
        </option>
      ))}
    </select>
  );
}
