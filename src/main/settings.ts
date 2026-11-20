// Non-secret application settings in settings.json (userData). API keys never
// go here (CLAUDE.md: Electron safeStorage only, see secrets.ts).
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_MODE, isMode, type Betriebsmodus } from '../shared/mode';

export interface Settings {
  mode: Betriebsmodus;
  /** Extraction provider id; "none" = manual entry only (gateway §6 default). */
  provider: string;
  /** Confidence threshold for automatic rejection (gateway §4.3, default 0.85). */
  confidenceThreshold: number;
}

export const DEFAULT_SETTINGS: Settings = { mode: DEFAULT_MODE, provider: 'none', confidenceThreshold: 0.85 };

export function loadSettings(dir: string): Settings {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, 'settings.json'), 'utf-8')) as Record<string, unknown>;
    const threshold = raw.confidenceThreshold;
    return {
      // Anything unreadable falls back to TESTBETRIEB, never to ECHTBETRIEB.
      mode: isMode(raw.mode) ? raw.mode : DEFAULT_MODE,
      provider: typeof raw.provider === 'string' ? raw.provider : 'none',
      confidenceThreshold: typeof threshold === 'number' && threshold >= 0.5 && threshold <= 1 ? threshold : 0.85,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(dir: string, settings: Settings): void {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'settings.json');
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(settings, null, 2));
  fs.renameSync(`${file}.tmp`, file);
}
