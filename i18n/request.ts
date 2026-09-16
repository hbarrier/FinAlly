import { getRequestConfig } from 'next-intl/server'
import { getUserSettings } from '@/lib/queries/user-settings'
import { loadMessages, DEFAULT_LOCALE } from './catalog'

export default getRequestConfig(async () => {
  let locale = DEFAULT_LOCALE
  try {
    const settings = await getUserSettings()
    if (settings?.locale) locale = settings.locale
  } catch {
    // Settings row / column not available yet — use the default.
  }

  return {
    locale,
    messages: await loadMessages(locale),
  }
})
