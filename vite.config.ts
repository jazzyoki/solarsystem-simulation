import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: ['solar.yokicloud.net'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
