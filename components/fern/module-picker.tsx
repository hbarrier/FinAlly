'use client'

import { MODULE_META } from '@/lib/settings-options'
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
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{ ...rowStyle(true), cursor: 'default', opacity: 0.85 }}>
        <input type="checkbox" checked disabled style={{ width: 16, height: 16, marginTop: 2 }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal-ink)' }}>Core</div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
            Dashboard, Movements, Categories, Merchants — always on
          </div>
        </div>
      </label>

      {MODULE_META.map((m) => {
        const checked = value[m.key]
        return (
          <label key={m.key} style={rowStyle(checked)}>
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => onChange({ ...value, [m.key]: e.target.checked })}
              style={{ width: 16, height: 16, marginTop: 2, accentColor: 'var(--teal)', cursor: 'pointer' }}
            />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: checked ? 'var(--teal-ink)' : 'var(--ink)' }}>
                {m.label}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{m.description}</div>
            </div>
          </label>
        )
      })}
    </div>
  )
}
