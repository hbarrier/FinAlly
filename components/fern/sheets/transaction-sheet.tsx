'use client'

import { useMemo } from 'react'
import { Controller } from 'react-hook-form'
import { z } from 'zod'
import { Field, FieldError } from '@/components/ui/field'
import { Icon } from '../icon'
import { CatSwatch } from '../cat-swatch'
import { SearchableSelect } from '../searchable-select'
import { SheetShell } from '../sheet-shell'
import { AmountField } from '../amount-field'
import { useSheetForm } from '@/hooks/use-sheet-form'
import type { Category, Transaction } from '@/lib/derive'
import type { Merchant, SavingAccount } from '@/lib/db-types'
import { PAYMENT_METHODS, paymentMethodLabel, type PaymentMethod, defaultPaymentMethodForKind } from '@/lib/payment-method'
import { parseDecimal } from '@/lib/utils'

const CREDIT = '__credit__'

const transactionSchema = z
  .object({
    kind: z.enum(['expense', 'income', 'saving', 'interest']),
    method: z.enum(PAYMENT_METHODS),
    amount: z.string()
      .min(1, 'Amount is required')
      .refine((v) => !isNaN(parseDecimal(v)) && parseDecimal(v) > 0, 'Enter a valid positive amount'),
    date: z.string().min(1, 'Date is required'),
    categoryId: z.string(),
    merchantId: z.string().nullable(),
    note: z.string(),
    reimbursable: z.boolean(),
    fromAccount: z.string(),
    toAccount: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.kind === 'saving') {
      if (data.fromAccount === data.toAccount) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['toAccount'], message: 'Pick two different accounts' })
      }
    } else if (data.kind === 'interest') {
      // No source, no category — an interest credit only needs an amount, a date and a destination.
    } else if (!data.categoryId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['categoryId'], message: 'Pick a category' })
    }
  })

type TransactionFormValues = z.infer<typeof transactionSchema>

type PrefillValues = {
  date?: string
  amount?: number
  kind?: 'expense' | 'income' | 'saving' | 'interest'
  method?: PaymentMethod
  categoryId?: string | null
  merchantId?: string | null
  note?: string
  sourceSavingAccountId?: string | null
  destSavingAccountId?: string | null
}

function getDefaultValues(item?: Transaction | null, prefill?: PrefillValues | null): TransactionFormValues {
  const kind = item?.kind ?? prefill?.kind ?? 'expense'
  const source = item?.sourceSavingAccountId ?? prefill?.sourceSavingAccountId ?? null
  const dest = item?.destSavingAccountId ?? prefill?.destSavingAccountId ?? null
  return {
    kind,
    method: item?.method ?? prefill?.method ?? defaultPaymentMethodForKind(kind),
    amount: item?.amount ? String(item.amount) : (prefill?.amount ? String(prefill.amount) : ''),
    date: item?.date ?? prefill?.date ?? new Date().toISOString().slice(0, 10),
    categoryId: item?.categoryId ?? prefill?.categoryId ?? '',
    merchantId: item?.merchantId ?? prefill?.merchantId ?? null,
    note: item?.note ?? prefill?.note ?? '',
    reimbursable: item?.reimbursable === 1,
    fromAccount: source ?? CREDIT,
    toAccount: kind === 'saving' || kind === 'interest' ? (dest ?? CREDIT) : CREDIT,
  }
}

export type TransactionSheetSave = {
  date: string
  amount: number
  kind: 'expense' | 'income' | 'saving' | 'interest'
  method: PaymentMethod
  categoryId: string | null
  merchantId: string | null
  note: string | null
  reimbursable: number
  sourceSavingAccountId: string | null
  destSavingAccountId: string | null
}

interface TransactionSheetProps {
  open: boolean
  onClose: () => void
  categories: Category[]
  merchants: Merchant[]
  savingAccounts?: SavingAccount[]
  item?: Transaction | null
  showReimbursable?: boolean
  prefill?: (PrefillValues & { method?: PaymentMethod }) | null
  /** Hide the expense/income/saving toggle (e.g. the saving-account view only logs transfers). */
  lockKind?: boolean
  onSave: (data: TransactionSheetSave) => void
  onDelete?: () => void
}

export function TransactionSheet({
  open,
  onClose,
  categories,
  merchants,
  savingAccounts = [],
  item,
  showReimbursable = false,
  prefill,
  lockKind = false,
  onSave,
  onDelete,
}: TransactionSheetProps) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    showErr,
    formState: { errors, isValid, isSubmitted },
  } = useSheetForm(transactionSchema, () => getDefaultValues(item, prefill), {
    open,
    resetDeps: [item, prefill],
  })

  const watchedKind = watch('kind')
  const watchedMethod = watch('method')
  const watchedToAccount = watch('toAccount')
  const isSaving = watchedKind === 'saving'
  const isInterest = watchedKind === 'interest'
  const savingLocked = !!item // an existing movement can't switch in/out of the saving kind

  const accountOptions = useMemo(
    () => [
      { value: CREDIT, label: 'Credit account' },
      ...[...savingAccounts]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((a) => ({ value: a.id, label: a.name })),
    ],
    [savingAccounts],
  )

  const filteredCatsSorted = useMemo(() => {
    if (isSaving || isInterest) return []
    return categories
      .filter((c) => c.kind === watchedKind && c.isSavings !== 1 && (c.isActive === 1 || c.id === item?.categoryId))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [categories, watchedKind, item?.categoryId, isSaving, isInterest])

  const merchantOptions = useMemo(
    () => [...merchants]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((m) => ({ value: m.id, label: m.name })),
    [merchants],
  )

  const onSubmit = (data: TransactionFormValues) => {
    const asId = (v: string) => (v === CREDIT ? null : v)
    const isTransfer = data.kind === 'saving' || data.kind === 'interest'
    onSave({
      date: data.date,
      amount: parseDecimal(data.amount),
      kind: data.kind,
      method: isTransfer ? 'transfer' : data.method,
      categoryId: isTransfer ? null : data.categoryId,
      merchantId: isTransfer ? null : data.merchantId,
      note: data.note.trim() || null,
      reimbursable: showReimbursable && data.kind === 'expense' && data.reimbursable ? 1 : 0,
      sourceSavingAccountId: data.kind === 'saving' ? asId(data.fromAccount) : null,
      destSavingAccountId: isTransfer ? asId(data.toAccount) : null,
    })
    onClose()
  }

  const deleteAction = item && onDelete ? (
    <button
      type="button"
      onClick={() => { onDelete(); onClose() }}
      className="fern-btn sheet-delete"
    >
      <Icon name="trash" size={14} /> Delete
    </button>
  ) : undefined

  const switchKind = (next: 'expense' | 'income') => {
    const currentMethod = getValues('method')
    if (currentMethod === defaultPaymentMethodForKind(next === 'expense' ? 'income' : 'expense')) {
      setValue('method', defaultPaymentMethodForKind(next), { shouldValidate: true, shouldDirty: true })
    }
    const current = getValues('categoryId')
    const stillValid = categories.find((c) => c.kind === next && c.id === current)
    if (!stillValid) setValue('categoryId', '', { shouldValidate: true, shouldDirty: true })
  }

  return (
    <SheetShell
      open={open}
      onClose={onClose}
      title={isInterest ? (item ? 'Edit interest' : 'Add interest') : (item ? 'Edit transaction' : 'Log something')}
      primary={{
        label: item ? 'Save' : 'Log it',
        icon: 'check',
        onClick: handleSubmit(onSubmit),
        disabled: !isValid,
      }}
      secondaryAction={deleteAction}
    >
      {!lockKind && !isInterest && (
      <Controller
        control={control}
        name="kind"
        render={({ field }) => (
          <div className="fern-type-toggle" style={{ marginBottom: 0 }}>
            <button
              type="button"
              className={field.value === 'expense' ? 'active expense' : ''}
              disabled={savingLocked && item?.kind === 'saving'}
              onClick={() => { field.onChange('expense'); switchKind('expense') }}
            >
              <Icon name="arrowDown" size={14} /> Expense
            </button>
            <button
              type="button"
              className={field.value === 'income' ? 'active income' : ''}
              disabled={savingLocked && item?.kind === 'saving'}
              onClick={() => { field.onChange('income'); switchKind('income') }}
            >
              <Icon name="arrowUp" size={14} /> Income
            </button>
            <button
              type="button"
              className={field.value === 'saving' ? 'active' : ''}
              disabled={savingLocked && item?.kind !== 'saving'}
              onClick={() => field.onChange('saving')}
            >
              <Icon name="bank" size={14} /> Saving
            </button>
          </div>
        )}
      />
      )}

      {isInterest && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)' }}>
          <Icon name="sparkle" size={14} /> Interest
        </div>
      )}

      {isInterest ? (
        <>
          <AmountField register={register('amount')} invalid={showErr('amount')} error={errors.amount?.message} autoFocus />

          <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: 0 }}>
            Into {accountOptions.find((o) => o.value === watchedToAccount)?.label ?? 'this account'} · has no source, adds straight to the balance.
          </p>

          <Field data-invalid={showErr('date')}>
            <label className="fern-field-label">Date</label>
            <input className="fern-input" type="date" {...register('date')} />
            {showErr('date') && <FieldError>{errors.date?.message}</FieldError>}
          </Field>

          <div>
            <label className="fern-field-label">Note</label>
            <input className="fern-input" placeholder="e.g. Q1 interest" {...register('note')} />
          </div>
        </>
      ) : isSaving ? (
        <>
          <AmountField register={register('amount')} invalid={showErr('amount')} error={errors.amount?.message} autoFocus />

          <Field>
            <label className="fern-field-label">From</label>
            <Controller
              control={control}
              name="fromAccount"
              render={({ field }) => (
                <select className="fern-input" value={field.value} onChange={(e) => field.onChange(e.target.value)}>
                  {accountOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              )}
            />
          </Field>

          <Field data-invalid={showErr('toAccount')}>
            <label className="fern-field-label">To</label>
            <Controller
              control={control}
              name="toAccount"
              render={({ field }) => (
                <select className="fern-input" value={field.value} onChange={(e) => field.onChange(e.target.value)}>
                  {accountOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              )}
            />
            {showErr('toAccount') && <FieldError>{errors.toAccount?.message}</FieldError>}
          </Field>

          <Field data-invalid={showErr('date')}>
            <label className="fern-field-label">Date</label>
            <input className="fern-input" type="date" {...register('date')} />
            {showErr('date') && <FieldError>{errors.date?.message}</FieldError>}
          </Field>

          <div>
            <label className="fern-field-label">Note</label>
            <input className="fern-input" placeholder="What was this for?" {...register('note')} />
          </div>
        </>
      ) : (
        <>
          <Field>
            <label className="fern-field-label">How</label>
            <Controller
              control={control}
              name="method"
              render={({ field }) => {
                const locked = !!item?.recurringId
                return (
                  <select
                    className="fern-input"
                    value={field.value}
                    disabled={locked}
                    onChange={(e) => field.onChange(e.target.value as PaymentMethod)}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {paymentMethodLabel(m)}
                      </option>
                    ))}
                  </select>
                )
              }}
            />
            {item?.recurringId && (
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--ink-faint)' }}>
                Controlled by recurring.
              </div>
            )}
            {watchedKind === 'expense' && watchedMethod === 'cash' && (
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--ink-faint)' }}>
                Cash expenses are automatically marked as cleared.
              </div>
            )}
          </Field>

          <AmountField register={register('amount')} invalid={showErr('amount')} error={errors.amount?.message} autoFocus />

          {merchants.length > 0 && (
            <div>
              <label className="fern-field-label">Merchant</label>
              <Controller
                control={control}
                name="merchantId"
                render={({ field }) => (
                  <SearchableSelect
                    value={field.value}
                    onChange={(mId) => {
                      field.onChange(mId)
                      if (mId) {
                        const m = merchants.find((x) => x.id === mId)
                        if (m?.categoryId) {
                          const catBelongsToKind = categories.some(
                            (c) => c.id === m.categoryId && c.kind === watchedKind
                          )
                          if (catBelongsToKind) {
                            setValue('categoryId', m.categoryId, { shouldValidate: true, shouldDirty: true })
                          }
                        }
                      }
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

          <Controller
            control={control}
            name="categoryId"
            render={({ field, fieldState }) => {
              const showCatErr = !!(fieldState.error && (fieldState.isDirty || isSubmitted))
              return (
                <Field data-invalid={showCatErr}>
                  <label className="fern-field-label wide">Category</label>
                  {filteredCatsSorted.length === 0 ? (
                    <p style={{ fontSize: 13, color: 'var(--ink-faint)', padding: '12px', background: 'var(--bg-sunken)', borderRadius: 10 }}>
                      No {watchedKind} categories — add one in Categories.
                    </p>
                  ) : (
                    <div className="fern-cat-grid">
                      {filteredCatsSorted.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className={`fern-cat-tile ${field.value === c.id ? 'selected' : ''}`}
                            onClick={() => field.onChange(c.id)}
                          >
                            <CatSwatch color={c.color} icon={c.icon} size={28} />
                            <div style={{ fontSize: 11, lineHeight: 1.3 }}>{c.name}</div>
                          </button>
                        ))}
                    </div>
                  )}
                  {showCatErr && <FieldError>{fieldState.error?.message}</FieldError>}
                </Field>
              )
            }}
          />

          <Field data-invalid={showErr('date')}>
            <label className="fern-field-label">Date</label>
            <input className="fern-input" type="date" {...register('date')} />
            {showErr('date') && <FieldError>{errors.date?.message}</FieldError>}
            {watch('date') > new Date().toISOString().slice(0, 10) && (
              <p style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 4 }}>
                A future date logs this as a planned expense.
              </p>
            )}
          </Field>

          <div>
            <label className="fern-field-label">Note</label>
            <input className="fern-input" placeholder="What was this for?" {...register('note')} />
          </div>

          {showReimbursable && watchedKind === 'expense' && (
            <Controller
              control={control}
              name="reimbursable"
              render={({ field }) => (
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 14px', background: field.value ? 'var(--teal-bg)' : 'var(--bg-sunken)', borderRadius: 10, transition: 'background 0.15s' }}>
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: 'var(--teal)', cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: field.value ? 'var(--teal-ink)' : 'var(--ink)' }}>Remboursable</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>À saisir dans la vue Remboursements</div>
                  </div>
                </label>
              )}
            />
          )}
        </>
      )}
    </SheetShell>
  )
}
