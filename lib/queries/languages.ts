import { cache } from 'react'
import { db } from '@/lib/db'
import { languages, translations } from '@/lib/schema'
import { asc } from 'drizzle-orm'

/** User-added UI languages, ordered by label. English is implicit and never a row. */
export const listLanguages = cache(async () => {
  return db.select({ code: languages.code, label: languages.label }).from(languages).orderBy(asc(languages.label))
})

/** All translation overrides, grouped by language code: `{ fr: { 'nav.dashboard': '…' } }`. */
export const getTranslationsByLanguage = cache(async (): Promise<Record<string, Record<string, string>>> => {
  const rows = await db
    .select({ languageCode: translations.languageCode, key: translations.key, value: translations.value })
    .from(translations)
  const out: Record<string, Record<string, string>> = {}
  for (const r of rows) {
    ;(out[r.languageCode] ??= {})[r.key] = r.value
  }
  return out
})
