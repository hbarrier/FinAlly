import Link from 'next/link'

/** Renders inside the app shell, so a missing record / disabled module keeps the sidebar. */
export default function NotFound() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: 16,
        textAlign: 'center',
      }}
    >
      <p style={{ margin: 0, fontSize: 48, fontFamily: 'var(--serif)', fontStyle: 'italic', color: 'var(--ink-faint)' }}>
        404
      </p>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>
        Not found
      </h2>
      <Link
        href="/dashboard"
        style={{
          marginTop: 8,
          padding: '8px 20px',
          borderRadius: 10,
          border: '1.5px solid var(--line)',
          background: 'var(--bg-elevated)',
          color: 'var(--ink)',
          fontSize: 14,
          fontWeight: 500,
          textDecoration: 'none',
        }}
      >
        Back to dashboard
      </Link>
    </div>
  )
}
