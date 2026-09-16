import { cache } from 'react'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { translations } from '@/lib/schema'
import enMessages from '@/messages/en'

export type Messages = { [key: string]: string | Messages }

export const DEFAULT_LOCALE = 'en'

/** Repo-side partial catalogs layered between `en` and the DB. */
const REPO_LOCALES: Record<string, () => Promise<{ default: unknown }>> = {
  fr: () => import('@/messages/fr'),
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Overlay `patch` onto `base`, recursing into nested objects. `base` is not mutated. */
function deepMerge(base: Messages, patch: Messages): Messages {
  const out: Messages = { ...base }
  for (const [k, v] of Object.entries(patch)) {
    const prev = out[k]
    out[k] = isObject(v) && isObject(prev) ? deepMerge(prev as Messages, v as Messages) : (v as string | Messages)
  }
  return out
}

/** `{ a: { b: 'x' } }` -> `{ 'a.b': 'x' }`. */
export function flatten(obj: Messages, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (isObject(v)) Object.assign(out, flatten(v as Messages, key))
    else out[key] = v as string
  }
  return out
}

/** `{ 'a.b': 'x' }` -> `{ a: { b: 'x' } }`. */
function unflatten(pairs: { key: string; value: string }[]): Messages {
  const out: Messages = {}
  for (const { key, value } of pairs) {
    const parts = key.split('.')
    let node = out
    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i]
      if (!isObject(node[seg])) node[seg] = {}
      node = node[seg] as Messages
    }
    node[parts[parts.length - 1]] = value
  }
  return out
}

/** The full English key set as flat dotted keys — drives the admin screen. */
export function englishKeys(): Record<string, string> {
  return flatten(enMessages as unknown as Messages)
}

async function dbTranslations(locale: string): Promise<Messages> {
  try {
    const rows = await db
      .select({ key: translations.key, value: translations.value })
      .from(translations)
      .where(eq(translations.languageCode, locale))
    return unflatten(rows)
  } catch {
    // `translations` table not present yet (migration not applied) — ignore.
    return {}
  }
}

/**
 * Build the message catalog for `locale`: English base, then the repo partial
 * (if any), then DB overrides from the admin screen. Missing keys fall through
 * to English.
 */
export const loadMessages = cache(async (locale: string): Promise<Messages> => {
  let messages = enMessages as unknown as Messages
  if (locale === DEFAULT_LOCALE) return messages

  const repo = REPO_LOCALES[locale]
  if (repo) {
    const mod = await repo()
    messages = deepMerge(messages, mod.default as Messages)
  }

  const overrides = await dbTranslations(locale)
  return deepMerge(messages, overrides)
})
