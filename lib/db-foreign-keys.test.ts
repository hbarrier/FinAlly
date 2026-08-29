import { describe, it, expect, afterAll } from 'vitest'
import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import { sql } from 'drizzle-orm'
import { rmSync } from 'fs'

/**
 * Locks in that the libsql client leaves `PRAGMA foreign_keys` ON — including
 * inside a `db.transaction()`. Every `onDelete: 'cascade' | 'set null'` in
 * lib/schema.ts depends on this. If a driver bump ever regresses it, the delete
 * actions (deleteRecurring, deleteCategory, mergeMerchants, createBudget, ...)
 * would silently start leaving orphan rows — this test is the tripwire.
 */
const DB_PATH = '_fk_test.db'
const client = createClient({ url: `file:${DB_PATH}` })
const db = drizzle(client)

afterAll(() => {
  client.close()
  rmSync(DB_PATH, { force: true })
  rmSync(`${DB_PATH}-shm`, { force: true })
  rmSync(`${DB_PATH}-wal`, { force: true })
})

describe('libsql foreign keys', () => {
  it('are enabled by default', async () => {
    const { rows } = await db.run(sql`PRAGMA foreign_keys`)
    expect(rows[0].foreign_keys).toBe(1)
  })

  it('stay enabled inside a transaction', async () => {
    await db.transaction(async (tx) => {
      const { rows } = await tx.run(sql`PRAGMA foreign_keys`)
      expect(rows[0].foreign_keys).toBe(1)
    })
  })

  it('cascade a delete through a transaction', async () => {
    await db.run(sql`CREATE TABLE IF NOT EXISTS t_parent (id TEXT PRIMARY KEY)`)
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS t_child (
        id TEXT PRIMARY KEY,
        parent_id TEXT REFERENCES t_parent(id) ON DELETE CASCADE
      )`)
    await db.run(sql`INSERT INTO t_parent (id) VALUES ('p1')`)
    await db.run(sql`INSERT INTO t_child (id, parent_id) VALUES ('c1', 'p1')`)

    await db.transaction(async (tx) => {
      await tx.run(sql`DELETE FROM t_parent WHERE id = 'p1'`)
    })

    const { rows } = await db.run(sql`SELECT count(*) AS n FROM t_child`)
    expect(rows[0].n).toBe(0)
  })
})
