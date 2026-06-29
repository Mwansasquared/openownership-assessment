import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { submissionsApi } from '../api/submissions'
import { useAuth } from '../hooks/useAuth'
import { StatusBadge } from '../components/StatusBadge'
import type { Role, Submission } from '../types'

// ── Date helper ───────────────────────────────────────────────────────────

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min  = Math.floor(diff / 60_000)
  const hr   = Math.floor(diff / 3_600_000)
  const day  = Math.floor(diff / 86_400_000)
  if (min < 1)  return 'just now'
  if (min < 60) return `${min}m ago`
  if (hr < 24)  return `${hr}h ago`
  if (day < 7)  return `${day}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// ── Create form ───────────────────────────────────────────────────────────

function CreateForm({ onCreated }: { onCreated: (id: string) => void }) {
  const [title, setTitle]     = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const submit = async () => {
    if (!title.trim()) return
    setLoading(true)
    setError('')
    try {
      const sub = await submissionsApi.create(title.trim(), content)
      onCreated(sub.id)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fade-up" style={{
      marginBottom: 28,
      padding: '24px',
      background: 'var(--panel-bg)',
      border: '1px solid var(--border)',
      borderRadius: 10,
    }}>
      <p style={{
        fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)',
        letterSpacing: '0.02em', textTransform: 'uppercase',
        marginBottom: 16,
      }}>New Application</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={{
            display: 'block', fontSize: 13, color: 'var(--text-secondary)',
            marginBottom: 6, fontWeight: 500,
          }}>Business Name</label>
          <input
            placeholder="Legal name of the business"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            autoFocus
          />
        </div>

        <div>
          <label style={{
            display: 'block', fontSize: 13, color: 'var(--text-secondary)',
            marginBottom: 6, fontWeight: 500,
          }}>Business Description <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
          <textarea
            placeholder="Describe the business, its activities, registered owners, and any other relevant details…"
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={3}
            style={{ resize: 'vertical' }}
          />
        </div>

        {error && (
          <p style={{ fontSize: 13, color: 'var(--red)' }}>{error}</p>
        )}

        <button
          onClick={submit}
          disabled={loading || !title.trim()}
          style={{
            padding: '10px 0',
            background: loading || !title.trim()
              ? 'rgba(124,108,240,0.3)'
              : 'var(--accent)',
            border: 'none',
            borderRadius: 'var(--radius)',
            color: '#fff',
            fontSize: 14, fontWeight: 500,
            cursor: loading || !title.trim() ? 'not-allowed' : 'pointer',
            transition: 'opacity 0.2s, background 0.2s',
            opacity: !title.trim() ? 0.6 : 1,
          }}
        >
          {loading ? 'Creating…' : 'Start Application'}
        </button>
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────

function EmptyState({ role, onNew }: { role?: Role; onNew: () => void }) {
  return (
    <div className="fade-up-1" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '64px 24px', textAlign: 'center',
      border: '1px dashed var(--border)',
      borderRadius: 10,
    }}>
      <div style={{
        width: 48, height: 48, marginBottom: 16, borderRadius: '50%',
        background: 'rgba(124,108,240,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22,
      }}>
        {role === 'reviewer' ? '📋' : '🏢'}
      </div>
      <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>
        {role === 'reviewer' ? 'No applications to review' : 'No applications yet'}
      </p>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 340 }}>
        {role === 'reviewer'
          ? 'Business registration applications will appear here once they have been submitted for review.'
          : 'Start a new business registration application — enter the business name, add your details, and submit when ready for review.'}
      </p>
      {role !== 'reviewer' && (
        <button
          onClick={onNew}
          style={{
            marginTop: 20, padding: '9px 20px',
            background: 'var(--accent)', border: 'none',
            borderRadius: 'var(--radius)',
            color: '#fff', fontSize: 14, fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          + New Application
        </button>
      )}
    </div>
  )
}

// ── Row ───────────────────────────────────────────────────────────────────

function SubmissionRow({ sub, showOwner }: { sub: Submission; showOwner: boolean }) {
  const nav = useNavigate()
  const cols = showOwner ? '1fr 180px 140px 90px' : '1fr 140px 90px'

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: cols,
        alignItems: 'center',
        padding: '16px 16px',
        borderTop: '1px solid var(--border)',
        cursor: 'pointer',
        transition: 'background 0.15s',
        borderRadius: 0,
        gap: 12,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      onClick={() => nav(`/submissions/${sub.id}`)}
    >
      <div>
        <Link
          to={`/submissions/${sub.id}`}
          onClick={e => e.stopPropagation()}
          style={{
            display: 'block',
            color: 'var(--text-primary)',
            textDecoration: 'none',
            fontSize: 15, fontWeight: 450,
            marginBottom: showOwner ? 2 : 0,
          }}
        >
          {sub.title}
        </Link>
      </div>

      {showOwner && (
        <span style={{ fontSize: 13, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {sub.owner_email}
        </span>
      )}

      <StatusBadge state={sub.state} />

      <span style={{
        fontSize: 13, color: 'var(--text-muted)',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {relativeDate(sub.updated_at)}
      </span>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────

export function SubmissionsPage() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [showCreate, setShowCreate]   = useState(false)
  const [error, setError]             = useState('')

  useEffect(() => {
    submissionsApi.list()
      .then(setSubmissions)
      .catch(err => setError((err as Error).message))
  }, [])

  const handleCreated = (id: string) => nav(`/submissions/${id}`)

  const canCreate  = user?.role !== 'reviewer'
  const showOwner  = user?.role === 'reviewer' || user?.role === 'admin'
  const headerCols = showOwner ? '1fr 180px 140px 90px' : '1fr 140px 90px'

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '48px 24px' }}>

      {/* Page header */}
      <div className="fade-up" style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: 32,
      }}>
        <div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>
            Applications
          </h1>
          {submissions.length > 0 && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {submissions.length} {submissions.length === 1 ? 'application' : 'applications'}
            </p>
          )}
        </div>

        {canCreate && (
          <button
            onClick={() => setShowCreate(v => !v)}
            style={{
              padding: '9px 18px',
              background: showCreate ? 'transparent' : 'var(--accent)',
              border: showCreate ? '1px solid var(--border)' : 'none',
              borderRadius: 'var(--radius)',
              color: showCreate ? 'var(--text-secondary)' : '#fff',
              fontSize: 14, fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              if (!showCreate) (e.currentTarget as HTMLElement).style.opacity = '0.88'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.opacity = '1'
            }}
          >
            {showCreate ? '✕  Cancel' : '+ New Application'}
          </button>
        )}
      </div>

      {showCreate && <CreateForm onCreated={handleCreated} />}

      {error && (
        <div style={{
          padding: '11px 16px', marginBottom: 20,
          background: 'rgba(248,113,113,0.07)',
          border: '1px solid var(--red-border)',
          borderRadius: 'var(--radius)',
          color: 'var(--red)', fontSize: 14,
        }}>
          {error}
        </div>
      )}

      {submissions.length === 0 ? (
        <EmptyState role={user?.role} onNew={() => setShowCreate(true)} />
      ) : (
        <div className="fade-up-1" style={{
          border: '1px solid var(--border)',
          borderRadius: 10, overflow: 'hidden',
        }}>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: headerCols,
            padding: '10px 16px',
            background: 'var(--panel-bg)',
            borderBottom: '1px solid var(--border)',
            gap: 12,
          }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>Business Name</span>
            {showOwner && <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>Applicant</span>}
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>Status</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>Updated</span>
          </div>

          {submissions.map((s, i) => (
            <div key={s.id} className={`fade-up-${Math.min(i + 1, 4) as 1 | 2 | 3 | 4}`}>
              <SubmissionRow sub={s} showOwner={showOwner} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
