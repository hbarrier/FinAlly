'use client'

import { z } from 'zod'
import { Field, FieldError } from '@/components/ui/field'
import { Icon } from '../icon'
import { GoalRing } from '../goal-ring'
import { SheetShell } from '../sheet-shell'
import { CategoryAppearanceFields } from '../category-appearance-fields'
import { useSheetForm } from '@/hooks/use-sheet-form'
import type { Goal } from '@/lib/db-types'
import { parseDecimal } from '@/lib/utils'

const goalSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  target: z.string()
    .min(1, 'Target is required')
    .refine((v) => !isNaN(parseDecimal(v)) && parseDecimal(v) > 0, 'Must be a positive number'),
  saved: z.string()
    .refine((v) => v === '' || (!isNaN(parseDecimal(v)) && parseDecimal(v) >= 0), 'Must be ≥ 0'),
  deadline: z.string(),
  color: z.string().min(1),
  icon: z.string().min(1),
})

type GoalFormValues = z.infer<typeof goalSchema>

function getDefaultValues(item?: Goal | null): GoalFormValues {
  return {
    name: item?.name ?? '',
    target: item?.target ? String(item.target) : '',
    saved: item?.saved ? String(item.saved) : '0',
    deadline: item?.deadline ?? '',
    color: item?.color ?? 'sage',
    icon: item?.icon ?? 'cat-seed',
  }
}

interface GoalSheetProps {
  open: boolean
  onClose: () => void
  item?: Goal | null
  onSave: (data: { name: string; target: number; saved: number; icon: string; color: string; deadline?: string | null }) => void
}

export function GoalSheet({ open, onClose, item, onSave }: GoalSheetProps) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    showErr,
    formState: { errors, isValid },
  } = useSheetForm(goalSchema, () => getDefaultValues(item), { open, resetDeps: [item] })

  const watchedTarget = watch('target')
  const watchedSaved = watch('saved')
  const watchedColor = watch('color')
  const watchedIcon = watch('icon')

  const pct = parseDecimal(watchedTarget) > 0 ? parseDecimal(watchedSaved) / parseDecimal(watchedTarget) : 0

  const onSubmit = (data: GoalFormValues) => {
    onSave({
      name: data.name.trim(),
      target: parseDecimal(data.target),
      saved: data.saved ? parseDecimal(data.saved) : 0,
      icon: data.icon,
      color: data.color,
      deadline: data.deadline || null,
    })
    onClose()
  }

  return (
    <SheetShell
      open={open}
      onClose={onClose}
      title={item ? 'Edit goal' : 'New goal'}
      primary={{
        label: item ? 'Save' : 'Create',
        icon: 'check',
        onClick: handleSubmit(onSubmit),
        disabled: !isValid,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0', position: 'relative' }}>
        <GoalRing pct={pct} color={watchedColor} size={100} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
          <Icon name={watchedIcon} size={28} style={{ color: 'var(--ink-soft)' }} />
        </div>
      </div>

      <Field data-invalid={showErr('target')}>
        <label className="fern-field-label">Target (€)</label>
        <input className="fern-input" placeholder="e.g. 2000" inputMode="decimal" autoFocus {...register('target')} />
        {showErr('target') && <FieldError>{errors.target?.message}</FieldError>}
      </Field>

      <Field data-invalid={showErr('name')}>
        <label className="fern-field-label">What are you saving for?</label>
        <input className="fern-input" placeholder="e.g. Japan trip, Emergency fund" {...register('name')} />
        {showErr('name') && <FieldError>{errors.name?.message}</FieldError>}
      </Field>

      <Field data-invalid={showErr('saved')}>
        <label className="fern-field-label">Already saved (€)</label>
        <input className="fern-input" placeholder="0" inputMode="decimal" {...register('saved')} />
        {showErr('saved') && <FieldError>{errors.saved?.message}</FieldError>}
      </Field>

      <div>
        <label className="fern-field-label">Deadline (optional)</label>
        <input className="fern-input" type="date" {...register('deadline')} />
      </div>

      <CategoryAppearanceFields control={control} colorField="color" iconField="icon" iconLimit={14} />
    </SheetShell>
  )
}
