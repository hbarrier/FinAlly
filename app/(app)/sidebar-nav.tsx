'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from '@/components/fern/icon'
import styles from './sidebar-nav.module.css'

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: 'home' },
  { href: '/transactions', label: 'Movements', icon: 'list' },
  { href: '/recurring', label: 'Recurring', icon: 'repeat' },
  { href: '/reimbursements', label: 'Remboursements', icon: 'receipt' },
  { href: '/tax-status', label: 'Tax Status', icon: 'fileText' },
  { href: '/categories', label: 'Categories', icon: 'tag' },
  { href: '/merchants', label: 'Merchants', icon: 'store' },
  { href: '/budgets', label: 'Budgets', icon: 'pie' },
  { href: '/goals', label: 'Goals', icon: 'target' },
] as const

export function SidebarNav() {
  const pathname = usePathname()

  return (
    <>
      {NAV.map((item) => {
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
