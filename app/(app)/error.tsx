'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
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
      <div style={{ fontSize: 32 }}>⚠</div>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>
        Something went wrong
      </h2>
      {error.digest && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-faint)', fontFamily: 'var(--mono-fern)' }}>
          {error.digest}
        </p>
      )}
      <button
        onClick={reset}
        style={{
          marginTop: 8,
          padding: '8px 20px',
          borderRadius: 10,
          border: '1.5px solid var(--line)',
          background: 'var(--bg-elevated)',
          color: 'var(--ink)',
          fontSize: 14,
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </div>
  )
}
