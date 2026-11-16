import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'client',
  base: '/dekanat/',
  plugins: [react()],
  build: { outDir: '../dist/client', emptyOutDir: true, chunkSizeWarningLimit: 900, assetsInlineLimit: 0 },
  server: { port: 5320, proxy: { '/dekanat/api': 'http://127.0.0.1:4520' } },
});
