import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { sql } from 'drizzle-orm'
import { makeTestDb, type TestDb } from './helpers/db'

const h = vi.hoisted(() => ({ db: null as TestDb | null }))
vi.mock('@/lib/db', () => ({ get db() { return h.db } }))

let cleanup: () => void
beforeAll(async () => {
  const t = await makeTestDb()
  h.db = t.db
  cleanup = t.cleanup
})
afterAll(() => cleanup())

describe('checkPendingMigrations', () => {
  it('is quiet when every migration is applied', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { checkPendingMigrations } = await import('@/lib/migrations-check')
    await checkPendingMigrations()
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('warns when the applied count is behind the journal', async () => {
    await h.db!.run(sql`DELETE FROM __drizzle_migrations WHERE rowid = (SELECT max(rowid) FROM __drizzle_migrations)`)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { checkPendingMigrations } = await import('@/lib/migrations-check')
    await checkPendingMigrations()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('pending database migration'))
    warn.mockRestore()
  })
})
