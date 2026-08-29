'use client'

import { useEffect } from 'react'
import {
  useForm,
  type FieldValues,
  type DefaultValues,
  type Resolver,
  type UseFormReturn,
  type Path,
} from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { ZodType } from 'zod'

type SheetForm<T extends FieldValues> = UseFormReturn<T> & {
  /** Show a field's error only once it's dirty or a submit was attempted. */
  showErr: (field: Path<T>) => boolean
}

/**
 * The form scaffold every CRUD sheet repeats: `useForm` with a zod resolver in
 * `onChange` mode, a re-`reset()` + `trigger()` whenever the sheet (re)opens or
 * its subject changes, and the `showErr` helper.
 *
 * `getValues` is called fresh on every reset — pass the same `getDefaultValues(item)`
 * the sheet already has. `resetDeps` are the values that should re-seed the form
 * (usually `[item]`, sometimes also `[prefill]` / `[initialKind]`).
 */
export function useSheetForm<T extends FieldValues>(
  schema: ZodType<T>,
  getValues: () => T,
  { open, resetDeps = [] }: { open: boolean; resetDeps?: readonly unknown[] },
): SheetForm<T> {
  const form = useForm<T>({
    // zodResolver's generic inference doesn't line up with an opaque ZodType<T>;
    // the runtime behaviour is correct.
    resolver: zodResolver(schema as never) as Resolver<T>,
    defaultValues: getValues() as DefaultValues<T>,
    mode: 'onChange',
  })

  const { reset, trigger, formState } = form

  useEffect(() => {
    if (open) {
      reset(getValues())
      trigger()
    }
    // getValues is intentionally a fresh closure each render; resetDeps drives re-seeding.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reset, trigger, ...resetDeps])

  const showErr = (field: Path<T>) => {
    const dirty = formState.dirtyFields as Record<string, unknown>
    return !!(formState.errors[field] && (dirty[field] || formState.isSubmitted))
  }

  return Object.assign(form, { showErr })
}
