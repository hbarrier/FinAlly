import { notFound } from 'next/navigation'
import { getModules } from './queries/user-settings'
import type { ModuleKey } from './db-types'

/** Server-component guard: 404 a route whose module is disabled. */
export async function requireModule(key: ModuleKey) {
  const modules = await getModules()
  if (!modules[key]) notFound()
}
