import { revalidatePath } from 'next/cache'

/**
 * Revalidate the entire app tree after any write. Keeps server-action bodies
 * free of string literals like `'/', 'layout'` and gives us a single seam to
 * swap the strategy later (e.g. revalidateTag).
 */
export function revalidateApp() {
  revalidatePath('/', 'layout')
}
