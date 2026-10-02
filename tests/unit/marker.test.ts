// Gateway test §7.3 (prepared in M1 for the clipboard path; DOCX/PDF follow in M2).
import { describe, expect, it } from 'vitest';
import { markClipboardText } from '../../src/shared/marker';
import { TESTDATEN_MARKER } from '../../src/shared/mode';

describe('TESTDATEN marker', () => {
  it('has the exact wording', () => {
    expect(TESTDATEN_MARKER).toBe('TESTDATEN – NICHT FÜR DIE PATIENTENDOKUMENTATION');
  });

  it('is the first line of clipboard output in TESTBETRIEB', () => {
    expect(markClipboardText('Befund', 'TESTBETRIEB').split('\n')[0]).toBe(TESTDATEN_MARKER);
    expect(markClipboardText('', 'TESTBETRIEB').split('\n')[0]).toBe(TESTDATEN_MARKER);
  });

  it('is absent in ECHTBETRIEB', () => {
    expect(markClipboardText('Befund', 'ECHTBETRIEB')).toBe('Befund');
  });
});
