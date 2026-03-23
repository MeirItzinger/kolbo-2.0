import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { fileURLToPath } from 'url';

/** Config file lives in apps/web — force root + .env there (fixes monorepo cwd issues). */
const appWebRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: appWebRoot,
  envDir: appWebRoot,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(appWebRoot, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
