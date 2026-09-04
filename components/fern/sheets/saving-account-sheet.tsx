'use client'

import { z } from 'zod'
import { Field, FieldError } from '@/components/ui/field'
import { SheetShell } from '../sheet-shell'
import { useSheetForm } from '@/hooks/use-sheet-form'
import { parseDecimal } from '@/lib/utils'
import type { SavingAccount } from '@/lib/db-types'

const savingAccountSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string(),
  startBalance: z.string().refine((v) => !isNaN(parseDecimal(v)), 'Enter a valid amount'),
})

type SavingAccountFormValues = z.infer<typeof savingAccountSchema>

function getDefaultValues(item?: SavingAccount | null): SavingAccountFormValues {
  return {
    name: item?.name ?? '',
    description: item?.description ?? '',
    startBalance: item ? String(item.startBalance) : '0',
  }
}

interface SavingAccountSheetProps {
  open: boolean
  onClose: () => void
  item?: SavingAccount | null
  onSave: (data: { name: string; description: string | null; startBalance: number }) => void
}

export function SavingAccountSheet({ open, onClose, item, onSave }: SavingAccountSheetProps) {
  const {
    register,
    handleSubmit,
    showErr,
    formState: { errors, isValid },
  } = useSheetForm(savingAccountSchema, () => getDefaultValues(item), { open, resetDeps: [item] })

  const onSubmit = (data: SavingAccountFormValues) => {
    onSave({
      name: data.name.trim(),
      description: data.description.trim() || null,
      startBalance: parseDecimal(data.startBalance),
    })
    onClose()
  }

  return (
    <SheetShell
      open={open}
      onClose={onClose}
      title={item ? 'Edit saving account' : 'New saving account'}
      primary={{
        label: item ? 'Save' : 'Create',
        icon: 'check',
        onClick: handleSubmit(onSubmit),
        disabled: !isValid,
      }}
    >
      <Field data-invalid={showErr('name')}>
        <label className="fern-field-label">Name</label>
        <input className="fern-input" placeholder="e.g. Livret A" autoFocus {...register('name')} />
        {showErr('name') && <FieldError>{errors.name?.message}</FieldError>}
      </Field>

      <div>
        <label className="fern-field-label">Description</label>
        <input className="fern-input" placeholder="Optional" {...register('description')} />
      </div>

      <Field data-invalid={showErr('startBalance')}>
        <label className="fern-field-label">Start balance</label>
        <input className="fern-input" inputMode="decimal" placeholder="0,00" {...register('startBalance')} />
        {showErr('startBalance') && <FieldError>{errors.startBalance?.message}</FieldError>}
        {item && (
          <p style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 4 }}>
            Changing this shifts the account&apos;s whole balance history.
          </p>
        )}
      </Field>
    </SheetShell>
  )
}
