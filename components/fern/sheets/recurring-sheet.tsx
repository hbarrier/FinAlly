'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Field, FieldError } from '@/components/ui/field'
import { Icon } from '../icon'
import { SegmentedControl } from '../segmented-control'
import { SearchableSelect } from '../searchable-select'
import { AmountHistoryChart } from '../amount-history-chart'
import { SheetShell } from '../sheet-shell'
import { fmt, type Category, type Recurring, type RecurringAmount } from '@/lib/derive'
import { addRecurringAmount, deleteRecurringAmount } from '@/lib/actions/recurring'
import type { Merchant } from '@/lib/db-types'
import { PAYMENT_METHODS, paymentMethodLabel, defaultPaymentMethodForKind, type PaymentMethod } from '@/lib/payment-method'
import { parseDecimal } from '@/lib/utils'

const CADENCES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const recurringSchema = z.object({
  kind: z.enum(['expense', 'income']),
  method: z.enum(PAYMENT_METHODS),
  amount: z.string()
    .min(1, 'Amount is required')
    .refine((v) => !isNaN(parseDecimal(v)) && parseDecimal(v) > 0, 'Enter a valid positive amount'),
  name: z.string().min(1, 'Name is required'),
  categoryId: z.string().min(1, 'Pick a category'),
  merchantId: z.string().nullable(),
  cadence: z.enum(['weekly', 'monthly', 'yearly']),
  dayOfMonth: z.number().min(-2).max(31).nullable(),
  monthOfYear: z.number().min(1).max(12).nullable(),
  dayOfWeek: z.number().min(0).max(6).nullable(),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().nullable().optional(),
}).superRefine((data, ctx) => {
  if (data.endDate && data.endDate < data.startDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endDate'],
      message: 'End date must be on or after start date',
    })
  }
})

type RecurringFormValues = z.infer<typeof recurringSchema>

function getDefaultValues(item?: Recurring | null): RecurringFormValues {
  const startDate = item?.startDate ?? new Date().toISOString().slice(0, 10)
  const d = new Date(startDate)
  const cadence = item?.cadence ?? 'monthly'
  const kind = item?.kind ?? 'expense'
  return {
    kind,
    method: item?.method ?? defaultPaymentMethodForKind(kind),
    amount: item?.amount ? String(item.amount) : '',
    name: item?.name ?? '',
    categoryId: item?.categoryId ?? '',
    merchantId: item?.merchantId ?? null,
    cadence,
    dayOfMonth: cadence === 'yearly' ? d.getDate() : (item?.dayOfMonth ?? new Date().getDate()),
    monthOfYear: cadence === 'yearly' ? d.getMonth() + 1 : new Date().getMonth() + 1,
    dayOfWeek: item?.dayOfWeek ?? 1,
    startDate,
    endDate: item?.endDate ?? null,
  }
}

interface RecurringSheetProps {
  open: boolean
  onClose: () => void
  categories: Category[]
  merchants: Merchant[]
  item?: Recurring | null
  amounts?: RecurringAmount[]
  actuals?: { date: string; amount: number }[]
  onSave: (data: {
    name: string
    amount: number
    kind: 'expense' | 'income'
    method: PaymentMethod
    categoryId: string | null
    merchantId: string | null
    cadence: 'weekly' | 'monthly' | 'yearly'
    dayOfMonth: number | null
    dayOfWeek: number | null
    startDate: string
    endDate?: string | null
  }) => void
}

export function RecurringSheet({ open, onClose, categories, merchants, item, amounts = [], actuals, onSave }: RecurringSheetProps) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    trigger,
    watch,
    setValue,
    formState: { errors, isValid, dirtyFields, isSubmitted },
  } = useForm<RecurringFormValues>({
    resolver: zodResolver(recurringSchema),
    defaultValues: getDefaultValues(item),
    mode: 'onChange',
  })

  useEffect(() => {
    if (open) {
      reset(getDefaultValues(item))
      trigger()
    }
  }, [open, item, reset, trigger])

  const showErr = (field: keyof RecurringFormValues) =>
    !!(errors[field] && (dirtyFields[field] || isSubmitted))

  const watchedKind = watch('kind')
  const watchedMethod = watch('method')
  const watchedCadence = watch('cadence')

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

  const onSubmit = (data: RecurringFormValues) => {
    let startDate = data.startDate
    if (data.cadence === 'yearly') {
      const year = item?.startDate ? new Date(item.startDate).getFullYear() : new Date().getFullYear()
      const month = String(data.monthOfYear ?? 1).padStart(2, '0')
      const day = String(data.dayOfMonth ?? 1).padStart(2, '0')
      startDate = `${year}-${month}-${day}`
    }
    onSave({
      name: data.name.trim(),
      amount: parseDecimal(data.amount),
      kind: data.kind,
      method: data.method,
      categoryId: data.categoryId,
      merchantId: data.merchantId,
      cadence: data.cadence,
      dayOfMonth: data.cadence === 'monthly' ? Number(data.dayOfMonth) : null,
      dayOfWeek: data.cadence === 'weekly' ? Number(data.dayOfWeek) : null,
      startDate,
      endDate: data.endDate && data.endDate.length ? data.endDate : null,
    })
    onClose()
  }

  const accentColor = watchedKind === 'income' ? 'var(--sage)' : 'var(--rose)'

  return (
    <SheetShell
      open={open}
      onClose={onClose}
      title={item ? 'Edit recurring' : 'New recurring'}
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
                const currentMethod = watch('method')
                if (currentMethod === defaultPaymentMethodForKind('income')) {
                  setValue('method', defaultPaymentMethodForKind('expense'))
                }
                const current = watch('categoryId')
                const stillValid = categories.find((c) => c.kind === 'expense' && c.id === current)
                if (!stillValid) setValue('categoryId', '')
              }}
            >
              <Icon name="arrowDown" size={14} /> Expense
            </button>
            <button
              type="button"
              className={field.value === 'income' ? 'active income' : ''}
              onClick={() => {
                field.onChange('income')
                const currentMethod = watch('method')
                if (currentMethod === defaultPaymentMethodForKind('expense')) {
                  setValue('method', defaultPaymentMethodForKind('income'))
                }
                const current = watch('categoryId')
                const stillValid = categories.find((c) => c.kind === 'income' && c.id === current)
                if (!stillValid) setValue('categoryId', '')
              }}
            >
              <Icon name="arrowUp" size={14} /> Income
            </button>
          </div>
        )}
      />

      <Field>
        <label className="fern-field-label">How</label>
        <Controller
          control={control}
          name="method"
          render={({ field }) => (
            <select
              className="fern-input"
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {paymentMethodLabel(m)}
                </option>
              ))}
            </select>
          )}
        />
        {watchedKind === 'expense' && watchedMethod === 'cash' && (
          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--ink-faint)' }}>
            Cash expenses are automatically marked as cleared.
          </div>
        )}
      </Field>

      <Field data-invalid={showErr('amount')}>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', fontSize: 28, color: 'var(--ink-soft)', fontFamily: 'var(--serif)' }}>€</span>
          <input className="fern-input big" style={{ paddingLeft: 28 }} placeholder="0,00" inputMode="decimal" {...register('amount')} />
        </div>
        {showErr('amount') && <FieldError>{errors.amount?.message}</FieldError>}
      </Field>

      <Field data-invalid={showErr('name')}>
        <label className="fern-field-label">Name</label>
        <input className="fern-input" placeholder="e.g. Spotify, Rent, Salary" {...register('name')} />
        {showErr('name') && <FieldError>{errors.name?.message}</FieldError>}
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
          <label className="fern-field-label">Merchant</label>
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
        <label className="fern-field-label wide">How often</label>
        <Controller
          control={control}
          name="cadence"
          render={({ field }) => (
            <SegmentedControl
              value={field.value}
              onChange={field.onChange}
              options={CADENCES}
            />
          )}
        />
      </div>

      {watchedCadence === 'monthly' && (
        <div>
          <label className="fern-field-label">Day of month</label>
          <Controller
            control={control}
            name="dayOfMonth"
            render={({ field }) => (
              <select
                className="fern-input"
                value={field.value ?? 1}
                onChange={(e) => field.onChange(Number(e.target.value))}
              >
                {Array.from({ length: 28 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}</option>
                ))}
                <option value={-2}>Day before last</option>
                <option value={-1}>Last day</option>
              </select>
            )}
          />
        </div>
      )}

      {watchedCadence === 'yearly' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: '0 0 80px' }}>
            <label className="fern-field-label">Day</label>
            <input className="fern-input" type="number" min="1" max="31" {...register('dayOfMonth', { valueAsNumber: true })} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="fern-field-label">Month</label>
            <Controller
              control={control}
              name="monthOfYear"
              render={({ field }) => (
                <select
                  className="fern-input"
                  value={field.value ?? 1}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                >
                  {MONTHS.map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
                  ))}
                </select>
              )}
            />
          </div>
        </div>
      )}

      {watchedCadence === 'weekly' && (
        <div>
          <label className="fern-field-label wide">Day of week</label>
          <Controller
            control={control}
            name="dayOfWeek"
            render={({ field }) => (
              <div className="fern-segmented">
                {DOW.map((d, i) => (
                  <button key={i} type="button" className={field.value === i ? 'active' : ''} onClick={() => field.onChange(i)}>{d}</button>
                ))}
              </div>
            )}
          />
        </div>
      )}

      {watchedCadence !== 'yearly' && (
        <Field data-invalid={showErr('startDate')}>
          <label className="fern-field-label">Starting from</label>
          <input className="fern-input" type="date" {...register('startDate')} />
          {showErr('startDate') && <FieldError>{errors.startDate?.message}</FieldError>}
        </Field>
      )}

      <Field data-invalid={showErr('endDate')}>
        <label className="fern-field-label">End date (optional)</label>
        <input className="fern-input" type="date" {...register('endDate')} />
        {showErr('endDate') && <FieldError>{errors.endDate?.message}</FieldError>}
      </Field>

      {item && (
        <AmountHistorySection
          recurringId={item.id}
          amounts={amounts}
          actuals={actuals}
          color={accentColor}
        />
      )}
    </SheetShell>
  )
}

function AmountHistorySection({
  recurringId,
  amounts,
  actuals,
  color,
}: {
  recurringId: string
  amounts: RecurringAmount[]
  actuals?: { date: string; amount: number }[]
  color: string
}) {
  const [newAmount, setNewAmount] = useState('')
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10))
  const [, startTransition] = useTransition()

  const sorted = [...amounts].sort((a, b) => a.startDate.localeCompare(b.startDate))

  const handleAdd = () => {
    const parsed = Number(newAmount.replace(',', '.'))
    if (!parsed || parsed <= 0 || !newDate) return
    startTransition(async () => {
      await addRecurringAmount(recurringId, parsed, newDate)
    })
    setNewAmount('')
    setNewDate(new Date().toISOString().slice(0, 10))
  }

  const handleDelete = (entryId: string) => {
    startTransition(async () => {
      await deleteRecurringAmount(entryId, recurringId)
    })
  }

  return (
    <div style={{ borderTop: '1px solid var(--line)', paddingTop: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 10 }}>
        Amount history
      </div>

      {sorted.length >= 1 && (
        <div style={{ marginBottom: 12, borderRadius: 8, overflow: 'hidden', background: 'var(--bg-sunken)', padding: '8px 4px 4px' }}>
          <AmountHistoryChart amounts={sorted} color={color} height={120} actuals={actuals} />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
        {sorted.map((entry) => (
          <div
            key={entry.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 10px',
              borderRadius: 8,
              background: 'var(--bg-sunken)',
              fontSize: 13,
            }}
          >
            <span style={{ color: 'var(--ink-faint)', fontFamily: 'var(--mono-fern, monospace)', fontSize: 12, flex: 1 }}>
              {entry.startDate}
            </span>
            <span style={{ fontWeight: 600, color: 'var(--ink)', fontFamily: 'var(--mono-fern, monospace)' }}>
              {fmt(entry.amount)}
            </span>
            {sorted.length > 1 && (
              <button
                onClick={() => handleDelete(entry.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', display: 'grid', placeItems: 'center', padding: 2 }}
              >
                <Icon name="trash" size={12} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: 'var(--ink-faint)', display: 'block', marginBottom: 4 }}>New amount</label>
          <input
            className="fern-input"
            placeholder="0,00"
            inputMode="decimal"
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
            style={{ fontSize: 13 }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: 'var(--ink-faint)', display: 'block', marginBottom: 4 }}>From</label>
          <input
            className="fern-input"
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            style={{ fontSize: 13 }}
          />
        </div>
        <button
          onClick={handleAdd}
          style={{
            background: 'var(--terracotta)',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            height: 38,
          }}
        >
          Log
        </button>
      </div>
    </div>
  )
}
