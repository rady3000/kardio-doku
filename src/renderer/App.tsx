// Application shell: TESTDATEN banner, header, patient list and main view.
import { useCallback, useEffect, useRef, useState } from 'react';
import { TESTDATEN_MARKER, type Betriebsmodus } from '../shared/mode';
import type { AppState, Patient, Study } from '../shared/types';
import { api } from './api';
import { flushAllAutosaves } from './autosave';
import { PatientDetail } from './components/PatientDetail';
import { PatientList } from './components/PatientList';
import { SettingsView } from './components/SettingsView';
import { StudyView } from './components/StudyView';

type View = { kind: 'patients' } | { kind: 'study'; study: Study } | { kind: 'settings' };

export function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Patient | null>(null);
  const [newPatientId, setNewPatientId] = useState<number | null>(null);
  const [view, setView] = useState<View>({ kind: 'patients' });
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void api.getAppState().then(setState);
  }, []);

  useEffect(() => {
    if (!state) return;
    void api.listPatients(query).then(setPatients);
  }, [query, state]);

  const selectPatient = useCallback(async (id: number) => {
    await flushAllAutosaves();
    setSelected(await api.getPatient(id));
    setView({ kind: 'patients' });
  }, []);

  const createPatient = useCallback(async () => {
    await flushAllAutosaves();
    const p = await api.createPatient();
    setQuery('');
    setPatients(await api.listPatients(''));
    setNewPatientId(p.id);
    setSelected(p);
    setView({ kind: 'patients' });
  }, []);

  const onPatientSaved = useCallback((p: Patient) => {
    setPatients((list) => list.map((x) => (x.id === p.id ? p : x)));
    setSelected((s) => (s?.id === p.id ? p : s));
  }, []);

  const openStudy = useCallback(async (id: number) => {
    await flushAllAutosaves();
    const study = await api.getStudy(id);
    if (study) setView({ kind: 'study', study });
  }, []);

  const switchMode = useCallback(async (mode: Betriebsmodus) => {
    await flushAllAutosaves();
    const next = await api.setMode(mode, true);
    setSelected(null);
    setQuery('');
    setState(next);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return;
      const key = e.key.toLowerCase();
      if (e.ctrlKey && !e.altKey && key === 'n') {
        e.preventDefault();
        void createPatient();
      } else if (e.ctrlKey && !e.altKey && key === 'f') {
        e.preventDefault();
        setView((v) => (v.kind === 'settings' ? { kind: 'patients' } : v));
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (e.altKey && key === '1') {
        e.preventDefault();
        setView({ kind: 'patients' });
      } else if (e.altKey && key === '2') {
        e.preventDefault();
        void flushAllAutosaves().then(() => setView({ kind: 'settings' }));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [createPatient]);

  if (!state) return null;
  const testMode = state.mode === 'TESTBETRIEB';

  return (
    <div className="flex h-full flex-col">
      {testMode && (
        <div
          role="alert"
          data-testid="testdaten-banner"
          className="shrink-0 bg-amber-400 px-4 py-1 text-center text-[13px] font-bold tracking-wide text-amber-950"
        >
          {TESTDATEN_MARKER}
        </div>
      )}
      <header className="flex h-10 shrink-0 items-center gap-4 border-b border-slate-300 bg-slate-800 px-4 text-slate-100">
        <span className="font-semibold">Kardio-Doku</span>
        <nav className="flex gap-1">
          <NavButton active={view.kind !== 'settings'} onClick={() => setView({ kind: 'patients' })}>
            Patienten <kbd>Alt+1</kbd>
          </NavButton>
          <NavButton
            active={view.kind === 'settings'}
            onClick={() => void flushAllAutosaves().then(() => setView({ kind: 'settings' }))}
          >
            Einstellungen <kbd>Alt+2</kbd>
          </NavButton>
        </nav>
        <span
          data-testid="mode-badge"
          className={`ml-auto rounded-sm px-2 py-0.5 text-[11px] font-semibold tracking-wide ${
            testMode ? 'bg-amber-400 text-amber-950' : 'bg-emerald-600 text-white'
          }`}
        >
          {state.mode}
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        {view.kind === 'settings' ? (
          <SettingsView state={state} onSwitchMode={switchMode} />
        ) : (
          <>
            <PatientList
              ref={searchRef}
              patients={patients}
              query={query}
              selectedId={selected?.id ?? null}
              onQueryChange={setQuery}
              onSelect={(id) => void selectPatient(id)}
              onCreate={() => void createPatient()}
            />
            {view.kind === 'study' && selected ? (
              <StudyView
                key={view.study.id}
                study={view.study}
                patient={selected}
                onBack={() => {
                  void flushAllAutosaves().then(() => setView({ kind: 'patients' }));
                }}
              />
            ) : selected ? (
              <PatientDetail
                key={selected.id}
                patient={selected}
                autoFocusName={selected.id === newPatientId}
                onSaved={onPatientSaved}
                onOpenStudy={(id) => void openStudy(id)}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center text-slate-500">
                Patient auswählen oder neu anlegen (<kbd>Strg+N</kbd>).
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function NavButton(props: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`flex items-center gap-1.5 rounded-sm px-2 py-1 ${
        props.active ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700'
      }`}
    >
      {props.children}
    </button>
  );
}
