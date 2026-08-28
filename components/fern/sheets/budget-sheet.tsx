'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Field, FieldError } from '@/components/ui/field'
import { SheetShell } from '../sheet-shell'
import type { Budget } from '@/lib/db-types'

const budgetSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string(),
})

type BudgetFormValues = z.infer<typeof budgetSchema>

function getDefaultValues(item?: Budget | null): BudgetFormValues {
  return {
    name: item?.name ?? '',
    description: item?.description ?? '',
  }
}

interface BudgetSheetProps {
  open: boolean
  onClose: () => void
  item?: Budget | null
  onSave: (data: { name: string; description: string | null }) => void
}

export function BudgetSheet({ open, onClose, item, onSave }: BudgetSheetProps) {
  const {
    register,
    handleSubmit,
    reset,
    trigger,
    formState: { errors, isValid, dirtyFields, isSubmitted },
  } = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetSchema),
    defaultValues: getDefaultValues(item),
    mode: 'onChange',
  })

  useEffect(() => {
    if (open) {
      reset(getDefaultValues(item))
      trigger()
    }
  }, [open, item, reset, trigger])

  const showErr = (field: keyof BudgetFormValues) =>
    !!(errors[field] && (dirtyFields[field] || isSubmitted))

  const onSubmit = (data: BudgetFormValues) => {
    onSave({
      name: data.name.trim(),
      description: data.description.trim() ? data.description.trim() : null,
    })
    onClose()
  }

  return (
    <SheetShell
      open={open}
      onClose={onClose}
      title={item ? 'Edit budget' : 'New budget'}
      primary={{
        label: item ? 'Save' : 'Create',
        icon: 'check',
        onClick: handleSubmit(onSubmit),
        disabled: !isValid,
      }}
    >
      <Field data-invalid={showErr('name')}>
        <label className="fern-field-label">Name</label>
        <input className="fern-input" placeholder="e.g. 2026 plan, Lean month" autoFocus {...register('name')} />
        {showErr('name') && <FieldError>{errors.name?.message}</FieldError>}
      </Field>

      <Field>
        <label className="fern-field-label">Description (optional)</label>
        <textarea className="fern-input" rows={3} placeholder="What is this budget for?" {...register('description')} />
      </Field>
    </SheetShell>
  )
}
