import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    // Game engine tests run thousands of simulated games; the 5 s default flakes when the whole suite runs in parallel.
    testTimeout: 30_000,
    // Vitest owns *.test.ts (fast node-context unit + integrity checks).
    // Playwright owns e2e/*.spec.ts (browser smoke) — excluded so the two
    // runners never fight over the same files.
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: [
      'e2e/**',
      'node_modules/**',
      'dist/**',
      // apps-private is a clone of the private repo; never descend into it.
      'src/components/apps-private/**',
    ],
  },
});
