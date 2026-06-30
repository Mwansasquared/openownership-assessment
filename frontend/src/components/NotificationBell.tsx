import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { notificationsApi } from '../api/notifications'
import type { Notification } from '../types'

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  const hr  = Math.floor(diff / 3_600_000)
  const day = Math.floor(diff / 86_400_000)
  if (min < 1)  return 'just now'
  if (min < 60) return `${min}m ago`
  if (hr < 24)  return `${hr}h ago`
  return `${day}d ago`
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const nav = useNavigate()

  const unread = notifications.filter(n => !n.read).length

  const fetchNotifications = () => {
    notificationsApi.list()
      .then(setNotifications)
      .catch(() => {})
  }

  // Initial fetch + poll every 30 s
  useEffect(() => {
    fetchNotifications()
    const id = setInterval(fetchNotifications, 30_000)
    return () => clearInterval(id)
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleMarkAllRead = async () => {
    await notificationsApi.markAllRead().catch(() => {})
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const handleClick = (n: Notification) => {
    setOpen(false)
    nav(`/submissions/${n.submission_id}`)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={() => { if (!open) fetchNotifications(); setOpen(v => !v) }}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
        style={{
          position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 30, height: 30,
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          color: open ? 'var(--accent)' : 'var(--text-muted)',
          borderColor: open ? 'var(--border-accent)' : 'var(--border)',
          cursor: 'pointer',
          transition: 'border-color 0.25s, color 0.25s',
          flexShrink: 0,
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'var(--border-accent)'
          e.currentTarget.style.color = 'var(--accent)'
        }}
        onMouseLeave={e => {
          if (!open) {
            e.currentTarget.style.borderColor = 'var(--border)'
            e.currentTarget.style.color = 'var(--text-muted)'
          }
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            minWidth: 16, height: 16,
            background: '#f87171',
            borderRadius: '50%',
            fontSize: 10, fontWeight: 700,
            color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1,
            padding: '0 3px',
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: 340,
          background: 'var(--panel-bg)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,0.24)',
          zIndex: 200,
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: notifications.length > 0 ? '1px solid var(--border)' : 'none',
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              Notifications
            </span>
            {unread > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{
                  background: 'transparent', border: 'none', padding: 0,
                  fontSize: 12, color: 'var(--accent)',
                  cursor: 'pointer', fontWeight: 500,
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          {notifications.length === 0 ? (
            <p style={{
              padding: '24px 16px', textAlign: 'center',
              fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic',
            }}>
              No notifications yet
            </p>
          ) : (
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              {notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => handleClick(n)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '12px 16px',
                    borderTop: '1px solid var(--border)',
                    cursor: 'pointer',
                    background: n.read ? 'transparent' : 'rgba(124,108,240,0.05)',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(124,108,240,0.05)')}
                >
                  {/* Unread dot */}
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%', flexShrink: 0, marginTop: 5,
                    background: n.read ? 'transparent' : 'var(--accent)',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 13, color: 'var(--text-primary)',
                      lineHeight: 1.45, marginBottom: 3,
                      fontWeight: n.read ? 400 : 500,
                    }}>
                      {n.message}
                    </p>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {relativeTime(n.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
