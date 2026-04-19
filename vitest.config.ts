import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/__tests__/**/*.test.{ts,tsx}', 'src/engine/**/__tests__/**/*.test.{ts,tsx}', 'src/engines/**/__tests__/**/*.test.{ts,tsx}', 'src/games/**/__tests__/**/*.test.{ts,tsx}', 'src/renderer/**/__tests__/**/*.test.{ts,tsx}'],
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
