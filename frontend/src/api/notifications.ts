import { api } from './client'
import type { Notification } from '../types'

export const notificationsApi = {
  list: () => api.get<Notification[]>('/notifications'),
  markAllRead: () => api.post<void>('/notifications/read-all'),
}
