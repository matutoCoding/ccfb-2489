import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  worker: { format: 'es' },
  build: { target: 'es2020', chunkSizeWarningLimit: 2000 },
  server: { port: 5173, host: '127.0.0.1' }
});
