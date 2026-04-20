'use client'

import { useEffect, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Field, FieldError } from '@/components/ui/field'
import { SearchableSelect } from '../searchable-select'
import { SheetShell } from '../sheet-shell'
import { buildCategorySelectOptions, type Category } from '@/lib/derive'
import type { Merchant } from '@/lib/db-types'

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
  }, [open, item, reset, trigger])

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

  const categoryOptions = useMemo(() => buildCategorySelectOptions(categories), [categories])

  return (
    <SheetShell
      open={open}
      onClose={onClose}
      compact
      title={item ? 'Edit merchant' : 'New merchant'}
      primary={{
        label: item ? 'Save' : 'Create',
        icon: 'check',
        onClick: handleSubmit(onSubmit),
        disabled: !isValid,
      }}
    >
      <Field data-invalid={showErr('name')}>
        <label className="fern-field-label">Name</label>
        <input className="fern-input" placeholder="e.g. Carrefour, Spotify" autoFocus {...register('name')} />
        {showErr('name') && <FieldError>{errors.name?.message}</FieldError>}
      </Field>

      <div>
        <label className="fern-field-label">Comment (optional)</label>
        <input className="fern-input" placeholder="Any notes about this merchant" {...register('comment')} />
      </div>

      <div>
        <label className="fern-field-label">Default category (optional)</label>
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
    </SheetShell>
  )
}
