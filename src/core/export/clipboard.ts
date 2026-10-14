// Clipboard text: the path into the hospital system (gateway §2.4). In
// TESTBETRIEB the TESTDATEN marker is always the first line.
import { markClipboardText } from '../../shared/marker';
import type { Betriebsmodus } from '../../shared/mode';

/** Windows applications expect CRLF line ends. */
export function clipboardText(text: string, mode: Betriebsmodus, platform: string): string {
  const marked = markClipboardText(text, mode);
  return platform === 'win32' ? marked.replace(/\r?\n/g, '\r\n') : marked;
}
