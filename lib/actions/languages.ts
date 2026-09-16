'use server'

import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { revalidateApp } from './_shared'
import { db } from '../db'
import { languages, translations, userSettings } from '../schema'
import { nanoid } from '../utils'
import { parse, zName, zLangCode } from '../schemas'
import { DEFAULT_LOCALE, englishKeys } from '@/i18n/catalog'

/** Add a UI language. English is implicit and cannot be added. */
export async function addLanguage(input: { code: string; label: string }) {
  const data = parse(z.object({ code: zLangCode, label: zName }), input)
  if (data.code === DEFAULT_LOCALE) throw new Error('English is always available.')

  const existing = await db.query.languages.findFirst({ where: eq(languages.code, data.code) })
  if (existing) throw new Error('That language already exists.')

  await db.insert(languages).values({ code: data.code, label: data.label })
  revalidateApp()
}

/** Delete a language and, via cascade, its translation rows. English cannot be deleted. */
export async function deleteLanguage(code: string) {
  const parsed = parse(zLangCode, code)
  if (parsed === DEFAULT_LOCALE) throw new Error('English cannot be deleted.')

  await db.transaction(async (tx) => {
    await tx.delete(languages).where(eq(languages.code, parsed))
    await tx.update(userSettings).set({ locale: DEFAULT_LOCALE }).where(eq(userSettings.locale, parsed))
  })
  revalidateApp()
}

/**
 * Replace the translations for `code`: a non-empty value upserts a row, an empty
 * one removes it (falls back to English). Unknown keys are ignored.
 */
export async function saveTranslations(code: string, entries: { key: string; value: string }[]) {
  const parsed = parse(zLangCode, code)
  if (parsed === DEFAULT_LOCALE) throw new Error('English is the source language and is edited in code.')

  const lang = await db.query.languages.findFirst({ where: eq(languages.code, parsed) })
  if (!lang) throw new Error('Language not found.')

  const known = englishKeys()
  await db.transaction(async (tx) => {
    for (const { key, value } of entries) {
      if (!(key in known)) continue
      const trimmed = value.trim()
      if (trimmed === '') {
        await tx.delete(translations).where(and(eq(translations.languageCode, parsed), eq(translations.key, key)))
      } else {
        await tx
          .insert(translations)
          .values({ id: nanoid(), languageCode: parsed, key, value: trimmed })
          .onConflictDoUpdate({ target: [translations.languageCode, translations.key], set: { value: trimmed } })
      }
    }
  })
  revalidateApp()
}
