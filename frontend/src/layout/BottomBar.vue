<template>
  <nav class="bottom-bar">
    <RouterLink to="/" class="bottom-bar-item" active-class="active" exact-active-class="active">
      <span class="bottom-bar-icon">⌂</span>
    </RouterLink>
  </nav>
</template>

<script setup>
import { RouterLink } from 'vue-router'
</script>

<style scoped>
.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 56px;
  display: flex;
  align-items: center;
  background: var(--card);
  border-top: 1px solid var(--border);
  z-index: 100;
}
.bottom-bar-item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 100%;
  color: var(--muted);
  text-decoration: none;
}
.bottom-bar-item.active {
  color: var(--accent);
}
.bottom-bar-icon {
  font-size: 22px;
}
</style>
