import { defineConfig } from 'vitest/config';

// Extraction evaluation harness (gateway §5.4). Calls the live OCR provider:
//   npm run harness            (needs network access to api.eu.mistral.ai and a key)
export default defineConfig({
  test: { include: ['tests/harness/**/*.test.ts'], environment: 'node', testTimeout: 600_000 },
});
