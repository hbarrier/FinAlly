'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { parseDecimal } from '@/lib/utils'
import type { DivorceSplitSettings } from '@/lib/db-types'
import type { SplitSettingsInput } from '@/lib/actions/divorce-split'

/** Inline form for the rent defaults (rent, APL, my %, start month). */
export function CostSplitSettings({
  settings,
  onSave,
}: {
  settings: DivorceSplitSettings
  onSave: (data: SplitSettingsInput) => void
}) {
  const t = useTranslations('costSplit')
  const tc = useTranslations('common')
  const [rent, setRent] = useState(String(settings.rent))
  const [apl, setApl] = useState(String(settings.apl))
  const [myPercent, setMyPercent] = useState(String(settings.myPercent))
  const [startMonth, setStartMonth] = useState(settings.startMonth)

  const data = { rent: parseDecimal(rent), apl: parseDecimal(apl), myPercent: parseDecimal(myPercent), startMonth }
  const valid = data.rent >= 0 && data.apl >= 0 && data.myPercent >= 0 && data.myPercent <= 100 && startMonth.length === 7
  const dirty =
    data.rent !== settings.rent ||
    data.apl !== settings.apl ||
    data.myPercent !== settings.myPercent ||
    startMonth !== settings.startMonth

  const field = (label: string, value: string, set: (v: string) => void, type = 'text') => (
    <div style={{ flex: 1, minWidth: 110 }}>
      <label className="fern-field-label">{label}</label>
      <input className="fern-input" type={type} inputMode={type === 'text' ? 'decimal' : undefined} value={value} onChange={(e) => set(e.target.value)} />
    </div>
  )

  return (
    <div style={{ background: 'var(--bg-elevated)', borderRadius: 14, border: '1px solid var(--line-soft)', padding: '14px 16px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
        {t('settingsHeading')}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {field(t('rent'), rent, setRent)}
        {field(t('apl'), apl, setApl)}
        {field(t('myPercent'), myPercent, setMyPercent)}
        {field(t('startMonth'), startMonth, setStartMonth, 'month')}
        <button type="button" className="fern-btn sheet-primary primary" disabled={!valid || !dirty} onClick={() => onSave(data)}>
          {tc('save')}
        </button>
      </div>
    </div>
  )
}
