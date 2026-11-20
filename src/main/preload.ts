// Exposes the typed KardioApi to the renderer. No Node access in the renderer.
import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type KardioApi } from '../shared/api';

const api: KardioApi = {
  getAppState: () => ipcRenderer.invoke(IPC.getAppState),
  setMode: (mode, confirmed) => ipcRenderer.invoke(IPC.setMode, mode, confirmed),
  listPatients: (query) => ipcRenderer.invoke(IPC.listPatients, query),
  getPatient: (id) => ipcRenderer.invoke(IPC.getPatient, id),
  createPatient: () => ipcRenderer.invoke(IPC.createPatient),
  updatePatient: (id, input) => ipcRenderer.invoke(IPC.updatePatient, id, input),
  listStudies: (patientId) => ipcRenderer.invoke(IPC.listStudies, patientId),
  getStudy: (id) => ipcRenderer.invoke(IPC.getStudy, id),
  createStudy: (input) => ipcRenderer.invoke(IPC.createStudy, input),
  updateStudy: (id, update) => ipcRenderer.invoke(IPC.updateStudy, id, update),
  libraryBlocks: (moduleKey) => ipcRenderer.invoke(IPC.libraryBlocks, moduleKey),
  listDocuments: (studyId) => ipcRenderer.invoke(IPC.listDocuments, studyId),
  documentData: (documentId) => ipcRenderer.invoke(IPC.documentData, documentId),
  importDocument: (studyId) => ipcRenderer.invoke(IPC.importDocument, studyId),
  confirmAnonymized: (documentId) => ipcRenderer.invoke(IPC.confirmAnonymized, documentId),
  extractDocument: (studyId, documentId) => ipcRenderer.invoke(IPC.extractDocument, studyId, documentId),
  confirmExtraction: (extractionId, value, corrected) => ipcRenderer.invoke(IPC.confirmExtraction, extractionId, value, corrected),
  getExtractionSettings: () => ipcRenderer.invoke(IPC.getExtractionSettings),
  setExtractionSettings: (change) => ipcRenderer.invoke(IPC.setExtractionSettings, change),
  setApiKey: (key) => ipcRenderer.invoke(IPC.setApiKey, key),
  deleteApiKey: () => ipcRenderer.invoke(IPC.deleteApiKey),
  exportStudy: (id, format) => ipcRenderer.invoke(IPC.exportStudy, id, format),
  onBeforeClose: (handler) => {
    ipcRenderer.removeAllListeners(IPC.beforeClose);
    ipcRenderer.on(IPC.beforeClose, () => {
      handler()
        .catch(() => undefined)
        .finally(() => ipcRenderer.send(IPC.closeReady));
    });
  },
};

contextBridge.exposeInMainWorld('kardio', api);
