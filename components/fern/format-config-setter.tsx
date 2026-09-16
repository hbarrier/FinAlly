'use client'

import { useMemo } from 'react'
import { setFormatConfig } from '@/lib/format-config'

/**
 * Applies the user's locale + currency to the `lib/derive` formatting helpers.
 * Runs during render (before descendants) so the first paint is already formatted
 * correctly. Renders nothing.
 */
export function FormatConfigSetter({ locale, currency }: { locale: string; currency: string }) {
  useMemo(() => setFormatConfig({ locale, currency }), [locale, currency])
  return null
}
