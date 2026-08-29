export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { checkPendingMigrations } = await import('./lib/migrations-check')
    await checkPendingMigrations()
    const { seed } = await import('./lib/seed')
    await seed()
  }
}
