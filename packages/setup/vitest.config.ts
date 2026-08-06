import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    name: 'setup',
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
});
