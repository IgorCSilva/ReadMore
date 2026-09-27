import { computed, reactive } from 'vue'

export type NotificationType = 'info' | 'success' | 'warning' | 'error'

export interface AppNotification {
  id: number
  type: NotificationType
  message: string
  timestamp: number
  read: boolean
}

// A plain module-level reactive array — the app has no store (Pinia/Vuex),
// and a single shared notification list doesn't need one either; every
// caller imports the same module instance.
const notifications = reactive<AppNotification[]>([])

let nextId = 1

// Newest first, since NotificationsPage.vue renders the array as-is.
export function notify(type: NotificationType, message: string): number {
  const id = nextId++
  notifications.unshift({ id, type, message, timestamp: Date.now(), read: false })
  return id
}

export function dismiss(id: number): void {
  const index = notifications.findIndex((n) => n.id === id)
  if (index !== -1) notifications.splice(index, 1)
}

export function getNotifications(): AppNotification[] {
  return notifications
}

export const hasUnread = computed(() => notifications.some((n) => !n.read))

export function markAllRead(): void {
  notifications.forEach((n) => { n.read = true })
}
