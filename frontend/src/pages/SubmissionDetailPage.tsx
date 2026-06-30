import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { submissionsApi } from '../api/submissions'
import { useAuth } from '../hooks/useAuth'
import { StatusBadge } from '../components/StatusBadge'
import { ActionButtons } from '../components/ActionButtons'
import { CATEGORIES } from '../types'
import type { Action, Role, Submission, SubmissionEvent } from '../types'

// ── Helpers ────────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  create:             'Application created',
  update:             'Application updated',
  submit:             'Submitted for review',
  start_review:       'Review started',
  approve:            'Registration approved',
  reject:             'Application rejected',
  return_for_changes: 'Returned for changes',
  resubmit:           'Resubmitted for review',
}

const ROLE_DISPLAY: Record<string, string> = {
  submitter: 'Applicant',
  reviewer:  'Reviewer',
  admin:     'Admin',
}

const ROLE_COLORS: Record<Role, { color: string; border: string; bg: string }> = {
  submitter: { color: '#818cf8', border: 'rgba(129,140,248,0.35)', bg: 'rgba(99,102,241,0.07)'  },
  reviewer:  { color: '#fbbf24', border: 'rgba(251,191,36,0.35)',  bg: 'rgba(251,191,36,0.06)'  },
  admin:     { color: '#4ade80', border: 'rgba(74,222,128,0.35)',  bg: 'rgba(74,222,128,0.06)'  },
}

function RoleBadge({ role }: { role: Role | undefined }) {
  const s = role ? ROLE_COLORS[role] : null
  if (!s) return null
  return (
    <span style={{
      display: 'inline-block',
      padding: '1px 7px',
      borderRadius: 3,
      border: `1px solid ${s.border}`,
      background: s.bg,
      color: s.color,
      fontFamily: 'var(--font-mono)',
      fontSize: 9,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    }}>
      {ROLE_DISPLAY[role ?? ''] ?? role}
    </span>
  )
}

function EventRow({ e }: { e: SubmissionEvent }) {
  const isLifecycle = e.action === 'create' || e.action === 'update'

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '130px 200px 1fr 150px',
        alignItems: 'center',
        padding: '12px 16px',
        borderTop: '1px solid var(--border)',
        gap: 8,
        transition: 'background 0.2s',
      }}
      onMouseEnter={ev => (ev.currentTarget.style.background = 'var(--surface-hover)')}
      onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}
    >
      {/* Action */}
      <div>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--accent)' }}>
          {ACTION_LABELS[e.action] ?? e.action}
        </span>
        {!isLifecycle && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5, marginTop: 3,
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--text-muted)', textTransform: 'uppercase',
          }}>
            <span>{e.from_state || '—'}</span>
            <span style={{ color: 'var(--border-accent)' }}>→</span>
            <span style={{ color: 'var(--text-secondary)' }}>{e.to_state.replace('_', ' ')}</span>
          </div>
        )}
      </div>

      {/* By (actor) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, overflow: 'hidden' }}>
        <span style={{
          fontSize: 13,
          color: 'var(--text-secondary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {e.actor_email}
        </span>
        <RoleBadge role={e.actor_role} />
      </div>

      {/* Comment */}
      <span style={{
        fontSize: 13,
        color: e.comment ? 'var(--text-secondary)' : 'var(--text-muted)',
        fontStyle: e.comment ? 'normal' : 'italic',
      }}>
        {e.comment || '—'}
      </span>

      {/* When */}
      <span style={{
        fontSize: 12, color: 'var(--text-muted)',
        textAlign: 'right', whiteSpace: 'nowrap',
      }}>
        {new Date(e.created_at).toLocaleString()}
      </span>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export function SubmissionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const nav = useNavigate()
  const [sub, setSub] = useState<Submission | null>(null)
  const [events, setEvents] = useState<SubmissionEvent[]>([])
  const [editing, setEditing]             = useState(false)
  const [title, setTitle]                 = useState('')
  const [content, setContent]             = useState('')
  const [category, setCategory]           = useState('')
  const [registrationDate, setRegistrationDate] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    Promise.all([submissionsApi.get(id), submissionsApi.listEvents(id)])
      .then(([s, evts]) => {
        setSub(s)
        setTitle(s.title)
        setContent(s.content)
        setCategory(s.category)
        setRegistrationDate(s.registration_date)
        setEvents(evts)
      })
      .catch(err => setError((err as Error).message))
  }, [id])

  const refresh = async () => {
    if (!id) return
    const [s, evts] = await Promise.all([submissionsApi.get(id), submissionsApi.listEvents(id)])
    setSub(s); setEvents(evts)
  }

  const saveEdit = async () => {
    if (!id) return
    const updated = await submissionsApi.update(id, title, content, category, registrationDate)
    setSub(updated); setEditing(false)
  }

  const doAction = async (action: Action, comment: string) => {
    if (!id) return
    try {
      await submissionsApi.performAction(id, action, comment)
      await refresh()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const doDelete = async () => {
    if (!id || !confirm('Delete this application draft? This cannot be undone.')) return
    await submissionsApi.delete(id)
    nav('/submissions')
  }

  if (error) return (
    <div style={{ padding: '40px 24px', maxWidth: 800, margin: '0 auto' }}>
      <div style={{
        padding: '12px 16px',
        background: 'rgba(248,113,113,0.08)', border: '1px solid var(--red-border)',
        borderRadius: 'var(--radius)', color: 'var(--red)',
        fontFamily: 'var(--font-mono)', fontSize: 12,
      }}>{error}</div>
    </div>
  )

  if (!sub || !user) return (
    <div style={{ minHeight: 'calc(100vh - 56px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 11,
        letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text-muted)',
      }}>Loading…</span>
    </div>
  )

  const canEdit = user.role !== 'reviewer' && sub.state === 'DRAFT' && sub.user_id === user.id

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 13, color: 'var(--text-secondary)',
    marginBottom: 6, fontWeight: 500,
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px' }}>

      {/* Back */}
      <button
        onClick={() => nav('/submissions')}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'transparent', border: 'none', padding: 0,
          fontSize: 14, fontWeight: 500,
          color: 'var(--text-muted)', cursor: 'pointer',
          marginBottom: 28, transition: 'color 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
      >
        ← All applications
      </button>

      {/* Header */}
      <div className="fade-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{ flex: 1, marginRight: 20 }}>
          {editing ? (
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              style={{ fontSize: '1.5rem', fontWeight: 500, letterSpacing: '-0.01em', marginBottom: 12 }}
            />
          ) : (
            <h1 style={{
              fontSize: 'clamp(1.4rem, 3vw, 1.875rem)', fontWeight: 600,
              letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: 10,
            }}>
              {sub.title}
            </h1>
          )}
          <StatusBadge state={sub.state} />
        </div>

        {canEdit && !editing && (
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={() => setEditing(true)} style={btnStyle('default')}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-accent)'; e.currentTarget.style.color = 'var(--accent)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}>
              Edit
            </button>
            <button onClick={doDelete} style={btnStyle('danger')}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              Delete
            </button>
          </div>
        )}
        {editing && (
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={saveEdit} style={btnStyle('success')}>Save changes</button>
            <button onClick={() => { setEditing(false); setTitle(sub.title); setContent(sub.content); setCategory(sub.category); setRegistrationDate(sub.registration_date) }} style={btnStyle('default')}>Cancel</button>
          </div>
        )}
      </div>

      {/* Meta (category + reg date + timestamps) */}
      <div className="fade-up-1" style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 24,
      }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Applicant: <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{sub.owner_email}</span>
        </span>
        <span style={{ color: 'var(--border)', fontSize: 16 }}>·</span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
          {sub.category}
        </span>
        <span style={{ color: 'var(--border)', fontSize: 16 }}>·</span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Reg. date: <span style={{ color: 'var(--text-secondary)' }}>{sub.registration_date}</span>
        </span>
        <span style={{ color: 'var(--border)', fontSize: 16 }}>·</span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{new Date(sub.created_at).toLocaleString()}</span>
      </div>

      {/* Content panel */}
      <div className="fade-up-1" style={{
        padding: '20px 24px', background: 'var(--panel-bg)',
        border: '1px solid var(--border)', borderRadius: 10, marginBottom: 20,
      }}>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Category</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 12px',
                    background: 'var(--input-bg, var(--panel-bg))',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    color: 'var(--text-primary)', fontSize: 14,
                  }}
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Registration Date</label>
                <input
                  type="date"
                  value={registrationDate}
                  onChange={e => setRegistrationDate(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Description</label>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={8}
                style={{ resize: 'vertical', minHeight: 160 }}
              />
            </div>
          </div>
        ) : (
          <p style={{
            whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.75,
            color: sub.content ? 'var(--text-primary)' : 'var(--text-muted)',
            fontStyle: sub.content ? 'normal' : 'italic',
          }}>
            {sub.content || 'No description provided.'}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="fade-up-2">
        <ActionButtons state={sub.state} role={user.role} onAction={doAction} />
      </div>

      {/* Audit trail */}
      {events.length > 0 && (
        <div className="fade-up-3" style={{ marginTop: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Application History
            </span>
          </div>

          <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '130px 200px 1fr 150px',
              padding: '10px 16px', gap: 8,
              background: 'var(--panel-bg)',
              borderBottom: '1px solid var(--border)',
              fontSize: 12, fontWeight: 500, color: 'var(--text-muted)',
            }}>
              <span>Action</span>
              <span>By</span>
              <span>Comment</span>
              <span style={{ textAlign: 'right' }}>When</span>
            </div>

            {events.map(e => <EventRow key={e.id} e={e} />)}
          </div>
        </div>
      )}
    </div>
  )
}

// Shared button style factory
function btnStyle(variant: 'default' | 'danger' | 'success'): React.CSSProperties {
  const map = {
    default: { border: '1px solid var(--border)',       color: 'var(--text-secondary)', background: 'transparent' },
    danger:  { border: '1px solid var(--red-border)',   color: 'var(--red)',            background: 'transparent' },
    success: { border: 'none', color: '#fff', background: 'var(--accent)' },
  }
  return {
    ...map[variant],
    padding: '7px 16px', borderRadius: 'var(--radius)',
    fontSize: 13, fontWeight: 500,
    cursor: 'pointer', transition: 'all 0.2s',
  }
}
