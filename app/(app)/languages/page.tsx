import type { Metadata } from 'next'
import { listLanguages, getTranslationsByLanguage } from '@/lib/queries/languages'
import { englishKeys } from '@/i18n/catalog'
import { LanguagesClient } from './languages-client'

export const metadata: Metadata = { title: 'Languages | FinAlly' }

export default async function LanguagesPage() {
  const [languages, translations] = await Promise.all([listLanguages(), getTranslationsByLanguage()])
  const english = Object.entries(englishKeys())
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => a.key.localeCompare(b.key))

  return <LanguagesClient languages={languages} english={english} translations={translations} />
}
