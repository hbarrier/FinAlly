'use client'

import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form'
import { COLOR_VARS, CATEGORY_COLORS, CATEGORY_ICONS } from './color-vars'
import { Icon } from './icon'

interface CategoryAppearanceFieldsProps<TForm extends FieldValues> {
  control: Control<TForm>
  colorField: Path<TForm>
  iconField: Path<TForm>
  iconLimit?: number
  iconColumns?: number
}

export function CategoryAppearanceFields<TForm extends FieldValues>({
  control,
  colorField,
  iconField,
  iconLimit,
  iconColumns = 7,
}: CategoryAppearanceFieldsProps<TForm>) {
  const icons = iconLimit ? CATEGORY_ICONS.slice(0, iconLimit) : CATEGORY_ICONS
  return (
    <>
      <div>
        <label className="fern-field-label wide">Color</label>
        <Controller
          control={control}
          name={colorField}
          render={({ field }) => (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {CATEGORY_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => field.onChange(c)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: COLOR_VARS[c].solid,
                    border: `2px solid ${field.value === c ? 'var(--ink)' : 'transparent'}`,
                    boxShadow: field.value === c ? '0 0 0 2px var(--bg-elevated) inset' : 'none',
                    cursor: 'pointer',
                  }}
                  aria-label={c}
                />
              ))}
            </div>
          )}
        />
      </div>

      <div>
        <label className="fern-field-label wide">Icon</label>
        <Controller
          control={control}
          name={iconField}
          render={({ field }) => (
            <div
              style={
                iconLimit
                  ? { display: 'flex', flexWrap: 'wrap', gap: 6 }
                  : { display: 'grid', gridTemplateColumns: `repeat(${iconColumns}, 1fr)`, gap: 6 }
              }
            >
              {icons.map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => field.onChange(i)}
                  style={{
                    ...(iconLimit
                      ? { width: 40, height: 40 }
                      : { aspectRatio: '1 / 1' }),
                    borderRadius: 10,
                    display: 'grid',
                    placeItems: 'center',
                    border: `1px solid ${field.value === i ? 'var(--terracotta)' : 'var(--line)'}`,
                    background: field.value === i ? 'var(--terracotta-bg)' : 'var(--bg-elevated)',
                    color: field.value === i ? 'var(--terracotta-ink)' : 'var(--ink-soft)',
                    cursor: 'pointer',
                  }}
                >
                  <Icon name={i} size={18} />
                </button>
              ))}
            </div>
          )}
        />
      </div>
    </>
  )
}
