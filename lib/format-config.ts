/**
 * Runtime number/date formatting settings, taken once per client session from
 * `user_settings` (locale + currency) via `<FormatConfigSetter>` in the root layout.
 *
 * Module-level because `fmt` / `formatDate` / `splitCents` in `lib/derive.ts` are
 * sync pure helpers called from ~150 places; threading a config object through all
 * of them buys nothing for a single-user app. Revisit for multi-user.
 */
export type FormatConfig = { locale: string; currency: string }

const DEFAULT: FormatConfig = { locale: 'en', currency: 'EUR' }
let current: FormatConfig = DEFAULT

export function setFormatConfig(next: Partial<FormatConfig>): void {
  current = { ...current, ...next }
}

export function formatConfig(): FormatConfig {
  return current
}

/** The currency symbol for the active locale + currency (e.g. `€`, `$`, `CHF`). */
export function currencySymbol(): string {
  const { locale, currency } = current
  const parts = new Intl.NumberFormat(locale, { style: 'currency', currency }).formatToParts(0)
  return parts.find((p) => p.type === 'currency')?.value ?? currency
}
