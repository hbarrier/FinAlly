import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { createClient } from '@libsql/client'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import * as schema from '@/lib/schema'

export type TestDb = ReturnType<typeof drizzle<typeof schema>>

/**
 * A fresh on-disk SQLite database with all migrations applied. Returns the drizzle
 * instance plus a `cleanup()` to call in `afterAll` / `afterEach`.
 */
export async function makeTestDb(): Promise<{ db: TestDb; cleanup: () => void }> {
  const dir = mkdtempSync(join(tmpdir(), 'fern-test-'))
  const client = createClient({ url: `file:${join(dir, 'test.db')}` })
  const db = drizzle(client, { schema })
  await migrate(db, { migrationsFolder: join(process.cwd(), 'drizzle') })
  return {
    db,
    cleanup: () => {
      client.close()
      rmSync(dir, { recursive: true, force: true })
    },
  }
}
