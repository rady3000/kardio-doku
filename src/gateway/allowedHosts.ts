// The only addresses the gateway may reach (CLAUDE.md: one network egress path).
// Anything else is cancelled by the gateway's own Electron session.
import { MISTRAL_ENDPOINT } from './providers/mistralOcr';

const ALLOWED = [MISTRAL_ENDPOINT].map((u) => new URL(u));

export function isAllowedGatewayUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && ALLOWED.some((a) => a.host === u.host && u.pathname.startsWith(a.pathname));
  } catch {
    return false;
  }
}
