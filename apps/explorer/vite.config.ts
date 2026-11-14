// The client is built once into dist/client as one script and one stylesheet with fixed names,
// so the server can serve them as they are and an export can carry them inside one file.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    cssCodeSplit: false,
    // One script by design, so an export carries it whole; the lifecycle layout engine is most of it.
    chunkSizeWarningLimit: 2600,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    rollupOptions: {
      output: {
        entryFileNames: 'explorer.js',
        assetFileNames: 'explorer[extname]',
        codeSplitting: false,
      },
    },
  },
  server: {
    // In development the client asks a running `forma-explorer serve --port 4317` for its data.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4317',
        changeOrigin: true,
        configure: (proxy) => proxy.on('proxyReq', (request) => request.removeHeader('origin')),
      },
    },
  },
});
