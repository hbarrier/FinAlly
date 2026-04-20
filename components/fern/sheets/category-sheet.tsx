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
import { CatSwatch } from '../cat-swatch'
import { COLOR_VARS, CATEGORY_COLORS, CATEGORY_ICONS } from '../color-vars'
import type { Category } from '@/lib/derive'

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  kind: z.enum(['expense', 'income']),
  color: z.string().min(1),
  icon: z.string().min(1),
})

type CategoryFormValues = z.infer<typeof categorySchema>

function getDefaultValues(item?: Category | null): CategoryFormValues {
  return {
    name: item?.name ?? '',
    kind: item?.kind ?? 'expense',
    color: item?.color ?? 'sage',
    icon: item?.icon ?? 'cat-dots',
  }
}

interface CategorySheetProps {
  open: boolean
  onClose: () => void
  item?: Category | null
  onSave: (data: { name: string; kind: 'expense' | 'income'; color: string; icon: string }) => void
}

export function CategorySheet({ open, onClose, item, onSave }: CategorySheetProps) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    trigger,
    watch,
    formState: { errors, isValid, dirtyFields, isSubmitted },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: getDefaultValues(item),
    mode: 'onChange',
  })

  useEffect(() => {
    if (open) {
      reset(getDefaultValues(item))
      trigger()
    }
  }, [open])

  const showErr = (field: keyof CategoryFormValues) =>
    !!(errors[field] && (dirtyFields[field] || isSubmitted))

  const watchedColor = watch('color')
  const watchedIcon = watch('icon')

  const onSubmit = (data: CategoryFormValues) => {
    onSave({ name: data.name.trim(), kind: data.kind, color: data.color, icon: data.icon })
    onClose()
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" style={{ maxWidth: 460, background: 'var(--bg-elevated)', border: 'none' }}>
        <SheetHeader>
          <SheetTitle style={{ color: 'var(--ink)' }}>{item ? 'Edit category' : 'New category'}</SheetTitle>
        </SheetHeader>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Preview */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
            <CatSwatch color={watchedColor} icon={watchedIcon} size={72} />
          </div>

          {/* Kind toggle */}
          <Controller
            control={control}
            name="kind"
            render={({ field }) => (
              <div className="fern-type-toggle" style={{ marginBottom: 0 }}>
                <button type="button" className={field.value === 'expense' ? 'active expense' : ''} onClick={() => field.onChange('expense')}>
                  <Icon name="arrowDown" size={14} /> Expense
                </button>
                <button type="button" className={field.value === 'income' ? 'active income' : ''} onClick={() => field.onChange('income')}>
                  <Icon name="arrowUp" size={14} /> Income
                </button>
              </div>
            )}
          />

          {/* Name */}
          <Field data-invalid={showErr('name')}>
            <FieldLabel style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', display: 'block', marginBottom: 6 }}>Name</FieldLabel>
            <input className="fern-input" placeholder="e.g. Coffee, Side gig" autoFocus {...register('name')} />
            {showErr('name') && <FieldError>{errors.name?.message}</FieldError>}
          </Field>

          {/* Color */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', display: 'block', marginBottom: 8 }}>Color</label>
            <Controller
              control={control}
              name="color"
              render={({ field }) => (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {CATEGORY_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => field.onChange(c)}
                      style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: COLOR_VARS[c].solid,
                        border: `2px solid ${field.value === c ? 'var(--ink)' : 'transparent'}`,
                        boxShadow: field.value === c ? '0 0 0 2px var(--bg-elevated) inset' : 'none',
                        cursor: 'pointer',
                      }}
                      aria-label={c}
                    />
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                  {CATEGORY_ICONS.map((i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => field.onChange(i)}
                      style={{
                        aspectRatio: '1 / 1', borderRadius: 10,
                        display: 'grid', placeItems: 'center',
                        border: `1px solid ${field.value === i ? 'var(--terracotta)' : 'var(--line)'}`,
                        background: field.value === i ? 'var(--terracotta-bg)' : 'var(--bg-elevated)',
                        color: field.value === i ? 'var(--terracotta-ink)' : 'var(--ink-soft)',
                        cursor: 'pointer',
                      }}
                    >
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
