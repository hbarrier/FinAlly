import { Suspense } from 'react'
import { ThemeToggle } from '@/components/theme-toggle'
import { SidebarNav } from './sidebar-nav'
import { getUserSettings } from '@/lib/queries/user-settings'
import { RecurringInstancesBootstrap } from '@/components/fern/recurring-instances-bootstrap'
import styles from './layout.module.css'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const settings = await getUserSettings()

  return (
    <div className={styles.appShell}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        {/* Logo */}
        <div className={styles.logo}>
          <div className={styles.logoMark}>
            f
          </div>
          <span className={styles.logoType}>
            FinAlly
          </span>
        </div>

        {/* Nav */}
        <nav className={styles.nav}>
          <Suspense fallback={null}>
            <SidebarNav />
          </Suspense>
        </nav>

        {/* Footer */}
        <div className={styles.sidebarFooter}>
          <div className={styles.avatar}>
            {(settings?.name ?? 'Y').slice(0, 1).toUpperCase()}
          </div>
          <div className={styles.userMeta}>
            <div className={styles.userName}>
              {settings?.name ?? 'You'}
            </div>
            <div className={styles.userCurrency}>
              € · EUR
            </div>
          </div>
          <ThemeToggle />
        </div>
      </aside>

      {/* Main content */}
      <main className={styles.main}>
        <RecurringInstancesBootstrap />
        {children}
      </main>
    </div>
  )
}
