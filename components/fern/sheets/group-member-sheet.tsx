'use client'

import { z } from 'zod'
import { Field, FieldError } from '@/components/ui/field'
import { SheetShell } from '../sheet-shell'
import { useSheetForm } from '@/hooks/use-sheet-form'
import type { GroupMember } from '@/lib/db-types'

const memberSchema = z.object({ name: z.string().min(1, 'Name is required') })
type MemberFormValues = z.infer<typeof memberSchema>

interface GroupMemberSheetProps {
  open: boolean
  onClose: () => void
  item?: GroupMember | null
  onSave: (name: string) => void
}

export function GroupMemberSheet({ open, onClose, item, onSave }: GroupMemberSheetProps) {
  const {
    register,
    handleSubmit,
    showErr,
    formState: { errors, isValid },
  } = useSheetForm(memberSchema, () => ({ name: item?.name ?? '' }), { open, resetDeps: [item] })

  const onSubmit = (data: MemberFormValues) => {
    onSave(data.name.trim())
    onClose()
  }

  return (
    <SheetShell
      open={open}
      onClose={onClose}
      title={item ? 'Rename member' : 'Add member'}
      compact
      primary={{
        label: item ? 'Save' : 'Add',
        icon: 'check',
        onClick: handleSubmit(onSubmit),
        disabled: !isValid,
      }}
    >
      <Field data-invalid={showErr('name')}>
        <label className="fern-field-label">Name</label>
        <input className="fern-input" placeholder="e.g. John Doe" autoFocus {...register('name')} />
        {showErr('name') && <FieldError>{errors.name?.message}</FieldError>}
      </Field>
    </SheetShell>
  )
}
