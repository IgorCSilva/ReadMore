<template>

  <Notifications />

  <CorrectSentenceFab />

  <BottomBar v-if="!route.meta.hideGlobalBottomBar" />

  <RouterView />

</template>

<script setup>
import { RouterView, useRoute } from 'vue-router'
import CorrectSentenceFab from './features/corrections/CorrectSentenceFab.vue'
import BottomBar from './layout/BottomBar.vue'
import Notifications from './shared/Notifications.vue'
import { applyStoredAccent } from './shared/languagePreference'

const route = useRoute()

// Reflects a previously saved language-pair preference (SettingsPage.vue)
// right from the first render — not just after a live in-session change —
// so a full page load/refresh never flashes the default accent first.
applyStoredAccent()
</script>

<style>
/* Vite mounts this component's template into <div id="app">, which
   didn't exist in plain viewer.html — the sections below used to be
   direct children of <body>, which is what "body { display: flex; ... }"
   right below targets. display:contents makes #app transparent for
   layout purposes so that flex layout still applies unchanged. */
#app {
  display: contents;
}

  :root {
    --bg: #111318;
    --card: #1a1d24;
    --text: #eef0f3;
    --muted: #8b91a0;
    --confident: #35c07a;
    --learning: #e0a530;
    --border: #2a2e38;

    /* raw per-target-language accent trio — theme-owned; which one is
       active is a separate, independent concern (see the data-lang block
       below), so this and a future manual dark/light toggle never redefine
       the same property. */
    --accent-en: #4f8cff;    --accent-en-soft: #1b2a47;  --accent-en-strong: #3f74e0;
    --accent-es: #ff8b5e;    --accent-es-soft: #3a2418;  --accent-es-strong: #ff7038;
    --accent-ko: #a374ff;    --accent-ko-soft: #2c2140;  --accent-ko-strong: #8a54f0;
  }
  @media (prefers-color-scheme: light) {
    :root {
      --bg: #f5f6f8;
      --card: #ffffff;
      --text: #1a1d24;
      --muted: #666d7a;
      --confident: #1f9a5a;
      --learning: #b8790a;
      --border: #e1e3e8;

      --accent-en: #2f6fe4;    --accent-en-soft: #e7efff;  --accent-en-strong: #1f56c4;
      --accent-es: #dd5a28;    --accent-es-soft: #fce8dd;  --accent-es-strong: #b8461c;
      --accent-ko: #7c3fe0;    --accent-ko-soft: #f1e7ff;  --accent-ko-strong: #5f2bb8;
    }
  }

  /* which target language's accent trio is active right now — kept to just
     these three tokens so the toggle stays independent of the theme blocks
     above. Set via data-lang on <html>, updated in JS whenever LANG changes
     (see setDataLang in LibraryPage.vue's script). Defaults to English so
     the app still renders correctly before that resolves the real language. */
  :root, :root[data-lang="en"] {
    --accent: var(--accent-en);
    --accent-soft: var(--accent-en-soft);
    --accent-strong: var(--accent-en-strong);
  }
  :root[data-lang="es"] {
    --accent: var(--accent-es);
    --accent-soft: var(--accent-es-soft);
    --accent-strong: var(--accent-es-strong);
  }
  :root[data-lang="ko"] {
    --accent: var(--accent-ko);
    --accent-soft: var(--accent-ko-soft);
    --accent-strong: var(--accent-ko-strong);
  }
  * { box-sizing: border-box; }
  html {
    height: 100%;
  }
  html, body {
    margin: 0; padding: 0;
    background: var(--bg); color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  /* min-height, not height: a fixed height on a box taller than its content
     leaves that content overflowing past the box's own edge — including its
     padding-bottom, which is what reserves clearance above the fixed bottom
     bar. That silently clipped the last topic cards on Home once the list
     (or an expanded accordion) grew past one viewport tall. min-height still
     guarantees at least a full viewport, but grows with taller content
     instead of leaking it. */
  body {
    display: flex; flex-direction: column; align-items: center;
    gap: 24px;
    min-height: 100vh; padding: 24px; padding-bottom: 80px;
  }
</style>
