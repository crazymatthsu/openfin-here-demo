import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

const page = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

/**
 * Multi-page Vite app. Every HTML file below is one OpenFin View (or the
 * platform provider). The dev server is pinned to port 5173 because
 * public/manifest.fin.json refers to http://localhost:5173 by absolute URL.
 */
export default defineConfig({
  server: { port: 5173, strictPort: true },
  preview: { port: 5173, strictPort: true },
  build: {
    rollupOptions: {
      input: {
        index: page('./index.html'),
        provider: page('./platform/provider.html'),
        blotter: page('./blotter/index.html'),
        monitor: page('./monitor/index.html'),
        bridge: page('./bridge/index.html'),
      },
    },
  },
});
