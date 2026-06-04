import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globals: true,
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Integration tests hit staging Supabase; local Windows CA store does not trust
    // Supabase's cert chain without --use-system-ca (Node 24 flag). Disable for tests only.
    env: { NODE_TLS_REJECT_UNAUTHORIZED: '0' },
  },
});
