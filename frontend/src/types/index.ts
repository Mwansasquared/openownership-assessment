export type Role = 'submitter' | 'reviewer' | 'admin'

export type Status =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'

export type Action =
  | 'submit'
  | 'start_review'
  | 'approve'
  | 'reject'
  | 'return_for_changes'
  | 'resubmit'
  | 'create'
  | 'update'

export const CATEGORIES = [
  'technology',
  'retail',
  'manufacturing',
  'services',
  'healthcare',
  'finance',
  'other',
] as const

export type Category = (typeof CATEGORIES)[number]

export interface User {
  id: string
  email: string
  role: Role
  created_at: string
}

export interface Submission {
  id: string
  user_id: string
  owner_email: string
  title: string
  content: string
  category: Category
  registration_date: string
  state: Status
  created_at: string
  updated_at: string
}

export interface Notification {
  id: string
  user_id: string
  submission_id: string
  message: string
  read: boolean
  created_at: string
}

export interface SubmissionEvent {
  id: string
  submission_id: string
  actor_id: string
  actor_email: string
  actor_role: Role
  action: Action
  from_state: Status | ''
  to_state: Status
  comment: string
  created_at: string
}
