import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadSettings, saveSettings } from '../../src/main/settings';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'kardio-settings-'));

describe('settings', () => {
  it('defaults to TESTBETRIEB on first run', () => {
    expect(loadSettings(tmp()).mode).toBe('TESTBETRIEB');
  });

  it('round-trips the mode', () => {
    const dir = tmp();
    saveSettings(dir, { mode: 'ECHTBETRIEB' });
    expect(loadSettings(dir).mode).toBe('ECHTBETRIEB');
  });

  it('falls back to TESTBETRIEB for a corrupt or unknown value, never to ECHTBETRIEB', () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'settings.json'), '{not json');
    expect(loadSettings(dir).mode).toBe('TESTBETRIEB');
    fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ mode: 'echtbetrieb' }));
    expect(loadSettings(dir).mode).toBe('TESTBETRIEB');
  });
});
