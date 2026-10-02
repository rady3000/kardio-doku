import type { KardioApi } from '../shared/api';

declare global {
  interface Window {
    kardio: KardioApi;
  }
}

export const api: KardioApi = window.kardio;
