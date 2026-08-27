'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ModulePicker } from '@/components/fern/module-picker'
import { CURRENCIES, DEFAULT_CURRENCY } from '@/lib/settings-options'
import { completeOnboarding } from '@/lib/actions/settings'
import { parseDecimal } from '@/lib/utils'
import { alertDialog } from '@/lib/dialogs-store'
import type { Modules } from '@/lib/db-types'

const DEFAULT_MODULES: Modules = {
  recurring: true,
  divorce: false,
  budgets: false,
  simulations: false,
  objectives: false,
}

export function OnboardingClient() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState<string>(DEFAULT_CURRENCY)
  const [balance, setBalance] = useState('')
  const [modules, setModules] = useState<Modules>(DEFAULT_MODULES)

  const canSubmit = name.trim().length > 0 && !pending

  const submit = () => {
    startTransition(async () => {
      try {
        await completeOnboarding({
          name,
          currency,
          startingBalance: balance.trim() ? parseDecimal(balance) : 0,
          modules,
        })
        router.replace('/dashboard')
      } catch (e) {
        void alertDialog(e instanceof Error ? e.message : 'An error occurred')
      }
    })
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: '40px 20px', background: 'var(--bg)' }}>
      <div className="fern-card" style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <div style={{ fontSize: 11, fontFamily: 'var(--mono-fern)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-faint)', marginBottom: 6 }}>
            Welcome
          </div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, lineHeight: 1.1 }}>
            Set up <em style={{ fontFamily: 'var(--serif)', fontStyle: 'italic' }}>FinAlly</em>
          </h1>
        </div>

        <div>
          <label className="fern-field-label">Your name</label>
          <input
            className="fern-input"
            placeholder="e.g. Hermine"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <label className="fern-field-label">Currency</label>
          <select className="fern-input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="fern-field-label">Initial balance</label>
          <input
            className="fern-input"
            placeholder="0"
            inputMode="decimal"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
          />
          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--ink-faint)' }}>
            Your account balance today. You can adjust it later from the dashboard.
          </div>
        </div>

        <div>
          <label className="fern-field-label wide">Modules</label>
          <ModulePicker value={modules} onChange={setModules} />
        </div>

        <button
          type="button"
          className="fern-btn primary"
          onClick={submit}
          disabled={!canSubmit}
          data-disabled={!canSubmit}
        >
          {pending ? 'Setting up…' : 'Get started'}
        </button>
      </div>
    </div>
  )
}
