'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Field, FieldError } from '@/components/ui/field'
import { Icon } from '../icon'
import { SegmentedControl } from '../segmented-control'
import { SearchableSelect } from '../searchable-select'
import { fmt, type Category, type Transaction, type Recurring } from '@/lib/derive'
import { promoteToRecurring } from '@/lib/actions/recurring'
import { linkTransactionToRecurring } from '@/lib/actions/transactions'

const CADENCES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  cadence: z.enum(['weekly', 'monthly', 'yearly']),
  dayOfMonth: z.number().min(1).max(28).nullable(),
  dayOfWeek: z.number().min(0).max(6).nullable(),
  categoryId: z.string().nullable(),
})

type CreateFormValues = z.infer<typeof createSchema>

interface RecurringLinkSheetProps {
  open: boolean
  onClose: () => void
  transaction: Transaction
  categories: Category[]
  recurring: Recurring[]
  onDetach?: () => void
}

export function RecurringLinkSheet({
  open,
  onClose,
  transaction,
  categories,
  recurring,
  onDetach,
}: RecurringLinkSheetProps) {
  const [tab, setTab] = useState<'create' | 'attach'>('create')
  const [successName, setSuccessName] = useState<string | null>(null)
  const [linkedCount, setLinkedCount] = useState(0)
  const [attachValue, setAttachValue] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const isLinked = !!transaction.recurringId
  const linkedRecurring = recurring.find((r) => r.id === transaction.recurringId)

  const txnDate = new Date(transaction.date + 'T12:00:00')

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isValid, dirtyFields, isSubmitted },
  } = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: getDefaults(transaction),
    mode: 'onChange',
  })

  useEffect(() => {
    if (open) {
      reset(getDefaults(transaction))
      setSuccessName(null)
      setLinkedCount(0)
      setAttachValue(null)
      setTab('create')
    }
  }, [open, transaction, reset])

  const showErr = (field: keyof CreateFormValues) =>
    !!(errors[field] && (dirtyFields[field] || isSubmitted))

  const watchedCadence = watch('cadence')

  const categoryOptions = useMemo(
    () => categories
      .filter((c) => c.kind === transaction.kind)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => ({ value: c.id, label: c.name })),
    [categories, transaction.kind],
  )

  const recurringOptions = useMemo(
    () => recurring
      .filter((r) => r.kind === transaction.kind)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((r) => ({ value: r.id, label: r.name })),
    [recurring, transaction.kind],
  )

  const onCreateSubmit = (data: CreateFormValues) => {
    startTransition(async () => {
      const result = await promoteToRecurring(transaction.id, {
        name: data.name.trim(),
        amount: Number(transaction.amount),
        kind: transaction.kind,
        categoryId: data.categoryId,
        merchantId: transaction.merchantId ?? null,
        cadence: data.cadence,
        dayOfMonth: data.cadence === 'monthly' ? (data.dayOfMonth ?? txnDate.getDate()) : null,
        dayOfWeek: data.cadence === 'weekly' ? (data.dayOfWeek ?? txnDate.getDay()) : null,
        startDate: transaction.date,
      })
      setSuccessName(data.name.trim())
      setLinkedCount(result.linkedCount)
    })
  }

  const onAttach = () => {
    if (!attachValue) return
    startTransition(async () => {
      await linkTransactionToRecurring(transaction.id, attachValue)
    })
    onClose()
  }

  const handleDetach = () => {
    onDetach?.()
    onClose()
  }

  const kindColor = transaction.kind === 'income' ? 'var(--sage-ink)' : 'var(--rose-ink)'
  const kindBg = transaction.kind === 'income' ? 'var(--sage-bg)' : 'var(--rose-bg)'

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="fern-sheet-content">
        <SheetHeader>
          <SheetTitle className="fern-sheet-title">
            {isLinked ? 'Manage recurring' : 'Make recurring'}
          </SheetTitle>
        </SheetHeader>

        <div className="fern-sheet-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: 'var(--bg-sunken)' }}>
            <span style={{ fontFamily: 'var(--mono-fern)', fontWeight: 700, fontSize: 15, color: kindColor }}>
              {transaction.kind === 'income' ? '+' : '−'}{fmt(Math.abs(Number(transaction.amount)))}
            </span>
            <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>·</span>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{transaction.date}</span>
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 11,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 6,
                background: kindBg,
                color: kindColor,
                textTransform: 'capitalize',
              }}
            >
              {transaction.kind}
            </span>
          </div>

          {isLinked ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--bg-sunken)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon name="repeat" size={16} style={{ color: 'var(--sage-ink)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                    {linkedRecurring?.name ?? 'Recurring'}
                  </div>
                  {linkedRecurring && (
                    <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 2, textTransform: 'capitalize' }}>
                      {linkedRecurring.cadence}
                      {linkedRecurring.cadence === 'monthly' && linkedRecurring.dayOfMonth
                        ? ` · day ${linkedRecurring.dayOfMonth}`
                        : ''}
                    </div>
                  )}
                </div>
              </div>

              <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-soft)' }}>
                This transaction is linked to a recurring entry. You can detach it if it was associated by mistake.
              </p>

              {onDetach && (
                <button
                  type="button"
                  onClick={handleDetach}
                  className="fern-btn danger"
                  style={{ padding: '10px 14px', borderRadius: 10, fontSize: 13 }}
                >
                  <Icon name="x" size={14} /> Detach from recurring
                </button>
              )}
            </div>
          ) : (
            <>
              <SegmentedControl
                value={tab}
                onChange={(v) => setTab(v as 'create' | 'attach')}
                options={[{ value: 'create', label: 'Create new' }, { value: 'attach', label: 'Attach to existing' }]}
              />

              {tab === 'create' && (
                successName !== null ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px 0', textAlign: 'center' }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: '50%',
                      background: 'var(--sage-bg)',
                      display: 'grid', placeItems: 'center',
                    }}>
                      <Icon name="check" size={22} style={{ color: 'var(--sage-ink)' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
                        Linked to &ldquo;{successName}&rdquo;
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                        {linkedCount} transaction{linkedCount !== 1 ? 's' : ''} matched and linked.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={onClose}
                      className="fern-btn sheet-primary primary"
                      style={{ marginTop: 8, flex: 'none', padding: '10px 28px' }}
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <Field data-invalid={showErr('name')}>
                      <label className="fern-field-label">Name</label>
                      <input
                        className="fern-input"
                        placeholder="e.g. Spotify, Rent, Salary"
                        {...register('name')}
                      />
                      {showErr('name') && <FieldError>{errors.name?.message}</FieldError>}
                    </Field>

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
                      <Field>
                        <label className="fern-field-label">Day of month</label>
                        <input
                          className="fern-input"
                          type="number"
                          min="1"
                          max="28"
                          {...register('dayOfMonth', { valueAsNumber: true })}
                        />
                      </Field>
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
                                <button
                                  key={i}
                                  type="button"
                                  className={field.value === i ? 'active' : ''}
                                  onClick={() => field.onChange(i)}
                                >
                                  {d}
                                </button>
                              ))}
                            </div>
                          )}
                        />
                      </div>
                    )}

                    <Controller
                      control={control}
                      name="categoryId"
                      render={({ field }) => (
                        <Field>
                          <label className="fern-field-label">Category</label>
                          <SearchableSelect
                            value={field.value}
                            onChange={field.onChange}
                            options={categoryOptions}
                            placeholder="Choose…"
                            nullable
                            nullLabel="None"
                          />
                        </Field>
                      )}
                    />

                    <div className="fern-sheet-footer" style={{ marginTop: 0 }}>
                      <button type="button" onClick={onClose} className="fern-btn sheet-secondary">Cancel</button>
                      <button
                        type="button"
                        onClick={handleSubmit(onCreateSubmit)}
                        disabled={!isValid}
                        className="fern-btn sheet-primary primary"
                      >
                        <Icon name="check" size={16} /> Create recurring
                      </button>
                    </div>
                  </div>
                )
              )}

              {tab === 'attach' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {recurringOptions.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-faint)', textAlign: 'center', padding: '20px 0' }}>
                      No existing recurring {transaction.kind}s to attach to.
                    </p>
                  ) : (
                    <>
                      <Field>
                        <label className="fern-field-label">Recurring entry</label>
                        <SearchableSelect
                          value={attachValue}
                          onChange={setAttachValue}
                          options={recurringOptions}
                          placeholder="Search recurring…"
                        />
                      </Field>

                      <div className="fern-sheet-footer" style={{ marginTop: 0 }}>
                        <button type="button" onClick={onClose} className="fern-btn sheet-secondary">Cancel</button>
                        <button
                          type="button"
                          onClick={onAttach}
                          disabled={!attachValue}
                          className="fern-btn sheet-primary primary"
                        >
                          <Icon name="repeat" size={14} /> Attach
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function getDefaults(transaction: Transaction): CreateFormValues {
  const d = new Date(transaction.date + 'T12:00:00')
  return {
    name: transaction.note ?? '',
    cadence: 'monthly',
    dayOfMonth: d.getDate(),
    dayOfWeek: d.getDay(),
    categoryId: transaction.categoryId,
  }
}
