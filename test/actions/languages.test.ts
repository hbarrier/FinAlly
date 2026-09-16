import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { makeTestDb, type TestDb } from '../helpers/db'
import { languages, translations } from '@/lib/schema'

const h = vi.hoisted(() => ({ db: null as TestDb | null }))
vi.mock('@/lib/db', () => ({ get db() { return h.db } }))
vi.mock('@/lib/actions/_shared', () => ({ revalidateApp: () => {} }))

let cleanup: () => void
beforeEach(async () => {
  const t = await makeTestDb()
  h.db = t.db
  cleanup = t.cleanup
})
afterEach(() => cleanup())

describe('languages actions', () => {
  it('adds a language, rejects duplicates and English', async () => {
    const { addLanguage } = await import('@/lib/actions/languages')
    await addLanguage({ code: 'de', label: 'Deutsch' })
    expect(await h.db!.select().from(languages)).toHaveLength(1)

    await expect(addLanguage({ code: 'de', label: 'x' })).rejects.toThrow()
    await expect(addLanguage({ code: 'en', label: 'x' })).rejects.toThrow()
  })

  it('saveTranslations upserts non-empty and deletes blank; ignores unknown keys', async () => {
    const { addLanguage, saveTranslations } = await import('@/lib/actions/languages')
    await addLanguage({ code: 'de', label: 'Deutsch' })

    await saveTranslations('de', [
      { key: 'nav.dashboard', value: 'Übersicht' },
      { key: 'not.a.real.key', value: 'nope' },
    ])
    let rows = await h.db!.select().from(translations)
    expect(rows).toEqual([expect.objectContaining({ languageCode: 'de', key: 'nav.dashboard', value: 'Übersicht' })])

    await saveTranslations('de', [{ key: 'nav.dashboard', value: '  ' }])
    rows = await h.db!.select().from(translations)
    expect(rows).toHaveLength(0)
  })

  it('deleteLanguage cascades translation rows; English cannot be deleted', async () => {
    const { addLanguage, saveTranslations, deleteLanguage } = await import('@/lib/actions/languages')
    await addLanguage({ code: 'de', label: 'Deutsch' })
    await saveTranslations('de', [{ key: 'nav.dashboard', value: 'Übersicht' }])

    await expect(deleteLanguage('en')).rejects.toThrow()

    await deleteLanguage('de')
    expect(await h.db!.select().from(languages).where(eq(languages.code, 'de'))).toHaveLength(0)
    expect(await h.db!.select().from(translations)).toHaveLength(0)
  })
})
