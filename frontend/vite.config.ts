import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// En desarrollo, /api se redirige al backend local (uvicorn en :8787).
// En producción, nginx hace el mismo proxy hacia el servicio Cloud Run del backend.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': { target: process.env.VITE_API_PROXY ?? 'http://localhost:8787', changeOrigin: true } },
  },
  build: { chunkSizeWarningLimit: 900 },
})
