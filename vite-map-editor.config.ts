import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: '.',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3001,
    open: '/map-editor.html',
  },
  build: {
    outDir: 'dist-map-editor',
    rollupOptions: {
      input: {
        'map-editor': path.resolve(__dirname, 'map-editor.html'),
      },
    },
  },
});
