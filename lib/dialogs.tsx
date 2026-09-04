'use client'

import { useState, useSyncExternalStore } from 'react'
import { Modal } from '@/components/fern/modal'
import { subscribeDialog, getDialogSnapshot, type DialogState } from '@/lib/dialogs-store'

/** Mounted once near the app root; renders whichever dialog is currently open. */
export function DialogsHost() {
  const state = useSyncExternalStore(subscribeDialog, getDialogSnapshot, () => null)
  if (!state) return null
  // Key by kind+title so prompt input state resets between openings.
  return <DialogView key={`${state.kind}:${state.title}`} state={state} />
}

function DialogView({ state }: { state: DialogState }) {
  const [value, setValue] = useState(state.kind === 'prompt' ? state.defaultValue : '')

  if (state.kind === 'alert') {
    return (
      <Modal
        open
        onClose={state.done}
        title={state.title}
        footer={
          <button type="button" className="fern-btn sheet-primary primary" onClick={state.done}>
            OK
          </button>
        }
      >
        <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{state.message}</p>
      </Modal>
    )
  }

  if (state.kind === 'prompt') {
    return (
      <Modal
        open
        onClose={() => state.done(null)}
        title={state.title}
        footer={
          <>
            <button type="button" className="fern-btn sheet-secondary" onClick={() => state.done(null)}>
              Cancel
            </button>
            <button type="button" className="fern-btn sheet-primary primary" onClick={() => state.done(value)}>
              {state.confirmLabel}
            </button>
          </>
        }
      >
        <label className="fern-field-label" htmlFor="fern-prompt-input">
          {state.message}
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
      <Modal open onClose={() => state.done(null)} title={state.title}>
        <p style={{ margin: '0 0 12px', whiteSpace: 'pre-line' }}>{state.message}</p>
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
      title={state.title}
      footer={
        <>
          <button type="button" className="fern-btn sheet-secondary" onClick={() => state.done(false)}>
            Cancel
          </button>
          <button
            type="button"
            className={`fern-btn sheet-primary ${state.tone}`}
            onClick={() => state.done(true)}
          >
            {state.confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{state.message}</p>
    </Modal>
  )
}
