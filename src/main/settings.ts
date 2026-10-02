// Non-secret application settings in settings.json (userData). Only the
// Betriebsmodus is stored for now. API keys never go here (CLAUDE.md: Electron
// safeStorage only; arrives with the provider configuration in M4).
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_MODE, isMode, type Betriebsmodus } from '../shared/mode';

export interface Settings {
  mode: Betriebsmodus;
}

export function loadSettings(dir: string): Settings {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, 'settings.json'), 'utf-8')) as unknown;
    const mode = (raw as { mode?: unknown }).mode;
    // Anything unreadable falls back to TESTBETRIEB, never to ECHTBETRIEB.
    return { mode: isMode(mode) ? mode : DEFAULT_MODE };
  } catch {
    return { mode: DEFAULT_MODE };
  }
}

export function saveSettings(dir: string, settings: Settings): void {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'settings.json');
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(settings, null, 2));
  fs.renameSync(`${file}.tmp`, file);
}
