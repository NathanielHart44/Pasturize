import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // Keep support for data outside src
      { find: '@/data', replacement: path.resolve(__dirname, 'data') },
      { find: '@/', replacement: path.resolve(__dirname, 'src') + '/' },
    ],
  },
  server: {
    port: 5173,
  },
});

