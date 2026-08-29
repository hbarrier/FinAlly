import { vi } from 'vitest'

// Server actions call revalidatePath / revalidateTag, which throw outside a
// request context. No-op them for unit/integration tests.
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: (fn: unknown) => fn,
}))
