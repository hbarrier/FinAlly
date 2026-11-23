'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Icon } from '@/components/fern/icon'
import type { ModuleKey, Modules, SavingAccount } from '@/lib/db-types'
import styles from './sidebar-nav.module.css'

type NavItem = { href: string; labelKey: string; icon: string; module?: ModuleKey; label?: string }
type NavSection = { titleKey?: string; items: NavItem[] }

const NAV: NavSection[] = [
  {
    items: [
      { href: '/dashboard', labelKey: 'dashboard', icon: 'home' },
      { href: '/transactions', labelKey: 'transactions', icon: 'list' },
      { href: '/recurring', labelKey: 'recurring', icon: 'repeat', module: 'recurring' },
    ],
  },
  {
    items: [
      { href: '/budgets', labelKey: 'budgets', icon: 'pie', module: 'budgets' },
      { href: '/goals', labelKey: 'goals', icon: 'target', module: 'objectives' },
      { href: '/simulations', labelKey: 'simulations', icon: 'flask', module: 'simulations' },
    ],
  },
  {
    titleKey: 'groups',
    items: [
      { href: '/groups', labelKey: 'groups', icon: 'users', module: 'groups' },
    ],
  },
  {
    titleKey: 'divorce',
    items: [
      { href: '/reimbursements', labelKey: 'reimbursements', icon: 'receipt', module: 'divorce' },
      { href: '/tax-status', labelKey: 'taxStatus', icon: 'fileText', module: 'divorce' },
      { href: '/cost-split', labelKey: 'costSplit', icon: 'users', module: 'divorce' },
    ],
  },
  {
    titleKey: 'admin',
    items: [
      { href: '/accounts', labelKey: 'accounts', icon: 'bank' },
      { href: '/merchants', labelKey: 'merchants', icon: 'store' },
      { href: '/categories', labelKey: 'categories', icon: 'tag' },
      { href: '/languages', labelKey: 'languages', icon: 'globe' },
      { href: '/settings', labelKey: 'settings', icon: 'settings' },
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
  const t = useTranslations('nav')

  const savingItems: NavItem[] = savingAccounts.map((a) => ({
    href: `/savings/${a.id}`,
    labelKey: '',
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
        <div key={section.titleKey ?? i} className={styles.section}>
          {i > 0 && <div className={styles.separator} />}
          {section.titleKey && <div className={styles.groupTitle}>{t(`section.${section.titleKey}`)}</div>}
          {section.items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? `${styles.link} ${styles.active}` : styles.link}
              >
                <Icon name={item.icon} size={16} />
                {item.label ?? t(item.labelKey)}
              </Link>
            )
          })}
        </div>
      ))}
    </>
  )
}
