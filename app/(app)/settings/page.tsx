import type { Metadata } from 'next'
import { getUserSettings, getModules } from '@/lib/queries/user-settings'
import { SettingsClient } from './settings-client'

export const metadata: Metadata = { title: 'Settings | FinAlly' }

export default async function SettingsPage() {
  const [settings, modules] = await Promise.all([getUserSettings(), getModules()])

  return (
    <SettingsClient
      name={settings?.name ?? 'You'}
      currency={settings?.currency ?? 'EUR'}
      modules={modules}
    />
  )
}
