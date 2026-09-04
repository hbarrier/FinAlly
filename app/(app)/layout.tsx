import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ThemeToggle } from '@/components/theme-toggle'
import { SidebarNav } from './sidebar-nav'
import { getUserSettings, getModules } from '@/lib/queries/user-settings'
import { listSavingAccounts } from '@/lib/queries/saving-accounts'
import { ensureInstancesUpTo, currentMonth } from '@/lib/recurring-instances'
import styles from './layout.module.css'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const settings = await getUserSettings()
  if (!settings?.onboarded) redirect('/onboarding')

  const modules = await getModules()
  if (modules.recurring) await ensureInstancesUpTo(currentMonth())
  const savingAccounts = await listSavingAccounts()

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
            <SidebarNav modules={modules} savingAccounts={savingAccounts} />
          </Suspense>
        </nav>

        {/* Footer */}
        <div className={styles.sidebarFooter}>
          <Link href="/settings" className={styles.userLink}>
            <div className={styles.avatar}>
              {(settings?.name ?? 'Y').slice(0, 1).toUpperCase()}
            </div>
            <div className={styles.userMeta}>
              <div className={styles.userName}>
                {settings?.name ?? 'You'}
              </div>
              <div className={styles.userCurrency}>
                {settings?.currency ?? 'EUR'}
              </div>
            </div>
          </Link>
          <ThemeToggle />
        </div>
      </aside>

      {/* Main content */}
      <main className={styles.main}>
        {children}
      </main>
    </div>
  )
}
