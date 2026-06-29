const STATES = [
  { label: 'Draft',        color: '#9ba3b8', border: 'rgba(155,163,184,0.3)' },
  { label: 'Submitted',    color: '#7c6af0', border: 'rgba(124,106,240,0.4)' },
  { label: 'Under Review', color: '#fbbf24', border: 'rgba(251,191,36,0.4)'  },
  { label: 'Approved',     color: '#4ade80', border: 'rgba(74,222,128,0.4)'  },
  { label: 'Rejected',     color: '#f87171', border: 'rgba(248,113,113,0.4)' },
]

const STACK = ['Go 1.23', 'Chi', 'pgx', 'PostgreSQL', 'React 19', 'Vite', 'TypeScript', 'JWT']

function LeftPanel() {
  return (
    <div style={{
      padding: '40px 36px',
      background: 'linear-gradient(160deg, rgba(99,102,241,0.07) 0%, rgba(6,6,20,0) 60%)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      minHeight: 520,
    }}>
      {/* Label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
        <div style={{ height: 1, width: 20, background: 'var(--accent)' }} />
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 9,
          letterSpacing: '0.3em', textTransform: 'uppercase',
          color: 'var(--accent)',
        }}>
          Open Ownership · Business Registry
        </span>
      </div>

      {/* Heading */}
      <h2 style={{
        fontSize: 'clamp(1.3rem, 2.5vw, 1.7rem)',
        fontWeight: 600, letterSpacing: '-0.02em',
        lineHeight: 1.2, marginBottom: 16,
        color: 'var(--text-primary)',
      }}>
        Business<br />Registration Portal.
      </h2>

      {/* Description */}
      <p style={{
        fontSize: '0.875rem', fontWeight: 400,
        lineHeight: 1.75, color: 'var(--text-muted)',
        marginBottom: 28,
      }}>
        Submit and track business registration applications through a structured
        approval pipeline. Applicants draft and submit; registry officers review,
        approve, or request changes — with a full audit trail throughout.
      </p>

      {/* State flow */}
      <div style={{ marginBottom: 'auto' }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 9,
          letterSpacing: '0.25em', textTransform: 'uppercase',
          color: 'var(--text-muted)', display: 'block', marginBottom: 12,
        }}>
          Application Status Flow
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {STATES.map((s, i) => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                display: 'inline-block',
                padding: '2px 9px',
                border: `1px solid ${s.border}`,
                borderRadius: 3,
                background: s.border.replace('0.4', '0.06'),
                color: s.color,
                fontFamily: 'var(--font-mono)', fontSize: 9,
                letterSpacing: '0.12em', textTransform: 'uppercase',
              }}>
                {s.label}
              </span>
              {i < STATES.length - 1 && (
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9,
                  color: 'var(--text-muted)',
                }}>
                  {i === 2 ? '→ / ↓' : '→'}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Stack */}
      <div style={{ marginTop: 32 }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 9,
          letterSpacing: '0.25em', textTransform: 'uppercase',
          color: 'var(--text-muted)', display: 'block', marginBottom: 10,
        }}>
          Stack
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {STACK.map(t => (
            <span key={t} style={{
              padding: '2px 8px',
              border: '1px solid var(--border)',
              borderRadius: 3,
              fontFamily: 'var(--font-mono)', fontSize: 9,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              color: 'var(--text-muted)',
            }}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

interface Props {
  children: React.ReactNode
}

export function AuthCard({ children }: Props) {
  return (
    <div style={{
      minHeight: 'calc(100vh - 56px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px',
    }}>
      <div className="fade-up" style={{
        width: '100%', maxWidth: 860,
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        border: '1px solid var(--border)',
        borderRadius: 10,
        overflow: 'hidden',
        background: 'rgba(255,255,255,0.015)',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 0 80px rgba(99,102,241,0.06)',
      }}>
        <LeftPanel />
        <div style={{ padding: '40px 36px', display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
