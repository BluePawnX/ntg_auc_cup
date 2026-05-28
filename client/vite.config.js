import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `--host` (and host:true) makes the dev server reachable from other devices
// on the venue Wi-Fi (phones connecting to the host laptop's LAN IP).
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
});
