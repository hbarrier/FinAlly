import path from 'path'
import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import * as schema from './schema'

/** `DATABASE_URL` (e.g. a Turso URL) or the local `finance.db` file. */
export const databaseUrl =
  process.env.DATABASE_URL ?? `file:${path.join(process.cwd(), 'finance.db')}`

const client = createClient({
  url: databaseUrl,
  authToken: process.env.DATABASE_AUTH_TOKEN,
})
export const db = drizzle(client, { schema })
