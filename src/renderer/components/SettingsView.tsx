// Settings: Betriebsmodus switch (gateway §2.3) and extraction providers.
import { useState } from 'react';
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
            Kein Anbieter konfiguriert. Die manuelle Eingabe ist immer verfügbar; die Extraktion füllt nur vor.
          </p>
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
