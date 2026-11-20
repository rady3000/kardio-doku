// The gateway's network access inside the app: Electron's net.fetch uses the
// Chromium network stack with the system proxy configuration. Lives in
// src/gateway, the only place allowed to make network calls.
import { net } from 'electron';

export const gatewayFetch: typeof fetch = (input, init) => net.fetch(input as string, init as RequestInit);
