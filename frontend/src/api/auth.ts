import { api } from './client'
import type { Role, User } from '../types'

export const authApi = {
  register: (email: string, password: string, role: Role) =>
    api.post<User>('/auth/register', { email, password, role }),

  login: (email: string, password: string) =>
    api.post<User>('/auth/login', { email, password }),

  logout: () => api.post<void>('/auth/logout'),

  me: () => api.get<User>('/auth/me'),
}
