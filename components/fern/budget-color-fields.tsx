'use client'

import { COLOR_VARS, CATEGORY_COLORS } from './color-vars'
import type { BudgetColorConfig } from '@/lib/db-types'

interface BudgetColorFieldsProps {
  label: string
  value: BudgetColorConfig
  onChange: (v: BudgetColorConfig) => void
}

const STATE_LABELS: { key: keyof BudgetColorConfig['colors']; label: string }[] = [
  { key: 'under', label: 'Under' },
  { key: 'near', label: 'Near' },
  { key: 'atOrOver', label: 'At / over' },
]

export function BudgetColorFields({ label, value, onChange }: BudgetColorFieldsProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{label}</div>

      <div>
        <label className="fern-field-label">Near threshold</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            className="fern-input"
            type="number"
            min={0}
            max={100}
            value={Math.round(value.threshold * 100)}
            onChange={(e) => {
              const pct = Math.min(100, Math.max(0, Number(e.target.value)))
              onChange({ ...value, threshold: pct / 100 })
            }}
            style={{ maxWidth: 90 }}
          />
          <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>%</span>
        </div>
      </div>

      {STATE_LABELS.map(({ key, label: stateLabel }) => (
        <div key={key}>
          <label className="fern-field-label">{stateLabel}</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {CATEGORY_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onChange({ ...value, colors: { ...value.colors, [key]: c } })}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: COLOR_VARS[c].solid,
                  border: `2px solid ${value.colors[key] === c ? 'var(--ink)' : 'transparent'}`,
                  boxShadow: value.colors[key] === c ? '0 0 0 2px var(--bg-elevated) inset' : 'none',
                  cursor: 'pointer',
                }}
                aria-label={c}
              />
            ))}
          </div>
        </div>
      ))}

      <div>
        <label className="fern-field-label">Preview</label>
        <div className="fern-budget-bar" style={{ display: 'flex' }}>
          {STATE_LABELS.map(({ key }) => (
            <div
              key={key}
              className="fern-budget-fill"
              style={{ width: '33.33%', background: COLOR_VARS[value.colors[key]].solid }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
