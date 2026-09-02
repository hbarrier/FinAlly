import type { Metadata } from 'next'
import { getAvailableTaxYears, getTaxData, getExpenseTaxData } from '@/lib/queries/tax-data'

export const metadata: Metadata = { title: 'Tax Status | FinAlly' }
import { TaxStatusClient } from './tax-status-client'
import { requireModule } from '@/lib/modules'

export default async function TaxStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  await requireModule('taxstatus')
  const { year } = await searchParams
  const currentYear = new Date().getFullYear()
  const selectedYear = year ? parseInt(year, 10) : currentYear

  const [years, rows, expenseRows] = await Promise.all([
    getAvailableTaxYears(),
    getTaxData(selectedYear),
    getExpenseTaxData(selectedYear),
  ])

  return <TaxStatusClient rows={rows} expenseRows={expenseRows} years={years} selectedYear={selectedYear} />
}
