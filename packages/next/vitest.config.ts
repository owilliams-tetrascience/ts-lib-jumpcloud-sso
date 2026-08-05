import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    name: 'next',
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
});
