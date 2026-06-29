import { useState } from 'react'
import type { Role, Status } from '../types'

// Workflow-only actions (excludes audit-only 'create' | 'update')
type WorkflowAction = 'submit' | 'start_review' | 'approve' | 'reject' | 'resubmit'

const ROLE_ACTIONS: Record<Role, Partial<Record<Status, WorkflowAction[]>>> = {
  submitter: {
    DRAFT:    ['submit'],
    REJECTED: ['resubmit'],
  },
  reviewer: {
    SUBMITTED:    ['start_review'],
    UNDER_REVIEW: ['approve', 'reject'],
  },
  admin: {
    DRAFT:        ['submit'],
    SUBMITTED:    ['start_review'],
    UNDER_REVIEW: ['approve', 'reject'],
    REJECTED:     ['resubmit'],
  },
}

const ACTION_LABELS: Record<WorkflowAction, string> = {
  submit:       'Submit Application',
  start_review: 'Begin Review',
  approve:      'Approve Registration',
  reject:       'Reject Application',
  resubmit:     'Resubmit Application',
}

const ACTION_STYLE: Record<WorkflowAction, { color: string; border: string; bg: string }> = {
  submit:       { color: '#818cf8', border: 'rgba(129,140,248,0.5)', bg: 'rgba(99,102,241,0.1)'  },
  start_review: { color: '#fbbf24', border: 'rgba(251,191,36,0.4)', bg: 'rgba(251,191,36,0.08)' },
  approve:      { color: '#4ade80', border: 'rgba(74,222,128,0.4)', bg: 'rgba(74,222,128,0.08)' },
  reject:       { color: '#f87171', border: 'rgba(248,113,113,0.4)', bg: 'rgba(248,113,113,0.08)' },
  resubmit:     { color: '#818cf8', border: 'rgba(129,140,248,0.5)', bg: 'rgba(99,102,241,0.1)'  },
}

interface Props {
  state: Status
  role: Role
  onAction: (action: WorkflowAction, comment: string) => Promise<void>
}

export function ActionButtons({ state, role, onAction }: Props) {
  const [comment, setComment] = useState('')
  const [pending, setPending] = useState<WorkflowAction | null>(null)

  const actions = ROLE_ACTIONS[role]?.[state] ?? []
  if (actions.length === 0) return null

  const handle = async (action: WorkflowAction) => {
    setPending(action)
    try {
      await onAction(action, comment)
      setComment('')
    } finally {
      setPending(null)
    }
  }

  return (
    <div style={{
      marginTop: 24,
      padding: '20px 24px',
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid var(--border)',
      borderRadius: 8,
    }}>
      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 14 }}>
        Next Step
      </p>

      {state === 'UNDER_REVIEW' && (
        <textarea
          placeholder="Add notes for the applicant (optional)…"
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={2}
          style={{ marginBottom: 12, resize: 'vertical' }}
        />
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {actions.map(action => {
          const s = ACTION_STYLE[action]
          return (
            <button
              key={action}
              disabled={pending !== null}
              onClick={() => handle(action)}
              style={{
                padding: '8px 20px',
                background: pending === action ? s.bg : 'transparent',
                border: `1px solid ${s.border}`,
                borderRadius: 'var(--radius)',
                color: pending !== null && pending !== action ? 'var(--text-muted)' : s.color,
                fontFamily: 'var(--font-mono)',
                fontSize: 11, letterSpacing: '0.15em',
                textTransform: 'uppercase',
                cursor: pending ? 'not-allowed' : 'pointer',
                transition: 'background 0.25s, color 0.25s',
              }}
              onMouseEnter={e => {
                if (!pending) (e.currentTarget as HTMLElement).style.background = s.bg
              }}
              onMouseLeave={e => {
                if (!pending || pending !== action) (e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
            >
              {pending === action ? '…' : ACTION_LABELS[action]}
            </button>
          )
        })}
      </div>
    </div>
  )
}
