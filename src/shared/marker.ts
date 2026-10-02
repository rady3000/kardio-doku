// Test marking for exports (gateway §2.4). The clipboard is the path into the
// hospital system, so in TESTBETRIEB the marker is always its first line.
// There is deliberately no option to switch this off.
import { TESTDATEN_MARKER, type Betriebsmodus } from './mode';

export function markClipboardText(text: string, mode: Betriebsmodus): string {
  if (mode !== 'TESTBETRIEB') return text;
  return `${TESTDATEN_MARKER}\n${text}`;
}
