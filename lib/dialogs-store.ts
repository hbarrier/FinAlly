/**
 * Framework-free store behind the app dialogs. Kept separate from the React host
 * so server-only modules (lib/utils, lib/seed) can call alertDialog without
 * pulling in client components.
 */

export type DialogState =
  | {
      kind: 'alert'
      title: string
      message: string
      done: () => void
    }
  | {
      kind: 'confirm'
      title: string
      message: string
      confirmLabel: string
      tone: 'primary' | 'danger'
      done: (ok: boolean) => void
    }
  | {
      kind: 'prompt'
      title: string
      message: string
      confirmLabel: string
      defaultValue: string
      done: (value: string | null) => void
    }

let current: DialogState | null = null
const listeners = new Set<() => void>()

const emit = () => listeners.forEach((l) => l())

export const subscribeDialog = (l: () => void) => {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export const getDialogSnapshot = () => current

/** App-styled replacement for window.alert. */
export function alertDialog(message: string, title = 'Something went wrong'): Promise<void> {
  return new Promise((resolve) => {
    current = {
      kind: 'alert',
      title,
      message,
      done: () => {
        current = null
        emit()
        resolve()
      },
    }
    emit()
  })
}

/** App-styled replacement for window.confirm. */
export function confirmDialog(opts: {
  message: string
  title?: string
  confirmLabel?: string
  tone?: 'primary' | 'danger'
}): Promise<boolean> {
  return new Promise((resolve) => {
    current = {
      kind: 'confirm',
      title: opts.title ?? 'Are you sure?',
      message: opts.message,
      confirmLabel: opts.confirmLabel ?? 'Confirm',
      tone: opts.tone ?? 'primary',
      done: (ok) => {
        current = null
        emit()
        resolve(ok)
      },
    }
    emit()
  })
}

/** App-styled replacement for window.prompt. Resolves null on cancel. */
export function promptDialog(opts: {
  message: string
  title?: string
  confirmLabel?: string
  defaultValue?: string
}): Promise<string | null> {
  return new Promise((resolve) => {
    current = {
      kind: 'prompt',
      title: opts.title ?? 'Enter a value',
      message: opts.message,
      confirmLabel: opts.confirmLabel ?? 'OK',
      defaultValue: opts.defaultValue ?? '',
      done: (value) => {
        current = null
        emit()
        resolve(value)
      },
    }
    emit()
  })
}
