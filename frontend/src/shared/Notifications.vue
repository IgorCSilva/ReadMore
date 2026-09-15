<template>
  <div class="toast-container" aria-live="polite">
    <div
      v-for="n in notifications"
      :key="n.id"
      class="toast"
      :class="`toast-${n.type}`"
    >
      <span class="toast-message">{{ n.message }}</span>
      <button type="button" class="toast-dismiss" aria-label="Dismiss" @click="dismiss(n.id)">×</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { dismiss, getNotifications } from './notifications'

const notifications = getNotifications()
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: min(90vw, 360px);
}
.toast {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  border-radius: 10px;
  padding: 12px 14px;
  font-size: 13px;
  line-height: 1.4;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
  color: #fff;
}
.toast-message {
  flex: 1;
}
.toast-dismiss {
  background: none;
  border: none;
  color: inherit;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  opacity: 0.8;
  padding: 0;
}
.toast-dismiss:hover {
  opacity: 1;
}
/* Reuses App.vue's :root palette (custom properties cascade through scoped
   styles regardless of scoping — only selector matching is scoped) so
   toast colors stay consistent with the rest of the app's semantic colors:
   --accent for info, --confident for success, --learning for warning. */
.toast-info { background: var(--accent); }
.toast-success { background: var(--confident); }
.toast-warning { background: var(--learning); }
.toast-error { background: #e0453a; } /* matches .error-banner's existing red */
</style>
