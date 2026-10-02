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
import { providerInfo } from '../gateway/registry';
import { databasePath, openDatabase, type Db } from './database';
import { isAllowedRendererUrl } from './egress';
import { Repository } from './repository';
import { loadSettings, saveSettings } from './settings';

// End-to-end tests run against a throw-away profile directory.
if (process.env.KARDIO_E2E_USER_DATA) app.setPath('userData', process.env.KARDIO_E2E_USER_DATA);

const userDir = () => app.getPath('userData');
const dataDir = () => path.join(userDir(), 'data');

let mode: Betriebsmodus = 'TESTBETRIEB';
let db: Db | null = null;
let repo: Repository | null = null;
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
  mode = next;
  mainWindow?.setTitle(windowTitle());
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
    saveSettings(userDir(), { mode: next });
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
      switchDatabase(loadSettings(userDir()).mode);
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
