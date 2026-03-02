import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import compression from 'vite-plugin-compression'

export default defineConfig({
  plugins: [
    react(),
    compression({ algorithm: 'gzip', threshold: 1024 }),
  ],
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          charts: ['chart.js', 'react-chartjs-2'],
          parsers: ['papaparse', 'xlsx'],
        },
      },
    },
  },
})
