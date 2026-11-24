import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Tests, test helpers and the start-up/seed entry points are not product logic to measure.
      exclude: ['src/**/*.test.ts', 'src/test/**', 'src/index.ts', 'src/scripts/**'],
      reporter: ['text-summary', 'text'],
    },
  },
});
