'use client'

import { useCallback, useTransition } from 'react'
import { alertDialog } from '@/lib/dialogs-store'

/**
 * Runs a Server Action inside a transition, tracking a `pending` flag and
 * surfacing any thrown error through the app dialog. Replaces the repeated
 * `const [, startTransition] = useTransition()` + `startTransition(runAction(...))`
 * boilerplate, and gives every call site a real pending state to disable buttons.
 */
export function useServerAction() {
  const [pending, startTransition] = useTransition()

  const run = useCallback((fn: () => Promise<unknown>) => {
    startTransition(async () => {
      try {
        await fn()
      } catch (e) {
        await alertDialog(e instanceof Error ? e.message : 'An error occurred')
      }
    })
  }, [])

  return { run, pending }
}
