// Settings: Betriebsmodus switch (gateway §2.3) and extraction providers.
import { useEffect, useState } from 'react';
import type { ExtractionSettings } from '../../shared/types';
import { api } from '../api';
import { buttonClass as btn, inputClass } from './ui';
import type { Betriebsmodus } from '../../shared/mode';
import type { AppState } from '../../shared/types';
import { ConfirmDialog } from './ConfirmDialog';
import { SectionTitle, buttonClass } from './ui';

export function SettingsView(props: { state: AppState; onSwitchMode: (mode: Betriebsmodus) => Promise<void> }) {
  const { state } = props;
  const [asking, setAsking] = useState<Betriebsmodus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const target: Betriebsmodus = state.mode === 'TESTBETRIEB' ? 'ECHTBETRIEB' : 'TESTBETRIEB';

  const confirm = async () => {
    if (!asking) return;
    const next = asking;
    setAsking(null);
    try {
      setError(null);
      await props.onSwitchMode(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="max-w-3xl space-y-6">
        <section>
          <SectionTitle>Betriebsmodus</SectionTitle>
          <div className="space-y-2">
            <p>
              Aktueller Modus: <strong>{state.mode}</strong>
            </p>
            <p className="text-slate-600">
              Test- und Echtbetrieb haben getrennte Datenbanken (test.db / live.db). Es gibt keinen Import zwischen
              beiden.
            </p>
            <button type="button" className={buttonClass} onClick={() => setAsking(target)}>
              Wechseln zu {target}
            </button>
            {error && <p className="text-red-700">{error}</p>}
          </div>
        </section>

        <section>
          <SectionTitle>Dokumentenextraktion</SectionTitle>
          <p className="mb-2 text-slate-600">
            Die manuelle Eingabe ist immer verfügbar; die Extraktion füllt nur vor. Jeder extrahierte Wert bleibt bis zu
            Ihrer Bestätigung gesperrt.
          </p>
          <ExtractionSettingsForm mode={state.mode} />
          <table className="w-full border-collapse">
            <tbody>
              {state.providers.map((p) => (
                <tr key={p.id} className={`border-t border-slate-100 ${p.enabled ? '' : 'text-slate-400'}`}>
                  <td className="py-1.5">{p.displayName}</td>
                  <td className="w-24 py-1.5">{p.isLocal ? 'lokal' : 'Cloud'}</td>
                  <td className="py-1.5">{p.disabledReason ?? 'verfügbar'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <SectionTitle>Information</SectionTitle>
          <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1">
            <dt className="text-right text-slate-600">Version</dt>
            <dd>{state.version}</dd>
            <dt className="text-right text-slate-600">Datenbank</dt>
            <dd className="break-all">{state.databasePath}</dd>
          </dl>
        </section>
      </div>

      {asking === 'ECHTBETRIEB' && (
        <ConfirmDialog
          title="In den Echtbetrieb wechseln?"
          confirmLabel="In den Echtbetrieb wechseln"
          acknowledge="Ich habe die Folgen gelesen."
          onConfirm={() => void confirm()}
          onCancel={() => setAsking(null)}
        >
          <ul className="list-disc space-y-1 pl-5">
            <li>Ab jetzt wird die Datenbank live.db verwendet – für echte Patientendaten.</li>
            <li>
              Die Testdaten (test.db) bleiben erhalten, sind im Echtbetrieb aber nicht sichtbar. Es gibt keinen
              Import zwischen beiden.
            </li>
            <li>Cloud-Extraktion ist im Echtbetrieb gesperrt.</li>
            <li>
              In der Testphase ist die Anwendung nicht für die Patientendokumentation freigegeben (kein
              Medizinprodukt).
            </li>
          </ul>
        </ConfirmDialog>
      )}
      {asking === 'TESTBETRIEB' && (
        <ConfirmDialog
          title="In den Testbetrieb wechseln?"
          confirmLabel="In den Testbetrieb wechseln"
          onConfirm={() => void confirm()}
          onCancel={() => setAsking(null)}
        >
          <p>
            Die Datenbank test.db wird verwendet. Die Daten des Echtbetriebs bleiben in live.db und sind im
            Testbetrieb nicht sichtbar.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}

/** Provider, API key (Electron safeStorage, never shown again), confidence threshold (gateway §6). */
function ExtractionSettingsForm({ mode }: { mode: Betriebsmodus }) {
  const [s, setS] = useState<ExtractionSettings | null>(null);
  const [key, setKey] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    void api.getExtractionSettings().then(setS);
  }, [mode]);
  if (!s) return null;
  const run = async (f: () => Promise<ExtractionSettings>, ok: string) => {
    try {
      setS(await f());
      setMsg(ok);
    } catch (err) {
      setMsg(err instanceof Error ? err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(err));
    }
  };
  const cloudBlocked = mode === 'ECHTBETRIEB';
  return (
    <div className="mb-3 grid max-w-2xl grid-cols-[11rem_1fr] items-center gap-x-3 gap-y-2">
      <label htmlFor="x-provider" className="text-right text-slate-600">
        Anbieter
      </label>
      <select
        id="x-provider"
        className={`${inputClass} w-72`}
        value={s.provider === 'mock' ? 'none' : s.provider}
        onChange={(e) => void run(() => api.setExtractionSettings({ provider: e.target.value }), 'Anbieter gespeichert.')}
      >
        <option value="none">Kein Anbieter (nur manuelle Eingabe)</option>
        <option value="mistral-ocr" disabled={cloudBlocked}>
          Mistral OCR (Cloud, EU){cloudBlocked ? ' – im Echtbetrieb gesperrt' : ''}
        </option>
      </select>
      <label htmlFor="x-key" className="text-right text-slate-600">
        API-Schlüssel
      </label>
      <div className="flex items-center gap-2">
        <input
          id="x-key"
          type="password"
          autoComplete="off"
          className={`${inputClass} w-72`}
          placeholder={s.hasApiKey ? 'gespeichert (verschlüsselt)' : 'Mistral API-Schlüssel'}
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
        <button
          type="button"
          className={btn}
          disabled={key.trim().length < 10}
          onClick={() =>
            void run(async () => {
              const r = await api.setApiKey(key);
              setKey('');
              return r;
            }, 'Schlüssel verschlüsselt gespeichert.')
          }
        >
          Speichern
        </button>
        {s.hasApiKey && (
          <button type="button" className={btn} onClick={() => void run(() => api.deleteApiKey(), 'Schlüssel gelöscht.')}>
            Löschen
          </button>
        )}
      </div>
      {!s.encryptionAvailable && (
        <p className="col-start-2 text-[11px] text-red-700">Verschlüsselte Ablage nicht verfügbar – ein Schlüssel kann nicht gespeichert werden.</p>
      )}
      <label htmlFor="x-threshold" className="text-right text-slate-600">
        Mindest-Konfidenz
      </label>
      <input
        id="x-threshold"
        type="number"
        min={0.5}
        max={1}
        step={0.01}
        className={`${inputClass} w-24`}
        value={s.confidenceThreshold}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (v >= 0.5 && v <= 1) void run(() => api.setExtractionSettings({ confidenceThreshold: v }), 'Gespeichert.');
        }}
      />
      <span className="text-right text-slate-600">Verarbeitet</span>
      <span className="text-slate-600">
        {s.documentsProcessed} Dokumente in dieser Datenbank (Mistral OCR: ca. 0,004 USD je Seite)
      </span>
      {msg && <p className="col-start-2 text-[12px] text-slate-700">{msg}</p>}
    </div>
  );
}
