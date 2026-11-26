// Contract between renderer and main process, exposed by the preload script
// as `window.kardio`.
import type { Betriebsmodus } from './mode';
import type {
  AppState,
  DocumentInfo,
  ExportFormat,
  ExtractionSettings,
  ExtractionSummary,
  ExportResult,
  LibraryBlockInfo,
  Patient,
  PatientInput,
  Study,
  StudyCreate,
  StudyUpdate,
} from './types';

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

  listDocuments(studyId: number): Promise<DocumentInfo[]>;
  documentData(documentId: number): Promise<{ info: DocumentInfo; bytes: Uint8Array } | null>;
  /** Opens a file dialog; null when cancelled. */
  importDocument(studyId: number): Promise<DocumentInfo | null>;
  confirmAnonymized(documentId: number): Promise<DocumentInfo>;
  extractDocument(studyId: number, documentId: number): Promise<ExtractionSummary>;
  /** Audit: the physician's final value for an extracted field (gateway §4.4). */
  confirmExtraction(extractionId: number, value: string, corrected: boolean): Promise<void>;
  getExtractionSettings(): Promise<ExtractionSettings>;
  setExtractionSettings(change: { provider?: string; confidenceThreshold?: number; disabledHints?: string[] }): Promise<ExtractionSettings>;
  /** Stored with Electron safeStorage; never returned. */
  setApiKey(key: string): Promise<ExtractionSettings>;
  deleteApiKey(): Promise<ExtractionSettings>;

  /** Text blocks the physician may insert in the current mode. */
  libraryBlocks(moduleKey: string): Promise<LibraryBlockInfo[]>;
  /** Exports the stored study; save dialog for DOCX/PDF. */
  exportStudy(id: number, format: ExportFormat): Promise<ExportResult>;

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
  libraryBlocks: 'library:blocks',
  listDocuments: 'documents:list',
  documentData: 'documents:data',
  importDocument: 'documents:import',
  confirmAnonymized: 'documents:anonymized',
  extractDocument: 'documents:extract',
  confirmExtraction: 'extraction:confirm',
  getExtractionSettings: 'extraction:settings',
  setExtractionSettings: 'extraction:set-settings',
  setApiKey: 'extraction:set-key',
  deleteApiKey: 'extraction:delete-key',
  exportStudy: 'studies:export',
  beforeClose: 'app:before-close',
  closeReady: 'app:close-ready',
} as const;
