import { cache } from 'react'
import { db } from '@/lib/db'

export const getUserSettings = cache(async () => {
  return db.query.userSettings.findFirst()
})

