import vue from '@vitejs/plugin-vue'
// vitest/config re-exports vite's defineConfig with its type extended to
// accept a top-level "test" key, so one file covers both vite and vitest.
import { defineConfig } from 'vitest/config'

// backend/app/main.py serves the same origin in production; the proxy below
// reproduces that for the dev server so App.vue's relative fetch("/data"),
// etc. keep working unchanged. "readmore" is the backend service's name on
// the shared docker-compose network. /images isn't listed: it's served from
// frontend/public/images/, which Vite serves directly in dev (and copies
// into dist/images/ on build), so it never needs to reach the backend.
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
      '/reinforcement-words': BACKEND,
      '/game-area': BACKEND,
      '/tts': BACKEND,
      '/increment': BACKEND,
      '/mark-known': BACKEND,
      '/show-word': BACKEND,
      '/corrections': BACKEND,
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
})
