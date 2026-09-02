'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from '@/components/fern/icon'
import type { ModuleKey, Modules } from '@/lib/db-types'
import styles from './sidebar-nav.module.css'

type NavItem = { href: string; label: string; icon: string; module?: ModuleKey }
type NavSection = { title?: string; items: NavItem[] }

const NAV: NavSection[] = [
  {
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: 'home' },
      { href: '/transactions', label: 'Movements', icon: 'list' },
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
      { href: '/reimbursements', label: 'Reimbursements', icon: 'receipt', module: 'groups' },
      { href: '/tax-status', label: 'Tax Status', icon: 'fileText', module: 'taxstatus' },
    ],
  },
  {
    title: 'Admin',
    items: [
      { href: '/merchants', label: 'Merchants', icon: 'store' },
      { href: '/categories', label: 'Categories', icon: 'tag' },
      { href: '/settings', label: 'Settings', icon: 'settings' },
    ],
  },
]

export function SidebarNav({ modules }: { modules: Modules }) {
  const pathname = usePathname()

  const sections = NAV.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.module || modules[item.module]),
  })).filter((section) => section.items.length > 0)

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
