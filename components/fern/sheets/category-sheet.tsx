'use client'

import { z } from 'zod'
import { Field, FieldError } from '@/components/ui/field'
import { CatSwatch } from '../cat-swatch'
import { SheetShell } from '../sheet-shell'
import { CategoryAppearanceFields } from '../category-appearance-fields'
import { useSheetForm } from '@/hooks/use-sheet-form'
import type { Category } from '@/lib/derive'

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  color: z.string().min(1),
  icon: z.string().min(1),
})

type CategoryFormValues = z.infer<typeof categorySchema>

function getDefaultValues(item?: Category | null): CategoryFormValues {
  return {
    name: item?.name ?? '',
    color: item?.color ?? 'sage',
    icon: item?.icon ?? 'cat-dots',
  }
}

interface CategorySheetProps {
  open: boolean
  onClose: () => void
  item?: Category | null
  onSave: (data: { name: string; color: string; icon: string }) => void
}

export function CategorySheet({ open, onClose, item, onSave }: CategorySheetProps) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    showErr,
    formState: { errors, isValid },
  } = useSheetForm(categorySchema, () => getDefaultValues(item), { open, resetDeps: [item] })

  const watchedColor = watch('color')
  const watchedIcon = watch('icon')

  const onSubmit = (data: CategoryFormValues) => {
    onSave({ name: data.name.trim(), color: data.color, icon: data.icon })
    onClose()
  }

  return (
    <SheetShell
      open={open}
      onClose={onClose}
      title={item ? 'Edit category' : 'New category'}
      primary={{
        label: item ? 'Save' : 'Create',
        icon: 'check',
        onClick: handleSubmit(onSubmit),
        disabled: !isValid,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
        <CatSwatch color={watchedColor} icon={watchedIcon} size={72} />
      </div>

      <Field data-invalid={showErr('name')}>
        <label className="fern-field-label">Name</label>
        <input className="fern-input" placeholder="e.g. Coffee, Side gig" autoFocus {...register('name')} />
        {showErr('name') && <FieldError>{errors.name?.message}</FieldError>}
      </Field>

      <CategoryAppearanceFields control={control} colorField="color" iconField="icon" />
    </SheetShell>
  )
}
