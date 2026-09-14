import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// backend/app/main.py serves the same origin in production; the proxy below
// reproduces that for the dev server so App.vue's relative fetch("/data"),
// img.src="images/...", etc. keep working unchanged. "readmore" is the
// backend service's name on the shared docker-compose network.
const BACKEND = 'http://readmore:8000'

export default defineConfig({
  plugins: [vue()],
  server: {
    host: true, // bind 0.0.0.0 so the container's published port is reachable
    port: 5173,
    proxy: {
      '/languages': BACKEND,
      '/words': BACKEND,
      '/data': BACKEND,
      '/chapters': BACKEND,
      '/tts': BACKEND,
      '/increment': BACKEND,
      '/mark-known': BACKEND,
      '/show-word': BACKEND,
      '/images': BACKEND,
    },
  },
})
