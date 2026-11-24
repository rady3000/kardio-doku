// The gateway's network access inside the app. Lives in src/gateway, the only
// place allowed to make network calls.
//
// It uses its own in-memory Electron session, not the default one: the default
// session belongs to the window and cancels every non-local request (renderer
// lock in src/main/egress.ts). Before 0.4.2 the gateway used the default session
// and every OCR call failed with net::ERR_BLOCKED_BY_CLIENT. The gateway session
// has its own lock: only the provider endpoint is allowed. It uses the Chromium
// network stack with the system proxy configuration (hospital networks).
import { session, type Session } from 'electron';
import { isAllowedGatewayUrl } from './allowedHosts';

let gatewaySession: Session | null = null;

function getSession(): Session {
  if (!gatewaySession) {
    const ses = session.fromPartition('kardio-gateway'); // no "persist:" prefix → nothing written to disk
    ses.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !isAllowedGatewayUrl(details.url) }));
    ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    gatewaySession = ses;
  }
  return gatewaySession;
}

export const gatewayFetch: typeof fetch = (input, init) => getSession().fetch(input as string, init as RequestInit);
