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
import { SearchableSelect } from '../searchable-select'
import type { Category } from '@/lib/derive'
import type { InferSelectModel } from 'drizzle-orm'
import type { merchants } from '@/lib/schema'

type Merchant = InferSelectModel<typeof merchants>

const merchantSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  comment: z.string(),
  categoryId: z.string().nullable(),
  isActive: z.boolean(),
})

type MerchantFormValues = z.infer<typeof merchantSchema>

function getDefaultValues(item?: Merchant | null): MerchantFormValues {
  return {
    name: item?.name ?? '',
    comment: item?.comment ?? '',
    categoryId: item?.categoryId ?? null,
    isActive: item ? item.isActive === 1 : true,
  }
}

interface MerchantSheetProps {
  open: boolean
  onClose: () => void
  categories: Category[]
  item?: Merchant | null
  onSave: (data: { name: string; comment: string | null; categoryId: string | null; isActive: number }) => void
}

export function MerchantSheet({ open, onClose, categories, item, onSave }: MerchantSheetProps) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    trigger,
    formState: { errors, isValid, dirtyFields, isSubmitted },
  } = useForm<MerchantFormValues>({
    resolver: zodResolver(merchantSchema),
    defaultValues: getDefaultValues(item),
    mode: 'onChange',
  })

  useEffect(() => {
    if (open) {
      reset(getDefaultValues(item))
      trigger()
    }
  }, [open])

  const showErr = (field: keyof MerchantFormValues) =>
    !!(errors[field] && (dirtyFields[field] || isSubmitted))

  const onSubmit = (data: MerchantFormValues) => {
    onSave({
      name: data.name.trim(),
      comment: data.comment.trim() || null,
      categoryId: data.categoryId || null,
      isActive: data.isActive ? 1 : 0,
    })
    onClose()
  }

  const categoryOptions = [
    ...categories
      .filter((c) => c.kind === 'expense')
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => ({ value: c.id, label: c.name, group: 'Expenses' })),
    ...categories
      .filter((c) => c.kind === 'income')
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => ({ value: c.id, label: c.name, group: 'Income' })),
  ]

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" style={{ maxWidth: 420, background: 'var(--bg-elevated)', border: 'none' }}>
        <SheetHeader>
          <SheetTitle style={{ color: 'var(--ink)' }}>{item ? 'Edit merchant' : 'New merchant'}</SheetTitle>
        </SheetHeader>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Field data-invalid={showErr('name')}>
            <FieldLabel style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', display: 'block', marginBottom: 6 }}>Name</FieldLabel>
            <input className="fern-input" placeholder="e.g. Carrefour, Spotify" autoFocus {...register('name')} />
            {showErr('name') && <FieldError>{errors.name?.message}</FieldError>}
          </Field>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', display: 'block', marginBottom: 6 }}>Comment (optional)</label>
            <input className="fern-input" placeholder="Any notes about this merchant" {...register('comment')} />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', display: 'block', marginBottom: 6 }}>Default category (optional)</label>
            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <SearchableSelect
                  value={field.value}
                  onChange={field.onChange}
                  options={categoryOptions}
                  placeholder="No default category"
                  nullable
                  nullLabel="No default category"
                />
              )}
            />
          </div>

          {item && (
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 14px', background: field.value ? 'var(--bg-sunken)' : 'var(--rose-bg)', borderRadius: 10, transition: 'background 0.15s' }}>
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: field.value ? 'var(--ink)' : 'var(--rose-ink)' }}>
                      {field.value ? 'Active' : 'Inactive'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                      {field.value ? 'Shown when creating expenses' : 'Hidden from expense forms'}
                    </div>
                  </div>
                </label>
              )}
            />
          )}

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
