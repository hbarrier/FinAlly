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
import { useFrequencyOptions, useBudgetLineTypeOptions } from '../use-enum-options'
import type { Category, Recurring } from '@/lib/derive'
import type { Merchant, BudgetLine } from '@/lib/db-types'
import { parseDecimal } from '@/lib/utils'

const SOURCES = [
  { value: 'scratch', label: 'From scratch' },
  { value: 'recurring', label: 'From recurring' },
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
    source: z.enum(['scratch', 'recurring']),
    sourceRecurringId: z.string().nullable(),
  })
  .refine((d) => !!d.merchantId || d.name.trim().length > 0, {
    message: 'Name is required without a merchant',
    path: ['name'],
  })

type LineFormValues = z.infer<typeof lineSchema>

function getDefaultValues(item?: BudgetLine | null, initialFrequency?: 'monthly' | 'yearly'): LineFormValues {
  return {
    amount: item?.amount ? String(item.amount) : '',
    name: item?.name ?? '',
    merchantId: item?.merchantId ?? null,
    frequency: item?.frequency ?? initialFrequency ?? 'monthly',
    recurring: item?.recurring ? 'recurring' : 'adhoc',
    source: item?.sourceRecurringId ? 'recurring' : 'scratch',
    sourceRecurringId: item?.sourceRecurringId ?? null,
  }
}

interface BudgetLineSheetProps {
  open: boolean
  onClose: () => void
  category: Category | null
  kind: 'expense' | 'income'
  merchants: Merchant[]
  recurringItems: Recurring[]
  recurringEnabled?: boolean
  item?: BudgetLine | null
  initialFrequency?: 'monthly' | 'yearly'
  onSave: (data: {
    name: string | null
    merchantId: string | null
    amount: number
    frequency: 'monthly' | 'yearly'
    recurring: boolean
    sourceRecurringId: string | null
  }) => void
}

export function BudgetLineSheet({
  open,
  onClose,
  category,
  kind,
  merchants,
  recurringItems,
  recurringEnabled = false,
  item,
  initialFrequency,
  onSave,
}: BudgetLineSheetProps) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    trigger,
    showErr,
    formState: { errors, isValid },
  } = useSheetForm(lineSchema, () => getDefaultValues(item, initialFrequency), { open, resetDeps: [item, initialFrequency] })

  const FREQUENCIES = useFrequencyOptions()
  const KINDS = useBudgetLineTypeOptions()

  const watchedSource = watch('source')

  const merchantOptions = useMemo(
    () => [...merchants].sort((a, b) => a.name.localeCompare(b.name)).map((m) => ({ value: m.id, label: m.name })),
    [merchants],
  )

  const recurringSelectOptions = useMemo(
    () => recurringItems
      .filter((r) => r.kind === kind && r.categoryId === category?.id)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((r) => ({ value: r.id, label: r.name })),
    [recurringItems, category, kind],
  )

  // Only reseed the other fields from the picked template when creating a brand-new line —
  // relinking an existing line shouldn't clobber its already-tuned amount/name/merchant.
  const handlePickRecurring = (recurringId: string | null) => {
    setValue('sourceRecurringId', recurringId)
    if (!recurringId || item) return
    const r = recurringItems.find((x) => x.id === recurringId)
    if (!r) return
    setValue('name', r.name)
    setValue('merchantId', r.merchantId ?? null)
    setValue('amount', String(r.amount))
    setValue('frequency', r.cadence === 'yearly' ? 'yearly' : 'monthly')
    setValue('recurring', 'recurring')
    trigger()
  }

  const onSubmit = (data: LineFormValues) => {
    onSave({
      name: data.name.trim() ? data.name.trim() : null,
      merchantId: data.merchantId,
      amount: parseDecimal(data.amount),
      frequency: data.frequency,
      recurring: data.recurring === 'recurring',
      sourceRecurringId: data.source === 'recurring' ? data.sourceRecurringId : null,
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

      {recurringEnabled && recurringSelectOptions.length > 0 && (
        <div>
          <label className="fern-field-label wide">Source</label>
          <Controller
            control={control}
            name="source"
            render={({ field }) => (
              <SegmentedControl
                value={field.value}
                onChange={(v) => {
                  field.onChange(v)
                  setValue('sourceRecurringId', null)
                }}
                options={SOURCES}
              />
            )}
          />
        </div>
      )}

      {recurringEnabled && watchedSource === 'recurring' && (
        <Field>
          <label className="fern-field-label">Pick a recurring item</label>
          <SearchableSelect
            value={watch('sourceRecurringId')}
            onChange={handlePickRecurring}
            options={recurringSelectOptions}
            placeholder="Choose…"
          />
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
