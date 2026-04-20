import { ThemeToggle } from '@/components/theme-toggle'
import { SidebarNav } from './sidebar-nav'
import { db } from '@/lib/db'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const settings = await db.query.userSettings.findFirst()

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: 'var(--bg)',
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          width: 220,
          flexShrink: 0,
          background: 'var(--bg-elevated)',
          borderRight: '1px solid var(--line-soft)',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 20,
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: '24px 20px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderBottom: '1px solid var(--line-soft)',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: 'var(--terracotta)',
              color: 'white',
              display: 'grid',
              placeItems: 'center',
              fontFamily: 'var(--serif)',
              fontSize: 20,
              fontStyle: 'italic',
              lineHeight: 1,
            }}
          >
            f
          </div>
          <span
            style={{
              fontFamily: 'var(--serif)',
              fontSize: 18,
              fontStyle: 'italic',
              color: 'var(--ink)',
            }}
          >
            Fern
          </span>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          <SidebarNav />
        </nav>

        {/* Footer */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid var(--line-soft)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: 'var(--terracotta-bg)',
              color: 'var(--terracotta-ink)',
              display: 'grid',
              placeItems: 'center',
              fontSize: 13,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {(settings?.name ?? 'Y').slice(0, 1).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: 13,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                color: 'var(--ink)',
              }}
            >
              {settings?.name ?? 'You'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
              € · EUR
            </div>
          </div>
          <ThemeToggle />
        </div>
      </aside>

      {/* Main content */}
      <main
        style={{
          flex: 1,
          marginLeft: 220,
          padding: '32px 40px',
          maxWidth: 1200,
        }}
      >
        {children}
      </main>
    </div>
  )
}
