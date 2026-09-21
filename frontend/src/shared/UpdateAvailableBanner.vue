<template>
  <div v-if="pending" class="update-banner">
    <span class="update-banner-message">New word data is available.</span>
    <button type="button" class="update-banner-btn" @click="apply">Update</button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { applyPendingUpdate, hasPendingUpdate } from './userWords'

// Small, genuinely-reactive component — same relationship to
// shared/userWords.ts that Notifications.vue has to shared/notifications.ts.
// App.vue (mostly imperative, not template-reactive) tells it what
// (user, lang, sentenceLang, cueLang) key to watch via watch(), from every
// place that establishes or changes that tuple. `pending` tracks it via a
// computed — userWords.ts's store is itself reactive(), so Vue's
// reactivity correctly follows the dependency through the hasPendingUpdate()
// function call.

interface Context {
  user: string
  lang: string
  sentenceLang: string
  cueLang: string
}

const context = ref<Context | null>(null)
let onApplied: (() => void) | null = null

const pending = computed(() => {
  const ctx = context.value
  if (!ctx) return false
  return hasPendingUpdate(ctx.user, ctx.lang, ctx.sentenceLang, ctx.cueLang)
})

function watch(user: string, lang: string, sentenceLang: string, cueLang: string, onAppliedCallback: () => void) {
  context.value = { user, lang, sentenceLang, cueLang }
  onApplied = onAppliedCallback
}

function apply() {
  const ctx = context.value
  if (!ctx) return
  applyPendingUpdate(ctx.user, ctx.lang, ctx.sentenceLang, ctx.cueLang)
  onApplied?.()
}

defineExpose({ watch })
</script>

<style scoped>
.update-banner {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 10px 16px;
  border-radius: 10px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-size: 14px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
  width: min(90vw, 420px);
}
.update-banner-btn {
  padding: 6px 16px;
  border-radius: 999px;
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.update-banner-btn:hover {
  background: var(--accent-strong);
}
</style>
