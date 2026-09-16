'use client'

import { useTranslations } from 'next-intl'
import { MODULE_KEYS } from '@/lib/settings-options'
import type { Modules } from '@/lib/db-types'

interface ModulePickerProps {
  value: Modules
  onChange: (value: Modules) => void
}

const rowStyle = (active: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
  cursor: 'pointer',
  padding: '12px 14px',
  background: active ? 'var(--teal-bg)' : 'var(--bg-sunken)',
  borderRadius: 10,
  transition: 'background 0.15s',
})

export function ModulePicker({ value, onChange }: ModulePickerProps) {
  const t = useTranslations('modules')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{ ...rowStyle(true), cursor: 'default', opacity: 0.85 }}>
        <input type="checkbox" checked disabled style={{ width: 16, height: 16, marginTop: 2 }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal-ink)' }}>{t('core.label')}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{t('core.description')}</div>
        </div>
      </label>

      {MODULE_KEYS.map((key) => {
        const checked = value[key]
        return (
          <label key={key} style={rowStyle(checked)}>
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
              style={{ width: 16, height: 16, marginTop: 2, accentColor: 'var(--teal)', cursor: 'pointer' }}
            />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: checked ? 'var(--teal-ink)' : 'var(--ink)' }}>
                {t(`${key}.label`)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{t(`${key}.description`)}</div>
            </div>
          </label>
        )
      })}
    </div>
  )
}
