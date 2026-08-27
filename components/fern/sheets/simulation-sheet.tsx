'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Field, FieldError } from '@/components/ui/field'
import { SegmentedControl } from '../segmented-control'
import { SheetShell } from '../sheet-shell'
import type { Simulation } from '@/lib/db-types'

const SOURCES = [
  { value: 'scratch', label: 'Start from scratch' },
  { value: 'recurring', label: 'Start from current recurring' },
]

const simulationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string(),
  source: z.enum(['scratch', 'recurring']),
})

type SimulationFormValues = z.infer<typeof simulationSchema>

function getDefaultValues(item?: Simulation | null): SimulationFormValues {
  return {
    name: item?.name ?? '',
    description: item?.description ?? '',
    source: 'scratch',
  }
}

interface SimulationSheetProps {
  open: boolean
  onClose: () => void
  item?: Simulation | null
  recurringEnabled?: boolean
  onSave: (data: { name: string; description: string | null; startFromRecurring: boolean }) => void
}

export function SimulationSheet({ open, onClose, item, recurringEnabled = false, onSave }: SimulationSheetProps) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    trigger,
    formState: { errors, isValid, dirtyFields, isSubmitted },
  } = useForm<SimulationFormValues>({
    resolver: zodResolver(simulationSchema),
    defaultValues: getDefaultValues(item),
    mode: 'onChange',
  })

  useEffect(() => {
    if (open) {
      reset(getDefaultValues(item))
      trigger()
    }
  }, [open, item, reset, trigger])

  const showErr = (field: keyof SimulationFormValues) =>
    !!(errors[field] && (dirtyFields[field] || isSubmitted))

  const onSubmit = (data: SimulationFormValues) => {
    onSave({
      name: data.name.trim(),
      description: data.description.trim() ? data.description.trim() : null,
      startFromRecurring: data.source === 'recurring',
    })
    onClose()
  }

  return (
    <SheetShell
      open={open}
      onClose={onClose}
      title={item ? 'Edit simulation' : 'New simulation'}
      primary={{
        label: item ? 'Save' : 'Create',
        icon: 'check',
        onClick: handleSubmit(onSubmit),
        disabled: !isValid,
      }}
    >
      <Field data-invalid={showErr('name')}>
        <label className="fern-field-label">Name</label>
        <input className="fern-input" placeholder="e.g. New job, Moving out" autoFocus {...register('name')} />
        {showErr('name') && <FieldError>{errors.name?.message}</FieldError>}
      </Field>

      <Field>
        <label className="fern-field-label">Description (optional)</label>
        <textarea className="fern-input" rows={3} placeholder="What is this scenario about?" {...register('description')} />
      </Field>

      {!item && recurringEnabled && (
        <div>
          <label className="fern-field-label wide">Starting point</label>
          <Controller
            control={control}
            name="source"
            render={({ field }) => (
              <SegmentedControl value={field.value} onChange={field.onChange} options={SOURCES} />
            )}
          />
        </div>
      )}
    </SheetShell>
  )
}
