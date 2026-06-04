import { defineConfig } from 'vitest/config';

// On Linux (CI / Node 20 + pnpm virtual store), Vite's SSR module transformer
// cannot follow pnpm's symlink-based resolution for `openai`.
// Externalising it tells vite-node to use Node.js native resolution instead.
export default defineConfig({
  test: {
    environment: 'node',
    server: {
      deps: {
        external: ['openai'],
      },
    },
    // Forward env vars that control skipIf gates in the test files.
    // Vitest's forks pool on Linux does not always inherit job-level env vars;
    // reading them here (in the config process) and forwarding guarantees they
    // reach the test workers regardless of platform.
    env: {
      OPENAI_API_KEY: process.env['OPENAI_API_KEY'] ?? '',
      STRIPE_SECRET_KEY: process.env['STRIPE_SECRET_KEY'] ?? '',
      STRIPE_WEBHOOK_SECRET: process.env['STRIPE_WEBHOOK_SECRET'] ?? '',
    },
  },
});
