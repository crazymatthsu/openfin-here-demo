import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import { tradingPanelsPreload } from '@openfin-here-demo/trading-panels/vite';

const page = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

/**
 * Demo 02 is served on port 5174 so it can run next to demo 01 (5173).
 * public/manifest.fin.json refers to http://localhost:5174 by absolute URL.
 */
export default defineConfig({
  plugins: [tradingPanelsPreload()],
  server: { port: 5174, strictPort: true },
  preview: { port: 5174, strictPort: true },
  build: {
    rollupOptions: {
      input: {
        index: page('./index.html'),
        provider: page('./platform/provider.html'),
        blotter: page('./blotter/index.html'),
        monitor: page('./monitor/index.html'),
        bridge: page('./bridge/index.html'),
        desk: page('./desk/index.html'),
      },
    },
  },
});
