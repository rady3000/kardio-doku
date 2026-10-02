// Contract between renderer and main process, exposed by the preload script
// as `window.kardio`.
import type { Betriebsmodus } from './mode';
import type { AppState, Patient, PatientInput, Study, StudyCreate, StudyUpdate } from './types';

export interface KardioApi {
  getAppState(): Promise<AppState>;
  /** Switching to ECHTBETRIEB requires `confirmed: true` (gateway §2.3). */
  setMode(mode: Betriebsmodus, confirmed: boolean): Promise<AppState>;

  listPatients(query: string): Promise<Patient[]>;
  getPatient(id: number): Promise<Patient | null>;
  createPatient(): Promise<Patient>;
  updatePatient(id: number, input: PatientInput): Promise<Patient>;

  listStudies(patientId: number): Promise<Study[]>;
  getStudy(id: number): Promise<Study | null>;
  createStudy(input: StudyCreate): Promise<Study>;
  updateStudy(id: number, update: StudyUpdate): Promise<Study>;

  /** Main asks the renderer to flush pending autosaves before the window closes. */
  onBeforeClose(handler: () => Promise<void>): void;
}

export const IPC = {
  getAppState: 'app:get-state',
  setMode: 'app:set-mode',
  listPatients: 'patients:list',
  getPatient: 'patients:get',
  createPatient: 'patients:create',
  updatePatient: 'patients:update',
  listStudies: 'studies:list',
  getStudy: 'studies:get',
  createStudy: 'studies:create',
  updateStudy: 'studies:update',
  beforeClose: 'app:before-close',
  closeReady: 'app:close-ready',
} as const;
