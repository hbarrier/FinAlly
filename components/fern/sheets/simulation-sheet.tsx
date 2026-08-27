'use client'

import { useEffect, type CSSProperties } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Field, FieldError } from '@/components/ui/field'
import { SegmentedControl } from '../segmented-control'
import { SheetShell } from '../sheet-shell'
import type { Simulation } from '@/lib/db-types'
import type { SimulationInputs } from '@/lib/actions/simulations'
import { parseDecimal } from '@/lib/utils'

const PERIODS = [
  { value: '1', label: '1 month' },
  { value: '6', label: '6 months' },
  { value: '12', label: '1 year' },
]

const ROLLUPS = [
  { value: 'all', label: 'Include every category + merchant' },
  { value: 'drop', label: 'Drop lines below threshold' },
  { value: 'other', label: 'Roll sub-threshold lines into "Other <category>"' },
]

const simulationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string(),
  recMonthlyExpenses: z.boolean(),
  recMonthlyIncome: z.boolean(),
  recYearlyExpenses: z.boolean(),
  recYearlyIncome: z.boolean(),
  avgExpenses: z.boolean(),
  avgIncome: z.boolean(),
  avgPeriodMonths: z.enum(['1', '6', '12']),
  avgRollup: z.enum(['all', 'drop', 'other']),
  avgThreshold: z.string(),
})

type SimulationFormValues = z.infer<typeof simulationSchema>

function getDefaultValues(item?: Simulation | null): SimulationFormValues {
  return {
    name: item?.name ?? '',
    description: item?.description ?? '',
    recMonthlyExpenses: false,
    recMonthlyIncome: false,
    recYearlyExpenses: false,
    recYearlyIncome: false,
    avgExpenses: false,
    avgIncome: false,
    avgPeriodMonths: '6',
    avgRollup: 'all',
    avgThreshold: '50',
  }
}

function buildInputs(data: SimulationFormValues): SimulationInputs | null {
  const anyRecurring =
    data.recMonthlyExpenses || data.recMonthlyIncome || data.recYearlyExpenses || data.recYearlyIncome
  const anyAvg = data.avgExpenses || data.avgIncome
  if (!anyRecurring && !anyAvg) return null
  return {
    recurring: {
      monthlyExpenses: data.recMonthlyExpenses,
      monthlyIncome: data.recMonthlyIncome,
      yearlyExpenses: data.recYearlyExpenses,
      yearlyIncome: data.recYearlyIncome,
    },
    avg: {
      expenses: data.avgExpenses,
      income: data.avgIncome,
      periodMonths: Number(data.avgPeriodMonths) as 1 | 6 | 12,
      rollup: data.avgRollup,
      thresholdMonthly: parseDecimal(data.avgThreshold) || 0,
    },
  }
}

interface SimulationSheetProps {
  open: boolean
  onClose: () => void
  item?: Simulation | null
  recurringEnabled?: boolean
  onSave: (data: { name: string; description: string | null; inputs: SimulationInputs | null }) => void
}

const CHECKBOX_ROW: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 13,
  color: 'var(--ink)',
  cursor: 'pointer',
  padding: '4px 0',
}

export function SimulationSheet({ open, onClose, item, recurringEnabled = false, onSave }: SimulationSheetProps) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    trigger,
    watch,
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

  const avgActive = watch('avgExpenses') || watch('avgIncome')
  const rollup = watch('avgRollup')

  const onSubmit = (data: SimulationFormValues) => {
    onSave({
      name: data.name.trim(),
      description: data.description.trim() ? data.description.trim() : null,
      inputs: buildInputs(data),
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

      {!item && (
        <div>
          <label className="fern-field-label wide">Include</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {recurringEnabled && (
              <>
                <label style={CHECKBOX_ROW}>
                  <input type="checkbox" {...register('recMonthlyExpenses')} /> Recurring monthly expenses
                </label>
                <label style={CHECKBOX_ROW}>
                  <input type="checkbox" {...register('recMonthlyIncome')} /> Recurring monthly income
                </label>
                <label style={CHECKBOX_ROW}>
                  <input type="checkbox" {...register('recYearlyExpenses')} /> Recurring yearly expenses
                </label>
                <label style={CHECKBOX_ROW}>
                  <input type="checkbox" {...register('recYearlyIncome')} /> Recurring yearly income
                </label>
              </>
            )}
            <label style={CHECKBOX_ROW}>
              <input type="checkbox" {...register('avgExpenses')} /> Average non-recurring expenses
            </label>
            <label style={CHECKBOX_ROW}>
              <input type="checkbox" {...register('avgIncome')} /> Average non-recurring income
            </label>
          </div>
        </div>
      )}

      {!item && avgActive && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingLeft: 8, borderLeft: '2px solid var(--line-soft)' }}>
          <div>
            <label className="fern-field-label wide">Averaging period</label>
            <Controller
              control={control}
              name="avgPeriodMonths"
              render={({ field }) => (
                <SegmentedControl value={field.value} onChange={field.onChange} options={PERIODS} />
              )}
            />
          </div>
          <Field>
            <label className="fern-field-label">Line handling</label>
            <Controller
              control={control}
              name="avgRollup"
              render={({ field }) => (
                <select className="fern-input" value={field.value} onChange={(e) => field.onChange(e.target.value)}>
                  {ROLLUPS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              )}
            />
          </Field>
          {rollup !== 'all' && (
            <Field>
              <label className="fern-field-label">Threshold (€ / month)</label>
              <input className="fern-input" inputMode="decimal" placeholder="50" {...register('avgThreshold')} />
            </Field>
          )}
        </div>
      )}
    </SheetShell>
  )
}
