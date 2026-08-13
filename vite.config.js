import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // In local development, proxy /api calls to the Express server.
    // On Vercel, /api/* is handled natively by serverless functions.
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.warn(
              '[Vite Proxy] Could not connect to Express server at localhost:3001.\n' +
              'Run: cd server && node server.js'
            );
          });
        },
      },
    },
  },
})
