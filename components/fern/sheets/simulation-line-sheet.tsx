'use client'

import { useEffect, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Field, FieldError } from '@/components/ui/field'
import { Icon } from '../icon'
import { SegmentedControl } from '../segmented-control'
import { SearchableSelect } from '../searchable-select'
import { SheetShell } from '../sheet-shell'
import type { Category, Recurring } from '@/lib/derive'
import type { Merchant, SimulationLine } from '@/lib/db-types'
import { parseDecimal } from '@/lib/utils'

const FREQUENCIES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

const SOURCES = [
  { value: 'scratch', label: 'From scratch' },
  { value: 'recurring', label: 'From recurring' },
]

const lineSchema = z.object({
  kind: z.enum(['expense', 'income']),
  source: z.enum(['scratch', 'recurring']),
  recurringId: z.string().nullable(),
  amount: z.string()
    .min(1, 'Amount is required')
    .refine((v) => !isNaN(parseDecimal(v)) && parseDecimal(v) > 0, 'Enter a valid positive amount'),
  name: z.string(),
  categoryId: z.string().min(1, 'Pick a category'),
  merchantId: z.string().nullable(),
  frequency: z.enum(['monthly', 'yearly']),
})

type LineFormValues = z.infer<typeof lineSchema>

function getDefaultValues(item?: SimulationLine | null, initialKind?: 'expense' | 'income'): LineFormValues {
  return {
    kind: item?.kind ?? initialKind ?? 'expense',
    source: 'scratch',
    recurringId: null,
    amount: item?.amount ? String(item.amount) : '',
    name: item?.name ?? '',
    categoryId: item?.categoryId ?? '',
    merchantId: item?.merchantId ?? null,
    frequency: item?.frequency ?? 'monthly',
  }
}

interface SimulationLineSheetProps {
  open: boolean
  onClose: () => void
  categories: Category[]
  merchants: Merchant[]
  recurringOptions: Recurring[]
  recurringEnabled?: boolean
  item?: SimulationLine | null
  initialKind?: 'expense' | 'income'
  onSave: (data: {
    name: string | null
    kind: 'expense' | 'income'
    categoryId: string | null
    merchantId: string | null
    amount: number
    frequency: 'monthly' | 'yearly'
    sourceRecurringId?: string | null
  }) => void
}

export function SimulationLineSheet({
  open,
  onClose,
  categories,
  merchants,
  recurringOptions,
  recurringEnabled = false,
  item,
  initialKind,
  onSave,
}: SimulationLineSheetProps) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    trigger,
    watch,
    setValue,
    formState: { errors, isValid, dirtyFields, isSubmitted },
  } = useForm<LineFormValues>({
    resolver: zodResolver(lineSchema),
    defaultValues: getDefaultValues(item, initialKind),
    mode: 'onChange',
  })

  useEffect(() => {
    if (open) {
      reset(getDefaultValues(item, initialKind))
      trigger()
    }
  }, [open, item, initialKind, reset, trigger])

  const showErr = (field: keyof LineFormValues) =>
    !!(errors[field] && (dirtyFields[field] || isSubmitted))

  const watchedKind = watch('kind')
  const watchedSource = watch('source')

  const categoryOptions = useMemo(
    () => categories
      .filter((c) => c.kind === watchedKind)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => ({ value: c.id, label: c.name })),
    [categories, watchedKind],
  )

  const merchantOptions = useMemo(
    () => [...merchants]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((m) => ({ value: m.id, label: m.name })),
    [merchants],
  )

  const recurringSelectOptions = useMemo(
    () => recurringOptions
      .filter((r) => r.kind === watchedKind && r.cadence !== 'weekly')
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((r) => ({ value: r.id, label: r.name })),
    [recurringOptions, watchedKind],
  )

  const handlePickRecurring = (recurringId: string | null) => {
    setValue('recurringId', recurringId)
    if (!recurringId) return
    const r = recurringOptions.find((x) => x.id === recurringId)
    if (!r) return
    setValue('name', r.name)
    setValue('categoryId', r.categoryId ?? '')
    setValue('merchantId', r.merchantId ?? null)
    setValue('amount', String(r.amount))
    setValue('frequency', r.cadence === 'yearly' ? 'yearly' : 'monthly')
    trigger()
  }

  const onSubmit = (data: LineFormValues) => {
    onSave({
      name: data.name.trim() ? data.name.trim() : null,
      kind: data.kind,
      categoryId: data.categoryId,
      merchantId: data.merchantId,
      amount: parseDecimal(data.amount),
      frequency: data.frequency,
      sourceRecurringId: data.source === 'recurring' ? data.recurringId : null,
    })
    onClose()
  }

  return (
    <SheetShell
      open={open}
      onClose={onClose}
      title={item ? 'Edit line' : 'New line'}
      primary={{
        label: item ? 'Save' : 'Create',
        icon: 'check',
        onClick: handleSubmit(onSubmit),
        disabled: !isValid,
      }}
    >
      <Controller
        control={control}
        name="kind"
        render={({ field }) => (
          <div className="fern-type-toggle" style={{ marginBottom: 0 }}>
            <button
              type="button"
              className={field.value === 'expense' ? 'active expense' : ''}
              onClick={() => {
                field.onChange('expense')
                setValue('categoryId', '')
                setValue('recurringId', null)
              }}
            >
              <Icon name="arrowDown" size={14} /> Expense
            </button>
            <button
              type="button"
              className={field.value === 'income' ? 'active income' : ''}
              onClick={() => {
                field.onChange('income')
                setValue('categoryId', '')
                setValue('recurringId', null)
              }}
            >
              <Icon name="arrowUp" size={14} /> Income
            </button>
          </div>
        )}
      />

      {!item && recurringEnabled && (
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
                  setValue('recurringId', null)
                }}
                options={SOURCES}
              />
            )}
          />
        </div>
      )}

      {!item && recurringEnabled && watchedSource === 'recurring' && (
        <Field>
          <label className="fern-field-label">Pick a recurring item</label>
          <SearchableSelect
            value={watch('recurringId')}
            onChange={handlePickRecurring}
            options={recurringSelectOptions}
            placeholder="Choose…"
          />
        </Field>
      )}

      <Field data-invalid={showErr('amount')}>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', fontSize: 28, color: 'var(--ink-soft)', fontFamily: 'var(--serif)' }}>€</span>
          <input className="fern-input big" style={{ paddingLeft: 28 }} placeholder="0,00" inputMode="decimal" {...register('amount')} />
        </div>
        {showErr('amount') && <FieldError>{errors.amount?.message}</FieldError>}
      </Field>

      <Field>
        <label className="fern-field-label">Name (optional)</label>
        <input className="fern-input" placeholder="e.g. Spotify, Salary" {...register('name')} />
      </Field>

      <Controller
        control={control}
        name="categoryId"
        render={({ field, fieldState }) => {
          const showCatErr = !!(fieldState.error && (fieldState.isDirty || isSubmitted))
          return (
            <Field data-invalid={showCatErr}>
              <label className="fern-field-label">Category</label>
              <SearchableSelect
                value={field.value || null}
                onChange={(v) => field.onChange(v ?? '')}
                options={categoryOptions}
                placeholder="Choose…"
              />
              {showCatErr && <FieldError>{fieldState.error?.message}</FieldError>}
            </Field>
          )
        }}
      />

      {merchants.length > 0 && (
        <div>
          <label className="fern-field-label">Merchant (optional)</label>
          <Controller
            control={control}
            name="merchantId"
            render={({ field }) => (
              <SearchableSelect
                value={field.value}
                onChange={(mId) => field.onChange(mId)}
                options={merchantOptions}
                placeholder="No merchant"
                nullable
                nullLabel="No merchant"
              />
            )}
          />
        </div>
      )}

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
    </SheetShell>
  )
}
