import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authApi } from '../api/auth'
import { useAuth } from '../hooks/useAuth'
import type { Role } from '../types'
import { AuthCard } from '../components/AuthCard'
import { PasswordInput } from '../components/PasswordInput'

export function RegisterPage() {
  const { setUser } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('submitter')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await authApi.register(email, password, role)
      setUser(user)
      nav('/submissions')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard>
      {/* Section label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
        <div style={{ height: 1, width: 20, background: 'var(--accent)' }} />
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 9,
          letterSpacing: '0.3em', textTransform: 'uppercase',
          color: 'var(--accent)',
        }}>
          Create Account
        </span>
      </div>

      <h1 style={{
        fontSize: '1.75rem', fontWeight: 300,
        letterSpacing: '-0.03em', marginBottom: 6,
        color: 'var(--text-primary)',
      }}>
        Get started.
      </h1>
      <p style={{
        fontSize: '0.8rem', fontWeight: 300,
        color: 'var(--text-muted)', marginBottom: 32,
        lineHeight: 1.6,
      }}>
        Register as a submitter to draft documents, or as a reviewer to drive approvals.
      </p>

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
        <input
          placeholder="Email address"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <PasswordInput value={password} onChange={setPassword} />

        {/* Role selector as two toggle buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 2 }}>
          {(['submitter', 'reviewer'] as Role[]).map(r => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              style={{
                padding: '9px 0',
                background: role === r ? 'rgba(99,102,241,0.12)' : 'transparent',
                border: '1px solid',
                borderColor: role === r ? 'rgba(129,140,248,0.5)' : 'var(--border)',
                borderRadius: 'var(--radius)',
                color: role === r ? 'var(--accent)' : 'var(--text-muted)',
                fontFamily: 'var(--font-mono)', fontSize: 10,
                letterSpacing: '0.15em', textTransform: 'uppercase',
                cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              {r}
            </button>
          ))}
        </div>
        <p style={{
          fontFamily: 'var(--font-mono)', fontSize: 9,
          letterSpacing: '0.08em', color: 'var(--text-muted)',
          marginTop: -4,
        }}>
          {role === 'submitter'
            ? 'Submitters create drafts and manage their own submissions.'
            : 'Reviewers start reviews, approve, or reject submitted work.'}
        </p>

        {error && (
          <div style={{
            padding: '9px 12px',
            background: 'rgba(248,113,113,0.08)',
            border: '1px solid var(--red-border)',
            borderRadius: 'var(--radius)',
            color: 'var(--red)',
            fontFamily: 'var(--font-mono)', fontSize: 11,
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: 8,
            padding: '11px 0',
            background: loading ? 'transparent' : 'rgba(99,102,241,0.12)',
            border: '1px solid',
            borderColor: loading ? 'var(--border)' : 'rgba(129,140,248,0.5)',
            borderRadius: 'var(--radius)',
            color: loading ? 'var(--text-muted)' : 'var(--accent)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11, letterSpacing: '0.2em',
            textTransform: 'uppercase',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.25s',
          }}
          onMouseEnter={e => { if (!loading) (e.currentTarget.style.background = 'rgba(99,102,241,0.18)') }}
          onMouseLeave={e => { if (!loading) (e.currentTarget.style.background = 'rgba(99,102,241,0.12)') }}
        >
          {loading ? 'Creating account…' : 'Register →'}
        </button>
      </form>

      <p style={{
        marginTop: 24, fontSize: 12,
        color: 'var(--text-muted)',
      }}>
        Have an account?{' '}
        <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
          Sign in
        </Link>
      </p>
    </AuthCard>
  )
}
