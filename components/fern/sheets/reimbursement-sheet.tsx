'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
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
  // The expense being reimbursed
  expense: {
    id: string
    amount: number
    date: string
    merchantName?: string | null
  }
  // Applicable rate (0–100), null if no rate configured
  applicableRate: number | null
  // Whether a reimbursement already exists
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
  }, [open])

  const showErr = (field: keyof FormValues) =>
    !!(errors[field] && (dirtyFields[field] || isSubmitted))

  const onSubmit = (data: FormValues) => {
    onSave(data.date, parseDecimal(data.amount))
    onClose()
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" style={{ maxWidth: 420, background: 'var(--bg-elevated)', border: 'none' }}>
        <SheetHeader>
          <SheetTitle style={{ color: 'var(--ink)' }}>
            {existingReimbursement ? 'Remboursement' : 'Enregistrer le remboursement'}
          </SheetTitle>
        </SheetHeader>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Expense summary */}
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

          {/* Reimbursement date */}
          <Field data-invalid={showErr('date')}>
            <FieldLabel style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', display: 'block', marginBottom: 6 }}>
              Date du remboursement
            </FieldLabel>
            <input className="fern-input" type="date" {...register('date')} />
            {showErr('date') && <FieldError>{errors.date?.message}</FieldError>}
          </Field>

          {/* Amount */}
          <Field data-invalid={showErr('amount')}>
            <FieldLabel style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', display: 'block', marginBottom: 6 }}>
              Montant remboursé
            </FieldLabel>
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

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, marginTop: 8, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
            {existingReimbursement && onDelete && (
              <button
                type="button"
                onClick={() => { onDelete(); onClose() }}
                style={{ color: 'var(--rose-ink)', background: 'var(--rose-bg)', border: 'none', borderRadius: 10, padding: '10px 14px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Icon name="trash" size={14} /> Supprimer
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              style={{ flex: 1, background: 'var(--bg-sunken)', border: 'none', borderRadius: 10, padding: '10px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--ink-soft)' }}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSubmit(onSubmit)}
              style={{
                flex: 2,
                background: isValid ? 'var(--teal)' : 'var(--bg-sunken)',
                color: isValid ? 'white' : 'var(--ink-faint)',
                border: 'none',
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 13,
                fontWeight: 600,
                cursor: isValid ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Icon name="check" size={16} /> Enregistrer
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
