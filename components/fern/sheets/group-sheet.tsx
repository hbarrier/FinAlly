'use client'

import { z } from 'zod'
import { Field, FieldError } from '@/components/ui/field'
import { SheetShell } from '../sheet-shell'
import { useSheetForm } from '@/hooks/use-sheet-form'
import type { Group } from '@/lib/db-types'

const groupSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string(),
})

type GroupFormValues = z.infer<typeof groupSchema>

function getDefaultValues(item?: Group | null): GroupFormValues {
  return {
    name: item?.name ?? '',
    description: item?.description ?? '',
  }
}

interface GroupSheetProps {
  open: boolean
  onClose: () => void
  item?: Group | null
  onSave: (data: { name: string; description: string | null }) => void
}

export function GroupSheet({ open, onClose, item, onSave }: GroupSheetProps) {
  const {
    register,
    handleSubmit,
    showErr,
    formState: { errors, isValid },
  } = useSheetForm(groupSchema, () => getDefaultValues(item), { open, resetDeps: [item] })

  const onSubmit = (data: GroupFormValues) => {
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
      title={item ? 'Edit group' : 'New group'}
      primary={{
        label: item ? 'Save' : 'Create',
        icon: 'check',
        onClick: handleSubmit(onSubmit),
        disabled: !isValid,
      }}
    >
      <Field data-invalid={showErr('name')}>
        <label className="fern-field-label">Name</label>
        <input
          className="fern-input"
          placeholder="e.g. Divorce, Ski trip, Flatshare"
          autoFocus
          {...register('name')}
        />
        {showErr('name') && <FieldError>{errors.name?.message}</FieldError>}
      </Field>

      <Field>
        <label className="fern-field-label">Description (optional)</label>
        <textarea
          className="fern-input"
          rows={3}
          placeholder="What is this group for?"
          {...register('description')}
        />
      </Field>
    </SheetShell>
  )
}
