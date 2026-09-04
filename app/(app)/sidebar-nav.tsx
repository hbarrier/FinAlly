'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from '@/components/fern/icon'
import type { ModuleKey, Modules, SavingAccount } from '@/lib/db-types'
import styles from './sidebar-nav.module.css'

type NavItem = { href: string; label: string; icon: string; module?: ModuleKey }
type NavSection = { title?: string; items: NavItem[] }

const NAV: NavSection[] = [
  {
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: 'home' },
      { href: '/transactions', label: 'Credit Account', icon: 'list' },
      { href: '/recurring', label: 'Recurrings', icon: 'repeat', module: 'recurring' },
    ],
  },
  {
    items: [
      { href: '/budgets', label: 'Budget', icon: 'pie', module: 'budgets' },
      { href: '/goals', label: 'Goals', icon: 'target', module: 'objectives' },
      { href: '/simulations', label: 'Simulations', icon: 'flask', module: 'simulations' },
    ],
  },
  {
    title: 'Groups',
    items: [
      { href: '/groups', label: 'Groups', icon: 'users', module: 'groups' },
    ],
  },
  {
    title: 'Divorce',
    items: [
      { href: '/reimbursements', label: 'Reimbursements', icon: 'receipt', module: 'divorce' },
      { href: '/tax-status', label: 'Tax Status', icon: 'fileText', module: 'divorce' },
    ],
  },
  {
    title: 'Admin',
    items: [
      { href: '/accounts', label: 'Accounts', icon: 'bank' },
      { href: '/merchants', label: 'Merchants', icon: 'store' },
      { href: '/categories', label: 'Categories', icon: 'tag' },
      { href: '/settings', label: 'Settings', icon: 'settings' },
    ],
  },
]

export function SidebarNav({
  modules,
  savingAccounts = [],
}: {
  modules: Modules
  savingAccounts?: SavingAccount[]
}) {
  const pathname = usePathname()

  const savingItems: NavItem[] = savingAccounts.map((a) => ({
    href: `/savings/${a.id}`,
    label: a.name,
    icon: 'bank',
  }))

  const sections = NAV.map((section) => {
    const items = section.items.filter((item) => !item.module || modules[item.module])
    const creditIdx = items.findIndex((item) => item.href === '/transactions')
    if (creditIdx !== -1 && savingItems.length > 0) {
      items.splice(creditIdx + 1, 0, ...savingItems)
    }
    return { ...section, items }
  }).filter((section) => section.items.length > 0)

  return (
    <>
      {sections.map((section, i) => (
        <div key={section.title ?? i} className={styles.section}>
          {i > 0 && <div className={styles.separator} />}
          {section.title && <div className={styles.groupTitle}>{section.title}</div>}
          {section.items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? `${styles.link} ${styles.active}` : styles.link}
              >
                <Icon name={item.icon} size={16} />
                {item.label}
              </Link>
            )
          })}
        </div>
      ))}
    </>
  )
}
