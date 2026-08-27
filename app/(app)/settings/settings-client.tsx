'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/fern/page-header'
import { ModulePicker } from '@/components/fern/module-picker'
import { CURRENCIES } from '@/lib/settings-options'
import { updateSettings } from '@/lib/actions/settings'
import { alertDialog } from '@/lib/dialogs-store'
import type { Modules } from '@/lib/db-types'

interface SettingsClientProps {
  name: string
  currency: string
  modules: Modules
}

export function SettingsClient({ name: initialName, currency: initialCurrency, modules: initialModules }: SettingsClientProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState(initialName)
  const [currency, setCurrency] = useState(initialCurrency)
  const [modules, setModules] = useState<Modules>(initialModules)

  const dirty =
    name !== initialName ||
    currency !== initialCurrency ||
    (Object.keys(modules) as (keyof Modules)[]).some((k) => modules[k] !== initialModules[k])

  const save = () => {
    startTransition(async () => {
      try {
        await updateSettings({ name, currency, modules })
        router.refresh()
      } catch (e) {
        void alertDialog(e instanceof Error ? e.message : 'An error occurred')
      }
    })
  }

  return (
    <div>
      <PageHeader kicker="Your setup" title={<em>Settings</em>} />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-start' }}>
        <div className="fern-card" style={{ flex: '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label className="fern-field-label">Your name</label>
            <input className="fern-input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <label className="fern-field-label">Currency</label>
            <select className="fern-input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
            Your starting balance for the current month can be adjusted from the dashboard.
          </div>
        </div>

        <div className="fern-card" style={{ flex: '1 1 320px', minWidth: 0 }}>
          <label className="fern-field-label wide">Modules</label>
          <ModulePicker value={modules} onChange={setModules} />
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--ink-faint)' }}>
            Turning a module off only hides its screens — your data stays and returns if you turn it back on.
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          className="fern-btn primary"
          onClick={save}
          disabled={!dirty || name.trim().length === 0 || pending}
          data-disabled={!dirty || name.trim().length === 0 || pending}
        >
          {pending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}
