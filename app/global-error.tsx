'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: 16,
          textAlign: 'center',
          fontFamily: 'var(--sans, system-ui, sans-serif)',
          background: 'var(--bg, #f5f5fa)',
          margin: 0,
          padding: 24,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--ink, #111)' }}>
          Something went wrong
        </h2>
        {error.digest && (
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: 'var(--ink-faint, #666)',
              fontFamily: 'var(--mono-fern, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)',
            }}
          >
            {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          style={{
            marginTop: 8,
            padding: '8px 20px',
            borderRadius: 10,
            border: '1.5px solid var(--line, #ddd)',
            background: 'var(--bg-elevated, #fff)',
            color: 'var(--ink, #111)',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  )
}
