'use client'

import { useMemo } from 'react'
import { Controller } from 'react-hook-form'
import { z } from 'zod'
import { Field, FieldError } from '@/components/ui/field'
import { SegmentedControl } from '../segmented-control'
import { SearchableSelect } from '../searchable-select'
import { SheetShell } from '../sheet-shell'
import { AmountField } from '../amount-field'
import { useSheetForm } from '@/hooks/use-sheet-form'
import type { Category } from '@/lib/derive'
import type { Merchant, BudgetLine } from '@/lib/db-types'
import { parseDecimal } from '@/lib/utils'

const FREQUENCIES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

const KINDS = [
  { value: 'adhoc', label: 'Ad-hoc' },
  { value: 'recurring', label: 'Recurring' },
]

const lineSchema = z
  .object({
    amount: z
      .string()
      .min(1, 'Amount is required')
      .refine((v) => !isNaN(parseDecimal(v)) && parseDecimal(v) > 0, 'Enter a valid positive amount'),
    name: z.string(),
    merchantId: z.string().nullable(),
    frequency: z.enum(['monthly', 'yearly']),
    recurring: z.enum(['adhoc', 'recurring']),
  })
  .refine((d) => !!d.merchantId || d.name.trim().length > 0, {
    message: 'Name is required without a merchant',
    path: ['name'],
  })

type LineFormValues = z.infer<typeof lineSchema>

function getDefaultValues(item?: BudgetLine | null): LineFormValues {
  return {
    amount: item?.amount ? String(item.amount) : '',
    name: item?.name ?? '',
    merchantId: item?.merchantId ?? null,
    frequency: item?.frequency ?? 'monthly',
    recurring: item?.recurring ? 'recurring' : 'adhoc',
  }
}

interface BudgetLineSheetProps {
  open: boolean
  onClose: () => void
  category: Category | null
  merchants: Merchant[]
  item?: BudgetLine | null
  onSave: (data: {
    name: string | null
    merchantId: string | null
    amount: number
    frequency: 'monthly' | 'yearly'
    recurring: boolean
  }) => void
}

export function BudgetLineSheet({ open, onClose, category, merchants, item, onSave }: BudgetLineSheetProps) {
  const {
    register,
    control,
    handleSubmit,
    trigger,
    showErr,
    formState: { errors, isValid },
  } = useSheetForm(lineSchema, () => getDefaultValues(item), { open, resetDeps: [item] })

  const merchantOptions = useMemo(
    () => [...merchants].sort((a, b) => a.name.localeCompare(b.name)).map((m) => ({ value: m.id, label: m.name })),
    [merchants],
  )

  const onSubmit = (data: LineFormValues) => {
    onSave({
      name: data.name.trim() ? data.name.trim() : null,
      merchantId: data.merchantId,
      amount: parseDecimal(data.amount),
      frequency: data.frequency,
      recurring: data.recurring === 'recurring',
    })
    onClose()
  }

  return (
    <SheetShell
      open={open}
      onClose={onClose}
      title={item ? 'Edit line' : 'New line'}
      primary={{ label: item ? 'Save' : 'Create', icon: 'check', onClick: handleSubmit(onSubmit), disabled: !isValid }}
    >
      {category && (
        <Field>
          <label className="fern-field-label">Category</label>
          <div className="fern-input" style={{ color: 'var(--ink-soft)', background: 'var(--bg-sunken)' }}>
            {category.name}
          </div>
        </Field>
      )}

      <AmountField register={register('amount')} invalid={showErr('amount')} error={errors.amount?.message} />

      {merchants.length > 0 && (
        <div>
          <label className="fern-field-label">Merchant (optional)</label>
          <Controller
            control={control}
            name="merchantId"
            render={({ field }) => (
              <SearchableSelect
                value={field.value}
                onChange={(mId) => {
                  field.onChange(mId)
                  trigger('name')
                }}
                options={merchantOptions}
                placeholder="No merchant"
                nullable
                nullLabel="No merchant"
              />
            )}
          />
        </div>
      )}

      <Field data-invalid={showErr('name')}>
        <label className="fern-field-label">Name{' '}<span style={{ color: 'var(--ink-faint)' }}>(required without a merchant)</span></label>
        <input className="fern-input" placeholder="e.g. Spotify, Groceries" {...register('name')} />
        {showErr('name') && <FieldError>{errors.name?.message}</FieldError>}
      </Field>

      <div>
        <label className="fern-field-label wide">Frequency</label>
        <Controller
          control={control}
          name="frequency"
          render={({ field }) => (
            <SegmentedControl value={field.value} onChange={field.onChange} options={FREQUENCIES} />
          )}
        />
      </div>

      <div>
        <label className="fern-field-label wide">Type</label>
        <Controller
          control={control}
          name="recurring"
          render={({ field }) => (
            <SegmentedControl value={field.value} onChange={field.onChange} options={KINDS} />
          )}
        />
      </div>
    </SheetShell>
  )
}
