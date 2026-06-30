import { api } from './client'
import type { Action, Status, Submission, SubmissionEvent } from '../types'

export const submissionsApi = {
  list: (state?: Status) =>
    api.get<Submission[]>(state ? `/submissions?state=${state}` : '/submissions'),

  get: (id: string) => api.get<Submission>(`/submissions/${id}`),

  create: (title: string, content: string, category: string, registrationDate: string) =>
    api.post<Submission>('/submissions', { title, content, category, registration_date: registrationDate }),

  update: (id: string, title: string, content: string, category: string, registrationDate: string) =>
    api.put<Submission>(`/submissions/${id}`, { title, content, category, registration_date: registrationDate }),

  delete: (id: string) => api.del(`/submissions/${id}`),

  performAction: (id: string, action: Action, comment?: string) =>
    api.post<Submission>(`/submissions/${id}/actions/${action}`, { comment }),

  listEvents: (id: string) =>
    api.get<SubmissionEvent[]>(`/submissions/${id}/events`),
}
