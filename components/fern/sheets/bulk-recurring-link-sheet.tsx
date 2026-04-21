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
import { bulkPromoteToRecurring } from '@/lib/actions/recurring'
import { bulkLinkTransactionsToRecurring } from '@/lib/actions/transactions'

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

interface BulkRecurringLinkSheetProps {
  open: boolean
  onClose: () => void
  transactions: Transaction[]
  categories: Category[]
  recurring: Recurring[]
  onDone: () => void
}

export function BulkRecurringLinkSheet({
  open,
  onClose,
  transactions,
  categories,
  recurring,
  onDone,
}: BulkRecurringLinkSheetProps) {
  const [tab, setTab] = useState<'create' | 'attach'>('create')
  const [successName, setSuccessName] = useState<string | null>(null)
  const [linkedCount, setLinkedCount] = useState(0)
  const [attachValue, setAttachValue] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const firstTxn = transactions[0]

  const hasMixed =
    transactions.some((t) => t.kind === 'expense') &&
    transactions.some((t) => t.kind === 'income')

  const dominantKind: 'expense' | 'income' =
    transactions.filter((t) => t.kind === 'expense').length >=
    transactions.filter((t) => t.kind === 'income').length
      ? 'expense'
      : 'income'

  const totalExpenses = transactions
    .filter((t) => t.kind === 'expense')
    .reduce((s, t) => s + Number(t.amount), 0)
  const totalIncome = transactions
    .filter((t) => t.kind === 'income')
    .reduce((s, t) => s + Number(t.amount), 0)

  const earliestDate = useMemo(
    () => [...transactions].sort((a, b) => a.date.localeCompare(b.date))[0]?.date ?? '',
    [transactions],
  )

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isValid, dirtyFields, isSubmitted },
  } = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: firstTxn ? getDefaults(firstTxn) : emptyDefaults(),
    mode: 'onChange',
  })

  useEffect(() => {
    if (open) {
      reset(firstTxn ? getDefaults(firstTxn) : emptyDefaults())
      setSuccessName(null)
      setLinkedCount(0)
      setAttachValue(null)
      setTab('create')
    }
  }, [open, firstTxn, reset])

  const showErr = (field: keyof CreateFormValues) =>
    !!(errors[field] && (dirtyFields[field] || isSubmitted))

  const watchedCadence = watch('cadence')

  const categoryOptions = useMemo(
    () =>
      categories
        .filter((c) => c.kind === dominantKind)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => ({ value: c.id, label: c.name })),
    [categories, dominantKind],
  )

  const recurringOptions = useMemo(
    () =>
      recurring
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((r) => ({
          value: r.id,
          label: r.name,
          group: r.kind === 'expense' ? 'Expenses' : 'Income',
        })),
    [recurring],
  )

  const onCreateSubmit = (data: CreateFormValues) => {
    if (!firstTxn) return
    startTransition(async () => {
      const result = await bulkPromoteToRecurring(
        transactions.map((t) => t.id),
        {
          name: data.name.trim(),
          amount: Number(firstTxn.amount),
          kind: firstTxn.kind,
          categoryId: data.categoryId,
          merchantId: firstTxn.merchantId ?? null,
          cadence: data.cadence,
          dayOfMonth:
            data.cadence === 'monthly'
              ? (data.dayOfMonth ?? new Date(firstTxn.date + 'T12:00:00').getDate())
              : null,
          dayOfWeek:
            data.cadence === 'weekly'
              ? (data.dayOfWeek ?? new Date(firstTxn.date + 'T12:00:00').getDay())
              : null,
          startDate: earliestDate,
        },
      )
      setSuccessName(data.name.trim())
      setLinkedCount(result.linkedCount)
    })
  }

  const onAttach = () => {
    if (!attachValue) return
    startTransition(async () => {
      await bulkLinkTransactionsToRecurring(
        transactions.map((t) => t.id),
        attachValue,
      )
    })
    onClose()
    onDone()
  }

  const handleDone = () => {
    onClose()
    onDone()
  }

  if (!firstTxn) return null

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="fern-sheet-content">
        <SheetHeader>
          <SheetTitle className="fern-sheet-title">Set as recurring</SheetTitle>
        </SheetHeader>

        <div className="fern-sheet-body">
          {/* Summary pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              borderRadius: 10,
              background: 'var(--bg-sunken)',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontFamily: 'var(--mono-fern)', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>
              {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
            </span>
            {!hasMixed && (
              <span
                style={{
                  fontFamily: 'var(--mono-fern)',
                  fontSize: 14,
                  color: dominantKind === 'income' ? 'var(--sage-ink)' : 'var(--rose-ink)',
                }}
              >
                · {dominantKind === 'income' ? '+' : '−'}{fmt(dominantKind === 'income' ? totalIncome : totalExpenses)}
              </span>
            )}
            {hasMixed && (
              <>
                <span style={{ fontFamily: 'var(--mono-fern)', fontSize: 13, color: 'var(--rose-ink)' }}>
                  · −{fmt(totalExpenses)}
                </span>
                <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>·</span>
                <span style={{ fontFamily: 'var(--mono-fern)', fontSize: 13, color: 'var(--sage-ink)' }}>
                  +{fmt(totalIncome)}
                </span>
              </>
            )}
          </div>

          {/* Mixed-kind warning */}
          {hasMixed && (
            <div
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
                padding: '8px 12px',
                borderRadius: 8,
                background: 'var(--butter-bg)',
                border: '1px solid var(--butter)',
                fontSize: 12,
                color: 'var(--butter-ink)',
              }}
            >
              <Icon name="triangle-alert" size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                You've selected a mix of expenses and income. They'll all be linked to the same
                recurring entry — confirm this is intentional.
              </span>
            </div>
          )}

          <SegmentedControl
            value={tab}
            onChange={(v) => setTab(v as 'create' | 'attach')}
            options={[
              { value: 'create', label: 'Create new' },
              { value: 'attach', label: 'Attach to existing' },
            ]}
          />

          {tab === 'create' &&
            (successName !== null ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                  padding: '24px 0',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: 'var(--sage-bg)',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <Icon name="check" size={22} style={{ color: 'var(--sage-ink)' }} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
                    Linked to &ldquo;{successName}&rdquo;
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                    {linkedCount} transaction{linkedCount !== 1 ? 's' : ''} linked.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDone}
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
                  <button type="button" onClick={onClose} className="fern-btn sheet-secondary">
                    Cancel
                  </button>
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
            ))}

          {tab === 'attach' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {recurringOptions.length === 0 ? (
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: 'var(--ink-faint)',
                    textAlign: 'center',
                    padding: '20px 0',
                  }}
                >
                  No existing recurring entries to attach to.
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
                    <button type="button" onClick={onClose} className="fern-btn sheet-secondary">
                      Cancel
                    </button>
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

function emptyDefaults(): CreateFormValues {
  return {
    name: '',
    cadence: 'monthly',
    dayOfMonth: null,
    dayOfWeek: null,
    categoryId: null,
  }
}
