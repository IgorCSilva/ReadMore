<template>
  <div class="notifications-page">
    <h1 class="notifications-title">Notifications</h1>

    <p class="notifications-empty" v-if="notifications.length === 0">No notifications yet.</p>

    <ul class="notifications-list" v-else>
      <li
        v-for="n in notifications"
        :key="n.id"
        class="notification-item"
        :class="`notification-${n.type}`"
      >
        <span class="notification-message">{{ n.message }}</span>
        <span class="notification-time">{{ formatTime(n.timestamp) }}</span>
        <button type="button" class="notification-dismiss" aria-label="Dismiss" @click="dismiss(n.id)">×</button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { dismiss, getNotifications, markAllRead } from '../shared/notifications'

const notifications = getNotifications()

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// Opening this page is what tells the bottom-bar bell it's been "seen" —
// clearing the unread flag here, not on dismiss, so simply glancing at the
// list is enough even if nothing is removed from it.
onMounted(() => {
  markAllRead()
})
</script>

<style scoped>
.notifications-page {
  width: 100%;
  max-width: 640px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 20px;
}

.notifications-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--text);
}

.notifications-empty {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
}

.notifications-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.notification-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  border-radius: 10px;
  border-left: 4px solid var(--accent);
  background: var(--card);
  padding: 12px 14px;
  font-size: 13px;
  line-height: 1.4;
}

.notification-message {
  flex: 1;
  color: var(--text);
}

.notification-time {
  color: var(--muted);
  font-size: 12px;
  white-space: nowrap;
}

.notification-dismiss {
  background: none;
  border: none;
  color: var(--muted);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  opacity: 0.8;
  padding: 0;
}

.notification-dismiss:hover {
  opacity: 1;
}

.notification-info { border-left-color: var(--accent); }
.notification-success { border-left-color: var(--confident); }
.notification-warning { border-left-color: var(--learning); }
.notification-error { border-left-color: #e0453a; }
</style>
