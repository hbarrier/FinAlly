'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Field, FieldError } from '@/components/ui/field'
import { Icon } from '../icon'
import { SheetShell } from '../sheet-shell'
import { fmt } from '@/lib/derive'

const parseDecimal = (v: string) => Number(v.replace(',', '.'))

const schema = z.object({
  date: z.string().min(1, 'Date requise'),
  amount: z.string()
    .min(1, 'Montant requis')
    .refine((v) => !isNaN(parseDecimal(v)) && parseDecimal(v) > 0, 'Montant invalide'),
})

type FormValues = z.infer<typeof schema>

interface ReimbursementSheetProps {
  open: boolean
  onClose: () => void
  expense: {
    id: string
    amount: number
    date: string
    merchantName?: string | null
  }
  applicableRate: number | null
  existingReimbursement?: {
    date: string
    amount: number
  } | null
  onSave: (date: string, amount: number) => void
  onDelete?: () => void
}

export function ReimbursementSheet({
  open,
  onClose,
  expense,
  applicableRate,
  existingReimbursement,
  onSave,
  onDelete,
}: ReimbursementSheetProps) {
  const expectedAmount =
    applicableRate != null
      ? Math.round((expense.amount * applicableRate) / 100 * 100) / 100
      : null

  const {
    register,
    handleSubmit,
    reset,
    trigger,
    formState: { errors, isValid, dirtyFields, isSubmitted },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: existingReimbursement?.date ?? new Date().toISOString().slice(0, 10),
      amount: existingReimbursement
        ? String(existingReimbursement.amount)
        : expectedAmount != null
        ? String(expectedAmount).replace('.', ',')
        : '',
    },
    mode: 'onChange',
  })

  useEffect(() => {
    if (open) {
      reset({
        date: existingReimbursement?.date ?? new Date().toISOString().slice(0, 10),
        amount: existingReimbursement
          ? String(existingReimbursement.amount)
          : expectedAmount != null
          ? String(expectedAmount).replace('.', ',')
          : '',
      })
      trigger()
    }
  }, [open, existingReimbursement, expectedAmount, reset, trigger])

  const showErr = (field: keyof FormValues) =>
    !!(errors[field] && (dirtyFields[field] || isSubmitted))

  const onSubmit = (data: FormValues) => {
    onSave(data.date, parseDecimal(data.amount))
    onClose()
  }

  const deleteAction = existingReimbursement && onDelete ? (
    <button
      type="button"
      onClick={() => { onDelete(); onClose() }}
      className="fern-btn sheet-delete"
    >
      <Icon name="trash" size={14} /> Supprimer
    </button>
  ) : undefined

  return (
    <SheetShell
      open={open}
      onClose={onClose}
      compact
      title={existingReimbursement ? 'Remboursement' : 'Enregistrer le remboursement'}
      cancelLabel="Annuler"
      primary={{
        label: 'Enregistrer',
        icon: 'check',
        onClick: handleSubmit(onSubmit),
        disabled: !isValid,
        tone: 'teal',
      }}
      secondaryAction={deleteAction}
    >
      <div style={{ background: 'var(--bg-sunken)', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 600 }}>Dépense</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, color: 'var(--ink)' }}>
            {expense.merchantName ?? expense.date}
          </span>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--rose-ink)' }}>
            {fmt(expense.amount)}
          </span>
        </div>
        {applicableRate != null && (
          <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
            Taux : {applicableRate}% → attendu {fmt(expectedAmount!)}
          </div>
        )}
      </div>

      <Field data-invalid={showErr('date')}>
        <label className="fern-field-label">Date du remboursement</label>
        <input className="fern-input" type="date" {...register('date')} />
        {showErr('date') && <FieldError>{errors.date?.message}</FieldError>}
      </Field>

      <Field data-invalid={showErr('amount')}>
        <label className="fern-field-label">Montant remboursé</label>
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
    </SheetShell>
  )
}
