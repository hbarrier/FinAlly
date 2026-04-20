'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from '@/components/fern/icon'

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: 'home' },
  { href: '/transactions', label: 'Movements', icon: 'list' },
  { href: '/recurring', label: 'Recurring', icon: 'repeat' },
  { href: '/reimbursements', label: 'Remboursements', icon: 'receipt' },
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
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 12px',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: active ? 600 : 400,
              color: active ? 'var(--terracotta-ink)' : 'var(--ink-soft)',
              background: active ? 'var(--terracotta-bg)' : 'transparent',
              textDecoration: 'none',
              transition: 'all 0.15s',
              marginBottom: 2,
            }}
          >
            <Icon name={item.icon} size={16} />
            {item.label}
          </Link>
        )
      })}
    </>
  )
}
