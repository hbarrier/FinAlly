'use client'

import { useEffect, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Field, FieldError } from '@/components/ui/field'
import { Icon } from '../icon'
import { CatSwatch } from '../cat-swatch'
import { SearchableSelect } from '../searchable-select'
import { SheetShell } from '../sheet-shell'
import type { Category, Transaction } from '@/lib/derive'
import type { Merchant } from '@/lib/db-types'

const parseDecimal = (v: string) => Number(v.replace(',', '.'))

const transactionSchema = z.object({
  kind: z.enum(['expense', 'income']),
  amount: z.string()
    .min(1, 'Amount is required')
    .refine((v) => !isNaN(parseDecimal(v)) && parseDecimal(v) > 0, 'Enter a valid positive amount'),
  date: z.string().min(1, 'Date is required'),
  categoryId: z.string().min(1, 'Pick a category'),
  merchantId: z.string().nullable(),
  note: z.string(),
  reimbursable: z.boolean(),
})

type TransactionFormValues = z.infer<typeof transactionSchema>

type PrefillValues = {
  date?: string
  amount?: number
  kind?: 'expense' | 'income'
  categoryId?: string | null
  note?: string
}

function getDefaultValues(item?: Transaction | null, prefill?: PrefillValues | null): TransactionFormValues {
  return {
    kind: item?.kind ?? prefill?.kind ?? 'expense',
    amount: item?.amount ? String(item.amount) : (prefill?.amount ? String(prefill.amount) : ''),
    date: item?.date ?? prefill?.date ?? new Date().toISOString().slice(0, 10),
    categoryId: item?.categoryId ?? prefill?.categoryId ?? '',
    merchantId: item?.merchantId ?? null,
    note: item?.note ?? prefill?.note ?? '',
    reimbursable: item?.reimbursable === 1,
  }
}

interface TransactionSheetProps {
  open: boolean
  onClose: () => void
  categories: Category[]
  merchants: Merchant[]
  item?: Transaction | null
  prefill?: PrefillValues | null
  onSave: (data: {
    date: string
    amount: number
    kind: 'expense' | 'income'
    categoryId: string | null
    merchantId: string | null
    note: string | null
    reimbursable: number
  }) => void
  onDelete?: () => void
}

export function TransactionSheet({
  open,
  onClose,
  categories,
  merchants,
  item,
  prefill,
  onSave,
  onDelete,
}: TransactionSheetProps) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    trigger,
    watch,
    setValue,
    formState: { errors, isValid, dirtyFields, isSubmitted },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: getDefaultValues(item, prefill),
    mode: 'onChange',
  })

  useEffect(() => {
    if (open) {
      reset(getDefaultValues(item, prefill))
      trigger()
    }
  }, [open, item, prefill, reset, trigger])

  const showErr = (field: keyof TransactionFormValues) =>
    !!(errors[field] && (dirtyFields[field] || isSubmitted))

  const watchedKind = watch('kind')
  const filteredCats = categories.filter((c) => c.kind === watchedKind)

  const merchantOptions = useMemo(
    () => [...merchants]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((m) => ({ value: m.id, label: m.name })),
    [merchants],
  )

  const onSubmit = (data: TransactionFormValues) => {
    onSave({
      date: data.date,
      amount: parseDecimal(data.amount),
      kind: data.kind,
      categoryId: data.categoryId,
      merchantId: data.merchantId,
      note: data.note.trim() || null,
      reimbursable: data.kind === 'expense' && data.reimbursable ? 1 : 0,
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

  return (
    <SheetShell
      open={open}
      onClose={onClose}
      title={item ? 'Edit transaction' : 'Log something'}
      primary={{
        label: item ? 'Save' : 'Log it',
        icon: 'check',
        onClick: handleSubmit(onSubmit),
        disabled: !isValid,
      }}
      secondaryAction={deleteAction}
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

      <Field data-invalid={showErr('amount')}>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', fontSize: 28, color: 'var(--ink-soft)', fontFamily: 'var(--serif)' }}>€</span>
          <input
            className="fern-input big"
            style={{ paddingLeft: 28 }}
            placeholder="0,00"
            inputMode="decimal"
            autoFocus
            {...register('amount')}
          />
        </div>
        {showErr('amount') && <FieldError>{errors.amount?.message}</FieldError>}
      </Field>

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
                    if (m?.categoryId) setValue('categoryId', m.categoryId)
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
              {filteredCats.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--ink-faint)', padding: '12px', background: 'var(--bg-sunken)', borderRadius: 10 }}>
                  No {watchedKind} categories — add one in Categories.
                </p>
              ) : (
                <div className="fern-cat-grid">
                  {[...filteredCats]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((c) => (
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
      </Field>

      <div>
        <label className="fern-field-label">Note</label>
        <input className="fern-input" placeholder="What was this for?" {...register('note')} />
      </div>

      {watchedKind === 'expense' && (
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
    </SheetShell>
  )
}
