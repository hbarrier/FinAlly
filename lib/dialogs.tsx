'use client'

import { useState, useSyncExternalStore } from 'react'
import { useTranslations } from 'next-intl'
import { Modal } from '@/components/fern/modal'
import { subscribeDialog, getDialogSnapshot, type DialogState } from '@/lib/dialogs-store'

/** Mounted once near the app root; renders whichever dialog is currently open. */
export function DialogsHost() {
  const state = useSyncExternalStore(subscribeDialog, getDialogSnapshot, () => null)
  if (!state) return null
  // Key by kind+title so prompt input state resets between openings.
  return <DialogView key={`${state.kind}:${state.title ?? ''}`} state={state} />
}

const DEFAULT_TITLE_KEY = {
  alert: 'alertTitle',
  confirm: 'confirmTitle',
  prompt: 'promptTitle',
  choose: 'chooseTitle',
} as const

function DialogView({ state }: { state: DialogState }) {
  const t = useTranslations('dialogs')
  const tAll = useTranslations()
  const [value, setValue] = useState(state.kind === 'prompt' ? state.defaultValue : '')
  const title = state.title ?? t(DEFAULT_TITLE_KEY[state.kind])
  // A message may be a plain (already-translated) string or a message key thrown
  // by a Server Action / zod schema — resolve keys here so errors follow the language.
  const message = tAll.has(state.message) ? tAll(state.message) : state.message

  if (state.kind === 'alert') {
    return (
      <Modal
        open
        onClose={state.done}
        title={title}
        footer={
          <button type="button" className="fern-btn sheet-primary primary" onClick={state.done}>
            {t('ok')}
          </button>
        }
      >
        <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{message}</p>
      </Modal>
    )
  }

  if (state.kind === 'prompt') {
    return (
      <Modal
        open
        onClose={() => state.done(null)}
        title={title}
        footer={
          <>
            <button type="button" className="fern-btn sheet-secondary" onClick={() => state.done(null)}>
              {t('cancel')}
            </button>
            <button type="button" className="fern-btn sheet-primary primary" onClick={() => state.done(value)}>
              {state.confirmLabel ?? t('ok')}
            </button>
          </>
        }
      >
        <label className="fern-field-label" htmlFor="fern-prompt-input">
          {message}
        </label>
        <input
          id="fern-prompt-input"
          className="fern-input"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') state.done(value)
          }}
        />
      </Modal>
    )
  }

  if (state.kind === 'choose') {
    return (
      <Modal open onClose={() => state.done(null)} title={title}>
        <p style={{ margin: '0 0 12px', whiteSpace: 'pre-line' }}>{message}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {state.options.map((o) => (
            <button
              key={o.value}
              type="button"
              className="fern-btn sheet-secondary"
              onClick={() => state.done(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      open
      onClose={() => state.done(false)}
      title={title}
      footer={
        <>
          <button type="button" className="fern-btn sheet-secondary" onClick={() => state.done(false)}>
            {t('cancel')}
          </button>
          <button
            type="button"
            className={`fern-btn sheet-primary ${state.tone}`}
            onClick={() => state.done(true)}
          >
            {state.confirmLabel ?? t('confirmLabel')}
          </button>
        </>
      }
    >
      <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{message}</p>
    </Modal>
  )
}
