import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    include: [
      'src/engines/**/*.test.ts',
      'src/components/games/**/*.test.tsx',
      'src/__tests__/**/*.test.ts',
      'src/core/**/*.test.ts',
      'src/renderer/**/*.test.ts',
      'src/services/**/*.test.ts',
    ],
    exclude: [
      'src/games/three-kingdoms/**',
      'src/engines/idle/**',
      'src/components/idle/**',
    ],
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});
