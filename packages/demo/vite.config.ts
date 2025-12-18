import { createRequire } from 'node:module';

import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type PluginOption } from 'vite';

const require = createRequire(import.meta.url);

let reactPlugin: PluginOption | undefined;
try {
  // Optional: prefer SWC when the native binding is available.
  const mod = require('@vitejs/plugin-react-swc');
  reactPlugin = mod.default();
} catch {
  reactPlugin = undefined;
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [reactPlugin, tailwindcss()].filter(Boolean) as PluginOption[],
  esbuild: {
    jsx: 'automatic',
  },
  build: {
    minify: 'esbuild',
    sourcemap: false,
  },
  server: {
    port: 3000,
  },
});
