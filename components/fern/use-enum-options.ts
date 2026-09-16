'use client'

import { useTranslations } from 'next-intl'

/** `{ value, label }[]` for the monthly/yearly cadence & frequency selects. */
export function useFrequencyOptions() {
  const t = useTranslations('enums.frequency')
  return [
    { value: 'monthly', label: t('monthly') },
    { value: 'yearly', label: t('yearly') },
  ]
}

/** `{ value, label }[]` for the ad-hoc/recurring budget-line type toggle. */
export function useBudgetLineTypeOptions() {
  const t = useTranslations('enums.budgetLineType')
  return [
    { value: 'adhoc', label: t('adhoc') },
    { value: 'recurring', label: t('recurring') },
  ]
}
