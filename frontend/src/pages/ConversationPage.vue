<template>
  <div class="flow-topbar">
    <button type="button" class="flow-exit-btn" @click="exit" aria-label="Exit">✕</button>
  </div>

  <div class="conversation-page">
    <Conversation />
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import Conversation from '../features/conversation/Conversation.vue'

const router = useRouter()

function exit(): void {
  router.push('/home')
}
</script>

<style scoped>
.flow-topbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
  padding: 0 16px;
  background: var(--card);
  border-bottom: 1px solid var(--border);
  z-index: 100;
}

.flow-exit-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: none;
  color: var(--muted);
  font-size: 16px;
  cursor: pointer;
}

.flow-exit-btn:hover {
  background: var(--border);
  color: var(--text);
}

.conversation-page {
  padding-top: 56px;
  height: 100vh;
  overflow: hidden;
}
</style>
