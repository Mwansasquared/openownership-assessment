import { api } from './client'
import type { Action, Submission, SubmissionEvent } from '../types'

export const submissionsApi = {
  list: () => api.get<Submission[]>('/submissions'),

  get: (id: string) => api.get<Submission>(`/submissions/${id}`),

  create: (title: string, content: string) =>
    api.post<Submission>('/submissions', { title, content }),

  update: (id: string, title: string, content: string) =>
    api.put<Submission>(`/submissions/${id}`, { title, content }),

  delete: (id: string) => api.del(`/submissions/${id}`),

  performAction: (id: string, action: Action, comment?: string) =>
    api.post<Submission>(`/submissions/${id}/actions/${action}`, { comment }),

  listEvents: (id: string) =>
    api.get<SubmissionEvent[]>(`/submissions/${id}/events`),
}
