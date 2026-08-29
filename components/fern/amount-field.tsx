'use client'

import type { UseFormRegisterReturn } from 'react-hook-form'
import { Field, FieldError } from '@/components/ui/field'

interface AmountFieldProps {
  register: UseFormRegisterReturn
  invalid: boolean
  error?: string
  autoFocus?: boolean
  label?: string
}

/**
 * The large "€ 0,00" amount input every money sheet uses — the absolute-positioned
 * currency mark plus a decimal-mode text input, wired to a react-hook-form field.
 */
export function AmountField({ register, invalid, error, autoFocus, label }: AmountFieldProps) {
  return (
    <Field data-invalid={invalid}>
      {label && <label className="fern-field-label">{label}</label>}
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', fontSize: 28, color: 'var(--ink-soft)', fontFamily: 'var(--serif)' }}>€</span>
        <input
          className="fern-input big"
          style={{ paddingLeft: 28 }}
          placeholder="0,00"
          inputMode="decimal"
          autoFocus={autoFocus}
          {...register}
        />
      </div>
      {invalid && error && <FieldError>{error}</FieldError>}
    </Field>
  )
}
