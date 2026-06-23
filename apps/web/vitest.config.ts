import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
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
