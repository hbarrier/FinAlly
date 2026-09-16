import type { Metadata } from 'next'
import { getUserSettings, getModules } from '@/lib/queries/user-settings'
import { listLanguages } from '@/lib/queries/languages'
import { SettingsClient } from './settings-client'

export const metadata: Metadata = { title: 'Settings | FinAlly' }

export default async function SettingsPage() {
  const [settings, modules, languages] = await Promise.all([
    getUserSettings(),
    getModules(),
    listLanguages(),
  ])

  return (
    <SettingsClient
      name={settings?.name ?? 'You'}
      currency={settings?.currency ?? 'EUR'}
      locale={settings?.locale ?? 'en'}
      languages={languages}
      modules={modules}
    />
  )
}
