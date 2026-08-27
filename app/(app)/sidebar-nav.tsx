'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from '@/components/fern/icon'
import type { ModuleKey, Modules } from '@/lib/db-types'
import styles from './sidebar-nav.module.css'

const NAV: { href: string; label: string; icon: string; module?: ModuleKey }[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'home' },
  { href: '/transactions', label: 'Movements', icon: 'list' },
  { href: '/recurring', label: 'Recurring', icon: 'repeat', module: 'recurring' },
  { href: '/reimbursements', label: 'Remboursements', icon: 'receipt', module: 'divorce' },
  { href: '/tax-status', label: 'Tax Status', icon: 'fileText', module: 'divorce' },
  { href: '/categories', label: 'Categories', icon: 'tag' },
  { href: '/merchants', label: 'Merchants', icon: 'store' },
  { href: '/budgets', label: 'Budgets', icon: 'pie', module: 'budgets' },
  { href: '/simulations', label: 'Simulations', icon: 'flask', module: 'simulations' },
  { href: '/goals', label: 'Goals', icon: 'target', module: 'objectives' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
]

export function SidebarNav({ modules }: { modules: Modules }) {
  const pathname = usePathname()
  const items = NAV.filter((item) => !item.module || modules[item.module])

  return (
    <>
      {items.map((item) => {
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
    </>
  )
}
