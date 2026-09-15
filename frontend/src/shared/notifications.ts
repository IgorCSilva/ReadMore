import { reactive } from 'vue'

export type NotificationType = 'info' | 'success' | 'warning' | 'error'

export interface AppNotification {
  id: number
  type: NotificationType
  message: string
}

// A plain module-level reactive array — the app has no store (Pinia/Vuex),
// and a single shared toast list doesn't need one either; every caller
// imports the same module instance.
const notifications = reactive<AppNotification[]>([])

let nextId = 1

// Errors stay until dismissed since they're often the only signal something
// needs attention; info/success/warning are routine status updates and
// clear themselves so the corner doesn't pile up during normal use.
const AUTO_DISMISS_MS: Record<NotificationType, number | null> = {
  info: 4000,
  success: 4000,
  warning: 8000,
  error: null,
}

export function notify(type: NotificationType, message: string): number {
  const id = nextId++
  notifications.push({ id, type, message })
  const ttl = AUTO_DISMISS_MS[type]
  if (ttl !== null) {
    setTimeout(() => dismiss(id), ttl)
  }
  return id
}

export function dismiss(id: number): void {
  const index = notifications.findIndex((n) => n.id === id)
  if (index !== -1) notifications.splice(index, 1)
}

export function getNotifications(): AppNotification[] {
  return notifications
}
