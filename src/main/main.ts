// Electron main process: window, Betriebsmodus, database and IPC.
import { app, BrowserWindow, dialog, ipcMain, session } from 'electron';
import path from 'node:path';
import { z } from 'zod';
import { IPC } from '../shared/api';
import { type Betriebsmodus } from '../shared/mode';
import {
  ModeSchema,
  PatientInputSchema,
  StudyCreateSchema,
  StudyUpdateSchema,
  type AppState,
} from '../shared/types';
import { availableProviders, getProvider, providerInfo, setGatewayFetch, setGatewayKeySource } from '../gateway/registry';
import { gatewayFetch } from '../gateway/electronFetch';
import fs from 'node:fs';
import { insertableBlocks } from '../core/library';
import { exportStudy } from './export';
import { databasePath, openDatabase, type Db } from './database';
import { isAllowedRendererUrl } from './egress';
import { Repository } from './repository';
import { loadSettings, saveSettings, type Settings } from './settings';
import { DOCUMENT_TYPES, DocumentStore } from './documents';
import { runExtraction } from './extraction';
import { deleteApiKey, encryptionAvailable, hasApiKey, loadApiKey, saveApiKey } from './secrets';

// End-to-end tests run against a throw-away profile directory.
if (process.env.KARDIO_E2E_USER_DATA) app.setPath('userData', process.env.KARDIO_E2E_USER_DATA);

const userDir = () => app.getPath('userData');
const dataDir = () => path.join(userDir(), 'data');

let mode: Betriebsmodus = 'TESTBETRIEB';
let db: Db | null = null;
let repo: Repository | null = null;
let docs: DocumentStore | null = null;
let settings: Settings;
let mainWindow: BrowserWindow | null = null;

function repository(): Repository {
  if (!repo) throw new Error('Database is not open.');
  return repo;
}

function switchDatabase(next: Betriebsmodus): void {
  const opened = openDatabase(dataDir(), next); // throws before anything changes
  db?.close();
  db = opened;
  repo = new Repository(opened);
  docs = new DocumentStore(opened);
  mode = next;
  mainWindow?.setTitle(windowTitle());
}

function documents(): DocumentStore {
  if (!docs) throw new Error('Database is not open.');
  return docs;
}

function updateSettings(change: Partial<Settings>): void {
  settings = { ...settings, ...change };
  saveSettings(userDir(), settings);
}

function windowTitle(): string {
  return `Kardio-Doku – ${mode}`;
}

function appState(): AppState {
  return {
    mode,
    databasePath: databasePath(dataDir(), mode),
    version: app.getVersion(),
    providers: providerInfo(mode),
  };
}

const id = z.number().int().positive();

function registerIpc(): void {
  ipcMain.handle(IPC.getAppState, () => appState());
  ipcMain.handle(IPC.setMode, (_e, rawMode: unknown, confirmed: unknown) => {
    const next = ModeSchema.parse(rawMode);
    if (next === mode) return appState();
    if (next === 'ECHTBETRIEB' && confirmed !== true) {
      throw new Error('Switching to ECHTBETRIEB requires explicit confirmation.');
    }
    switchDatabase(next);
    updateSettings({ mode: next });
    return appState();
  });

  ipcMain.handle(IPC.listPatients, (_e, q: unknown) => repository().listPatients(z.string().max(200).parse(q)));
  ipcMain.handle(IPC.getPatient, (_e, pid: unknown) => repository().getPatient(id.parse(pid)));
  ipcMain.handle(IPC.createPatient, () => repository().createPatient());
  ipcMain.handle(IPC.updatePatient, (_e, pid: unknown, input: unknown) =>
    repository().updatePatient(id.parse(pid), PatientInputSchema.parse(input)),
  );

  ipcMain.handle(IPC.listStudies, (_e, pid: unknown) => repository().listStudies(id.parse(pid)));
  ipcMain.handle(IPC.getStudy, (_e, sid: unknown) => repository().getStudy(id.parse(sid)));
  ipcMain.handle(IPC.createStudy, (_e, input: unknown) => repository().createStudy(StudyCreateSchema.parse(input)));
  ipcMain.handle(IPC.updateStudy, (_e, sid: unknown, update: unknown) =>
    repository().updateStudy(id.parse(sid), StudyUpdateSchema.parse(update)),
  );

  // ---- Documents and extraction (gateway §2.6, §3, §4) ----
  ipcMain.handle(IPC.listDocuments, (_e, sid: unknown) => documents().list(id.parse(sid)));
  ipcMain.handle(IPC.documentData, (_e, did: unknown) => documents().data(id.parse(did)));
  ipcMain.handle(IPC.importDocument, async (_e, sid: unknown) => {
    const studyId = id.parse(sid);
    let file = process.env.KARDIO_E2E_IMPORT_FILE; // end-to-end tests only: no file dialog
    if (!file) {
      const options = {
        properties: ['openFile' as const],
        filters: [{ name: 'PDF oder Bild', extensions: Object.keys(DOCUMENT_TYPES) }],
      };
      const res = mainWindow ? await dialog.showOpenDialog(mainWindow, options) : await dialog.showOpenDialog(options);
      if (res.canceled || !res.filePaths[0]) return null;
      file = res.filePaths[0];
    }
    const ext = path.extname(file).slice(1).toLowerCase();
    const mime = DOCUMENT_TYPES[ext];
    if (!mime) throw new Error('Nur PDF, PNG oder JPG.');
    return documents().add(studyId, path.basename(file), mime, fs.readFileSync(file));
  });
  ipcMain.handle(IPC.confirmAnonymized, (_e, did: unknown) => documents().confirmAnonymized(id.parse(did)));
  ipcMain.handle(IPC.extractDocument, async (_e, sid: unknown, did: unknown) => {
    if (settings.provider === 'none') {
      return { ok: false, message: 'Kein Extraktionsanbieter konfiguriert (Einstellungen). Manuelle Eingabe ist immer möglich.', accepted: [], rejected: [], skipped: [] };
    }
    try {
      // Mode gating: in ECHTBETRIEB a cloud provider is not obtainable at all (gateway §2.3).
      const provider = getProvider(mode, settings.provider);
      return await runExtraction({
        repo: repository(),
        docs: documents(),
        provider,
        mode,
        threshold: settings.confidenceThreshold,
        studyId: id.parse(sid),
        documentId: id.parse(did),
      });
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err), accepted: [], rejected: [], skipped: [] };
    }
  });
  ipcMain.handle(IPC.confirmExtraction, (_e, eid: unknown, value: unknown, corrected: unknown) =>
    documents().confirm(id.parse(eid), z.string().max(100).parse(value), z.boolean().parse(corrected)),
  );
  ipcMain.handle(IPC.getExtractionSettings, () => extractionSettings());
  ipcMain.handle(IPC.setExtractionSettings, (_e, change: unknown) => {
    const c = z.object({ provider: z.string().optional(), confidenceThreshold: z.number().min(0.5).max(1).optional() }).parse(change);
    if (c.provider !== undefined && c.provider !== 'none' && !availableProviders(mode).some((p) => p.id === c.provider && p.implemented && p.id !== 'mock')) {
      throw new Error('Dieser Anbieter ist im aktuellen Betriebsmodus nicht verfügbar.');
    }
    updateSettings(c);
    return extractionSettings();
  });
  ipcMain.handle(IPC.setApiKey, (_e, key: unknown) => {
    saveApiKey(userDir(), z.string().min(10).max(500).parse(key));
    return extractionSettings();
  });
  ipcMain.handle(IPC.deleteApiKey, () => {
    deleteApiKey(userDir());
    return extractionSettings();
  });

  ipcMain.handle(IPC.libraryBlocks, (_e, moduleKey: unknown) => insertableBlocks(z.string().parse(moduleKey), mode));
  ipcMain.handle(IPC.exportStudy, async (_e, sid: unknown, format: unknown) => {
    const study = repository().getStudy(id.parse(sid));
    if (!study) throw new Error('Study not found.');
    const patient = repository().getPatient(study.patientId)!;
    const target = process.env.KARDIO_E2E_EXPORT_DIR; // end-to-end tests only: no save dialog
    const fmt = z.enum(['clipboard', 'docx', 'pdf']).parse(format);
    return exportStudy(
      mainWindow,
      study,
      patient,
      mode,
      fmt,
      target && fmt !== 'clipboard' ? path.join(target, `export.${fmt}`) : undefined,
    );
  });
}

function extractionSettings() {
  return {
    provider: settings.provider,
    confidenceThreshold: settings.confidenceThreshold,
    hasApiKey: hasApiKey(userDir()),
    encryptionAvailable: encryptionAvailable(),
    documentsProcessed: docs ? docs.documentsProcessed() : 0,
  };
}

function lockDownSession(): void {
  const ses = session.defaultSession;
  // Only local resources; everything else is cancelled (one egress path).
  ses.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: !isAllowedRendererUrl(details.url) });
  });
  // Chromium would otherwise download spell-check dictionaries from the internet.
  ses.setSpellCheckerEnabled(false);
  ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: windowTitle(),
    backgroundColor: '#f8fafc',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  mainWindow = win;

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  win.on('page-title-updated', (event) => event.preventDefault());
  if (!app.isPackaged) {
    win.webContents.on('before-input-event', (_e, input) => {
      if (input.type === 'keyDown' && input.key === 'F12') win.webContents.toggleDevTools();
    });
  }

  // Let the renderer flush pending autosaves before closing (2 s at most).
  let closing = false;
  win.on('close', (event) => {
    if (closing) return;
    event.preventDefault();
    closing = true;
    const done = () => {
      clearTimeout(timer);
      ipcMain.removeListener(IPC.closeReady, done);
      win.destroy();
    };
    const timer = setTimeout(done, 2000);
    ipcMain.once(IPC.closeReady, done);
    win.webContents.send(IPC.beforeClose);
  });
  win.on('closed', () => {
    mainWindow = null;
  });

  win.once('ready-to-show', () => win.show());
  void win.loadFile(path.join(__dirname, '..', 'dist', 'renderer', 'index.html'));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow?.isMinimized()) mainWindow.restore();
    mainWindow?.focus();
  });

  app.whenReady().then(() => {
    try {
      settings = loadSettings(userDir());
      // End-to-end tests only: the network-free mock provider with a recorded OCR response.
      if (process.env.KARDIO_E2E_MOCK_OCR) settings.provider = 'mock';
      switchDatabase(settings.mode);
      setGatewayKeySource(() => loadApiKey(userDir()));
      setGatewayFetch(gatewayFetch);
    } catch (err) {
      dialog.showErrorBox(
        'Kardio-Doku – Datenbank kann nicht geöffnet werden',
        `${(err as Error).message}\n\nDie Anwendung wird beendet.`,
      );
      app.quit();
      return;
    }
    lockDownSession();
    registerIpc();
    createWindow();
  });

  app.on('window-all-closed', () => {
    db?.close();
    db = null;
    app.quit();
  });
}
