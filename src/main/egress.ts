// Network egress lock for the renderer (CLAUDE.md: one network egress path).
// The UI loads only local files; every other request is cancelled. Network
// access is reserved for the extraction gateway (src/gateway), which runs in
// the main process. tests/unit/egress.test.ts checks the source code for
// network calls outside the gateway.

const ALLOWED_PROTOCOLS = new Set(['file:', 'devtools:', 'data:', 'blob:']);

export function isAllowedRendererUrl(url: string): boolean {
  try {
    return ALLOWED_PROTOCOLS.has(new URL(url).protocol);
  } catch {
    return false;
  }
}
