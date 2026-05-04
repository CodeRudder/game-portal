import { defineConfig } from 'vitest/config';
import path from 'path';
import os from 'os';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    pool: 'forks',
    poolOptions: {
      forks: {
        maxWorkers: Math.min(4, Math.max(1, os.cpus().length - 1)),
      },
    },
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/__tests__/**/*.test.{ts,tsx}', 'src/smoke/**/*.test.{ts,tsx}', 'src/engine/**/__tests__/**/*.test.{ts,tsx}', 'src/engines/**/__tests__/**/*.test.{ts,tsx}', 'src/games/**/__tests__/**/*.test.{ts,tsx}', 'src/games/**/tests/**/*.test.{ts,tsx}', 'src/games/**/generated-tests/**/*.test.{ts,tsx}', 'src/renderer/**/__tests__/**/*.test.{ts,tsx}', 'src/components/**/__tests__/**/*.test.{ts,tsx}'],
    exclude: ['src/games/three-kingdoms/bak/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/__tests__/**', 'src/vite-env.d.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
