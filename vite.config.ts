import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { parseEnv } from './src/shared/config/env';

export default defineConfig(({ mode }) => {
  parseEnv(loadEnv(mode, process.cwd(), 'VITE_'));
  return {
    plugins: [react()],
    server: {
      ...(process.env.WATCH_USE_POLLING === 'true'
        ? { watch: { usePolling: true, interval: 300 } }
        : {}),
    },
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  };
});
