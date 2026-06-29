import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom'
import { AuthContext } from './hooks/useAuth'
import { useTheme, type Theme } from './hooks/useTheme'
import { authApi } from './api/auth'
import { LoginPage } from './pages/LoginPage'
import { SubmissionsPage } from './pages/SubmissionsPage'
import { SubmissionDetailPage } from './pages/SubmissionDetailPage'
import type { User } from './types'

function Background() {
  return (
    <>
      <div style={{
        pointerEvents: 'none', position: 'fixed', inset: 0, zIndex: 0,
        overflow: 'hidden', opacity: 'var(--orb-opacity)' as never,
        transition: 'opacity 0.4s ease',
      }}>
        <div style={{
          position: 'absolute', top: -120, left: -120,
          width: 600, height: 600, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.18), rgba(59,130,246,0.07), transparent)',
          filter: 'blur(80px)',
        }} />
        <div style={{
          position: 'absolute', top: '20vh', right: -160,
          width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(129,140,248,0.12), rgba(99,102,241,0.05), transparent)',
          filter: 'blur(80px)',
        }} />
        <div style={{
          position: 'absolute', bottom: 0, left: '30%',
          width: 420, height: 420, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(167,139,250,0.1), rgba(99,102,241,0.04), transparent)',
          filter: 'blur(100px)',
        }} />
      </div>
      <div style={{
        pointerEvents: 'none', position: 'fixed', inset: 0, zIndex: 0,
        backgroundImage: 'radial-gradient(circle, var(--dot-color) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
        opacity: 'var(--dot-opacity)' as never,
        transition: 'opacity 0.4s ease',
      }} />
    </>
  )
}

function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1"  x2="12" y2="3"  />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22"   x2="5.64" y2="5.64"   />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1"  y1="12" x2="3"  y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22"  y1="19.78" x2="5.64"  y2="18.36" />
      <line x1="18.36" y1="5.64"  x2="19.78" y2="4.22"  />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 30, height: 30,
        background: 'transparent',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        color: 'var(--text-muted)',
        cursor: 'pointer',
        transition: 'border-color 0.25s, color 0.25s',
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--border-accent)'
        e.currentTarget.style.color = 'var(--accent)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.color = 'var(--text-muted)'
      }}
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}

function Nav({ user, theme, onLogout, onToggleTheme }: {
  user: User | null
  theme: Theme
  onLogout: () => Promise<void>
  onToggleTheme: () => void
}) {
  const nav = useNavigate()

  const handleLogout = async () => {
    await onLogout()
    nav('/login', { replace: true })
  }

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
      display: 'flex', alignItems: 'center',
      padding: '0 32px', height: 56,
      background: 'var(--nav-bg)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--nav-border)',
      transition: 'background 0.3s ease, border-color 0.3s ease',
    }}>
      <Link to="/submissions" style={{
        fontSize: 15, fontWeight: 600,
        color: 'var(--text-primary)',
        textDecoration: 'none',
        transition: 'color 0.2s',
        letterSpacing: '-0.01em',
      }}>
        Open Ownership
      </Link>

      <span style={{
        fontSize: 12, color: 'var(--accent)',
        marginLeft: 10,
        padding: '2px 8px',
        background: 'rgba(124,108,240,0.1)',
        borderRadius: 4,
        fontWeight: 500,
      }}>
        Business Registry
      </span>

      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />

        {user ? (
          <>
            <span style={{
              fontSize: 13, color: 'var(--text-muted)',
              transition: 'color 0.3s',
            }}>
              {user.email}
              <span style={{
                marginLeft: 6,
                padding: '1px 7px',
                background: 'rgba(124,108,240,0.1)',
                border: '1px solid rgba(124,108,240,0.25)',
                borderRadius: 4,
                fontSize: 11, fontWeight: 500,
                color: 'var(--accent)',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.05em',
              }}>{user.role}</span>
            </span>
            <button
              onClick={handleLogout}
              style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 6, padding: '5px 13px',
                color: 'var(--text-secondary)',
                fontSize: 13, fontWeight: 500,
                cursor: 'pointer',
                transition: 'border-color 0.2s, color 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--red-border)'
                e.currentTarget.style.color = 'var(--red)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.color = 'var(--text-secondary)'
              }}
            >
              Logout
            </button>
          </>
        ) : (
          <Link to="/login" style={{
            fontSize: 13, fontWeight: 500,
            color: 'var(--text-secondary)', textDecoration: 'none',
          }}>
            Login
          </Link>
        )}
      </div>
    </nav>
  )
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const [checked, setChecked] = useState(false)
  const [authed, setAuthed] = useState(false)
  const nav = useNavigate()

  useEffect(() => {
    authApi.me()
      .then(() => setAuthed(true))
      .catch(() => nav('/login'))
      .finally(() => setChecked(true))
  }, [nav])

  if (!checked) return null
  if (!authed) return null
  return <>{children}</>
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const { theme, toggle } = useTheme()

  useEffect(() => {
    authApi.me().then(setUser).catch(() => {})
  }, [])

  const handleLogout = async () => {
    await authApi.logout().catch(() => {})
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      <BrowserRouter>
        <Background />
        <Nav user={user} theme={theme} onLogout={handleLogout} onToggleTheme={toggle} />
        <div style={{ position: 'relative', zIndex: 10, paddingTop: 56 }}>
          <Routes>
            <Route path="/login"    element={<LoginPage />} />
            <Route path="/register" element={<Navigate to="/login" replace />} />
            <Route path="/submissions"     element={<RequireAuth><SubmissionsPage /></RequireAuth>} />
            <Route path="/submissions/:id" element={<RequireAuth><SubmissionDetailPage /></RequireAuth>} />
            <Route path="*"                element={<Navigate to="/submissions" replace />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthContext.Provider>
  )
}
