<template>
  <div class="home-topbar">
    <strong>Olá, {{ currentUser.email }}</strong>
  </div>

  <div class="home-page"></div>
</template>

<script setup>
import { onMounted } from 'vue'
import { ensureUserEmail, getCurrentUser } from '../shared/currentUser'

const currentUser = getCurrentUser()

onMounted(() => {
  ensureUserEmail()
})
</script>

<style scoped>
.home-topbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 0 20px;
  background: var(--card);
  border-bottom: 1px solid var(--border);
  color: var(--text);
  z-index: 100;
}

.home-page {
  padding-top: 56px;
}
</style>
