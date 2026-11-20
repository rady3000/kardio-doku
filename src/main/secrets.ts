// API key storage with Electron safeStorage (CLAUDE.md "Secrets"; on Windows
// DPAPI, bound to the Windows user). Only the encrypted blob is written to
// disk; the key is never returned to the renderer and never logged.
import { safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

const fileFor = (dir: string) => path.join(dir, 'mistral-key.bin');

export function encryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}

export function saveApiKey(dir: string, key: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Verschlüsselte Ablage ist auf diesem System nicht verfügbar; der Schlüssel wird nicht gespeichert.');
  }
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fileFor(dir), safeStorage.encryptString(key.trim()));
}

export function loadApiKey(dir: string): string | null {
  try {
    if (!safeStorage.isEncryptionAvailable()) return null;
    return safeStorage.decryptString(fs.readFileSync(fileFor(dir)));
  } catch {
    return null;
  }
}

export function hasApiKey(dir: string): boolean {
  return fs.existsSync(fileFor(dir));
}

export function deleteApiKey(dir: string): void {
  fs.rmSync(fileFor(dir), { force: true });
}
