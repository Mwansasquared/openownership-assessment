import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../api/auth'
import { useAuth } from '../hooks/useAuth'
import { AuthCard } from '../components/AuthCard'
import { PasswordInput } from '../components/PasswordInput'

export function LoginPage() {
  const { setUser } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await authApi.login(email, password)
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
          Sign In
        </span>
      </div>

      <h1 style={{
        fontSize: '1.75rem', fontWeight: 300,
        letterSpacing: '-0.03em', marginBottom: 6,
        color: 'var(--text-primary)',
      }}>
        Welcome back.
      </h1>
      <p style={{
        fontSize: '0.8rem', fontWeight: 300,
        color: 'var(--text-muted)', marginBottom: 32,
        lineHeight: 1.6,
      }}>
        Sign in with your assigned credentials to manage applications or review pending registrations.
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
          {loading ? 'Signing in…' : 'Sign In →'}
        </button>
      </form>

    </AuthCard>
  )
}
