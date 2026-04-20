'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
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
import { GoalRing } from '../goal-ring'
import { COLOR_VARS, CATEGORY_COLORS, CATEGORY_ICONS } from '../color-vars'
import type { InferSelectModel } from 'drizzle-orm'
import type { goals } from '@/lib/schema'

type Goal = InferSelectModel<typeof goals>

const parseDecimal = (v: string) => Number(v.replace(',', '.'))

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
    reset,
    trigger,
    watch,
    formState: { errors, isValid, dirtyFields, isSubmitted },
  } = useForm<GoalFormValues>({
    resolver: zodResolver(goalSchema),
    defaultValues: getDefaultValues(item),
    mode: 'onChange',
  })

  useEffect(() => {
    if (open) {
      reset(getDefaultValues(item))
      trigger()
    }
  }, [open])

  const showErr = (field: keyof GoalFormValues) =>
    !!(errors[field] && (dirtyFields[field] || isSubmitted))

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
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" style={{ maxWidth: 460, background: 'var(--bg-elevated)', border: 'none' }}>
        <SheetHeader>
          <SheetTitle style={{ color: 'var(--ink)' }}>{item ? 'Edit goal' : 'New goal'}</SheetTitle>
        </SheetHeader>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Preview ring */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0', position: 'relative' }}>
            <GoalRing pct={pct} color={watchedColor} size={100} />
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
              <Icon name={watchedIcon} size={28} style={{ color: 'var(--ink-soft)' }} />
            </div>
          </div>

          {/* Target */}
          <Field data-invalid={showErr('target')}>
            <FieldLabel style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', display: 'block', marginBottom: 6 }}>Target (€)</FieldLabel>
            <input className="fern-input" placeholder="e.g. 2000" inputMode="decimal" autoFocus {...register('target')} />
            {showErr('target') && <FieldError>{errors.target?.message}</FieldError>}
          </Field>

          {/* Name */}
          <Field data-invalid={showErr('name')}>
            <FieldLabel style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', display: 'block', marginBottom: 6 }}>What are you saving for?</FieldLabel>
            <input className="fern-input" placeholder="e.g. Japan trip, Emergency fund" {...register('name')} />
            {showErr('name') && <FieldError>{errors.name?.message}</FieldError>}
          </Field>

          {/* Saved */}
          <Field data-invalid={showErr('saved')}>
            <FieldLabel style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', display: 'block', marginBottom: 6 }}>Already saved (€)</FieldLabel>
            <input className="fern-input" placeholder="0" inputMode="decimal" {...register('saved')} />
            {showErr('saved') && <FieldError>{errors.saved?.message}</FieldError>}
          </Field>

          {/* Deadline */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', display: 'block', marginBottom: 6 }}>Deadline (optional)</label>
            <input className="fern-input" type="date" {...register('deadline')} />
          </div>

          {/* Color */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', display: 'block', marginBottom: 8 }}>Color</label>
            <Controller
              control={control}
              name="color"
              render={({ field }) => (
                <div style={{ display: 'flex', gap: 8 }}>
                  {CATEGORY_COLORS.map((c) => (
                    <button key={c} type="button" onClick={() => field.onChange(c)} style={{ width: 36, height: 36, borderRadius: 10, background: COLOR_VARS[c].solid, border: `2px solid ${field.value === c ? 'var(--ink)' : 'transparent'}`, cursor: 'pointer' }} aria-label={c} />
                  ))}
                </div>
              )}
            />
          </div>

          {/* Icon */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', display: 'block', marginBottom: 8 }}>Icon</label>
            <Controller
              control={control}
              name="icon"
              render={({ field }) => (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {CATEGORY_ICONS.slice(0, 14).map((i) => (
                    <button key={i} type="button" onClick={() => field.onChange(i)} style={{ width: 40, height: 40, borderRadius: 10, display: 'grid', placeItems: 'center', border: `1px solid ${field.value === i ? 'var(--terracotta)' : 'var(--line)'}`, background: field.value === i ? 'var(--terracotta-bg)' : 'var(--bg-elevated)', color: field.value === i ? 'var(--terracotta-ink)' : 'var(--ink-soft)', cursor: 'pointer' }}>
                      <Icon name={i} size={18} />
                    </button>
                  ))}
                </div>
              )}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 8, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
            <button type="button" onClick={onClose} style={{ flex: 1, background: 'var(--bg-sunken)', border: 'none', borderRadius: 10, padding: '10px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--ink-soft)' }}>Cancel</button>
            <button type="button" onClick={handleSubmit(onSubmit)} style={{ flex: 2, background: isValid ? 'var(--terracotta)' : 'var(--bg-sunken)', color: isValid ? 'white' : 'var(--ink-faint)', border: 'none', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 600, cursor: isValid ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Icon name="check" size={16} /> {item ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
