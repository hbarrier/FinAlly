'use client'

import { useEffect, useState, useTransition } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Field, FieldLabel, FieldError } from '@/components/ui/field'
import { Icon } from '../icon'
import { SegmentedControl } from '../segmented-control'
import { SearchableSelect } from '../searchable-select'
import { AmountHistoryChart } from '../amount-history-chart'
import { fmt, type Category, type Recurring, type RecurringAmount } from '@/lib/derive'
import { addRecurringAmount, deleteRecurringAmount } from '@/lib/actions/recurring'

const parseDecimal = (v: string) => Number(v.replace(',', '.'))

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
  amount: z.string()
    .min(1, 'Amount is required')
    .refine((v) => !isNaN(parseDecimal(v)) && parseDecimal(v) > 0, 'Enter a valid positive amount'),
  name: z.string().min(1, 'Name is required'),
  categoryId: z.string().min(1, 'Pick a category'),
  cadence: z.enum(['weekly', 'monthly', 'yearly']),
  dayOfMonth: z.number().min(1).max(31).nullable(),
  monthOfYear: z.number().min(1).max(12).nullable(),
  dayOfWeek: z.number().min(0).max(6).nullable(),
  startDate: z.string().min(1, 'Start date is required'),
})

type RecurringFormValues = z.infer<typeof recurringSchema>

function getDefaultValues(item?: Recurring | null): RecurringFormValues {
  const startDate = item?.startDate ?? new Date().toISOString().slice(0, 10)
  const d = new Date(startDate)
  const cadence = (item?.cadence === 'biweekly' ? 'monthly' : item?.cadence) ?? 'monthly'
  return {
    kind: item?.kind ?? 'expense',
    amount: item?.amount ? String(item.amount) : '',
    name: item?.name ?? '',
    categoryId: item?.categoryId ?? '',
    cadence,
    dayOfMonth: cadence === 'yearly' ? d.getDate() : (item?.dayOfMonth ?? new Date().getDate()),
    monthOfYear: cadence === 'yearly' ? d.getMonth() + 1 : new Date().getMonth() + 1,
    dayOfWeek: item?.dayOfWeek ?? 1,
    startDate,
  }
}

interface RecurringSheetProps {
  open: boolean
  onClose: () => void
  categories: Category[]
  item?: Recurring | null
  amounts?: RecurringAmount[]
  onSave: (data: {
    name: string
    amount: number
    kind: 'expense' | 'income'
    categoryId: string | null
    cadence: 'weekly' | 'monthly' | 'yearly'
    dayOfMonth: number | null
    dayOfWeek: number | null
    startDate: string
  }) => void
}

export function RecurringSheet({ open, onClose, categories, item, amounts = [], onSave }: RecurringSheetProps) {
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
  }, [open])

  const showErr = (field: keyof RecurringFormValues) =>
    !!(errors[field] && (dirtyFields[field] || isSubmitted))

  const watchedKind = watch('kind')
  const watchedCadence = watch('cadence')

  const categoryOptions = categories
    .filter((c) => c.kind === watchedKind)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({ value: c.id, label: c.name }))

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
      categoryId: data.categoryId,
      cadence: data.cadence,
      dayOfMonth: data.cadence === 'monthly' ? Number(data.dayOfMonth) : null,
      dayOfWeek: data.cadence === 'weekly' ? Number(data.dayOfWeek) : null,
      startDate,
    })
    onClose()
  }

  const accentColor = watchedKind === 'income' ? 'var(--sage)' : 'var(--rose)'

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" style={{ maxWidth: 460, background: 'var(--bg-elevated)', border: 'none' }}>
        <SheetHeader>
          <SheetTitle style={{ color: 'var(--ink)' }}>
            {item ? 'Edit recurring' : 'New recurring'}
          </SheetTitle>
        </SheetHeader>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Kind toggle */}
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

          {/* Amount */}
          <Field data-invalid={showErr('amount')}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', fontSize: 28, color: 'var(--ink-soft)', fontFamily: 'var(--serif)' }}>€</span>
              <input className="fern-input big" style={{ paddingLeft: 28 }} placeholder="0,00" inputMode="decimal" {...register('amount')} />
            </div>
            {showErr('amount') && <FieldError>{errors.amount?.message}</FieldError>}
          </Field>

          {/* Name */}
          <Field data-invalid={showErr('name')}>
            <FieldLabel style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', display: 'block', marginBottom: 6 }}>Name</FieldLabel>
            <input className="fern-input" placeholder="e.g. Spotify, Rent, Salary" {...register('name')} />
            {showErr('name') && <FieldError>{errors.name?.message}</FieldError>}
          </Field>

          {/* Category */}
          <Controller
            control={control}
            name="categoryId"
            render={({ field, fieldState }) => {
              const showCatErr = !!(fieldState.error && (fieldState.isDirty || isSubmitted))
              return (
                <Field data-invalid={showCatErr}>
                  <FieldLabel style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', display: 'block', marginBottom: 6 }}>Category</FieldLabel>
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

          {/* Cadence */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', display: 'block', marginBottom: 8 }}>How often</label>
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

          {/* Day of month */}
          {watchedCadence === 'monthly' && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', display: 'block', marginBottom: 6 }}>Day of month</label>
              <input className="fern-input" type="number" min="1" max="28" {...register('dayOfMonth', { valueAsNumber: true })} />
            </div>
          )}

          {/* Day + month for yearly */}
          {watchedCadence === 'yearly' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: '0 0 80px' }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', display: 'block', marginBottom: 6 }}>Day</label>
                <input className="fern-input" type="number" min="1" max="31" {...register('dayOfMonth', { valueAsNumber: true })} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', display: 'block', marginBottom: 6 }}>Month</label>
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

          {/* Day of week */}
          {watchedCadence === 'weekly' && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', display: 'block', marginBottom: 8 }}>Day of week</label>
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

          {/* Start date — not shown for yearly (day+month above serve as recurrence anchor) */}
          {watchedCadence !== 'yearly' && (
            <Field data-invalid={showErr('startDate')}>
              <FieldLabel style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', display: 'block', marginBottom: 6 }}>Starting from</FieldLabel>
              <input className="fern-input" type="date" {...register('startDate')} />
              {showErr('startDate') && <FieldError>{errors.startDate?.message}</FieldError>}
            </Field>
          )}

          {/* Amount history — only when editing an existing item */}
          {item && (
            <AmountHistorySection
              recurringId={item.id}
              amounts={amounts}
              color={accentColor}
            />
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 8, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
            <button type="button" onClick={onClose} style={{ flex: 1, background: 'var(--bg-sunken)', border: 'none', borderRadius: 10, padding: '10px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--ink-soft)' }}>Cancel</button>
            <button type="button" onClick={handleSubmit(onSubmit)} style={{ flex: 2, background: isValid ? 'var(--terracotta)' : 'var(--bg-sunken)', color: isValid ? 'white' : 'var(--ink-faint)', border: 'none', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 600, cursor: isValid ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Icon name="check" size={16} /> {item ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function AmountHistorySection({
  recurringId,
  amounts,
  color,
}: {
  recurringId: string
  amounts: RecurringAmount[]
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

      {/* Chart */}
      {sorted.length >= 1 && (
        <div style={{ marginBottom: 12, borderRadius: 8, overflow: 'hidden', background: 'var(--bg-sunken)', padding: '8px 4px 4px' }}>
          <AmountHistoryChart amounts={sorted} color={color} height={120} />
        </div>
      )}

      {/* History list */}
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

      {/* Add new amount */}
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
