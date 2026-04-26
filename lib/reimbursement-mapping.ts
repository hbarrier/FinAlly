type RateLike = {
  percent: number
  startDate: string
}

type TransactionAmountLike = {
  id?: string
  amount: number
  date: string
  manualSettlementAt?: string | null
}

type AllocationLike = {
  amount: number
}

type AllocationExpenseLike = TransactionAmountLike & {
  id: string
  expectedAmount?: number | null
  existingAllocations: AllocationLike[]
}

export type CalculatedReimbursementAllocation = {
  expenseTxId: string
  amount: number
}

export type ExpenseReimbursementStatus =
  | 'not_reimbursed'
  | 'partially_reimbursed'
  | 'reimbursed'
  | 'manually_settled'
  | 'no_rate'

export type IncomeReimbursementStatus =
  | 'unmapped'
  | 'partially_allocated'
  | 'fully_allocated'

export type ExpenseReimbursementSummary = {
  expectedAmount: number | null
  allocatedAmount: number
  remainingExpectedAmount: number | null
  status: ExpenseReimbursementStatus
}

export type IncomeReimbursementSummary = {
  allocatedAmount: number
  unallocatedAmount: number
  status: IncomeReimbursementStatus
}

const AMOUNT_EPSILON = 0.005

export function getApplicableReimbursementRate(
  rates: RateLike[],
  expenseDate: string,
): RateLike | null {
  return rates
    .filter((rate) => rate.startDate <= expenseDate)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))[0] ?? null
}

export function getExpectedReimbursementAmount(
  expense: TransactionAmountLike,
  rates: RateLike[],
): number | null {
  const rate = getApplicableReimbursementRate(rates, expense.date)
  return rate ? Math.round(Number(expense.amount) * rate.percent / 100) : null
}

export function sumAllocationAmounts(allocations: AllocationLike[]): number {
  return allocations.reduce((sum, allocation) => sum + Number(allocation.amount || 0), 0)
}

function isCovered(allocated: number, expected: number): boolean {
  return allocated + AMOUNT_EPSILON >= expected
}

function hasPositiveAmount(amount: number): boolean {
  return amount > AMOUNT_EPSILON
}

export function getRemainingExpectedReimbursement(
  expense: TransactionAmountLike,
  rates: RateLike[],
  allocations: AllocationLike[],
): number | null {
  const expected = getExpectedReimbursementAmount(expense, rates)
  if (expected == null) return null
  const remaining = expected - sumAllocationAmounts(allocations)
  return hasPositiveAmount(remaining) ? remaining : 0
}

export function getExpenseReimbursementStatus(
  expense: TransactionAmountLike,
  rates: RateLike[],
  allocations: AllocationLike[],
): ExpenseReimbursementStatus {
  if (expense.manualSettlementAt) return 'manually_settled'

  const expected = getExpectedReimbursementAmount(expense, rates)
  if (expected == null) return 'no_rate'

  const allocated = sumAllocationAmounts(allocations)
  if (!hasPositiveAmount(allocated)) return 'not_reimbursed'
  return isCovered(allocated, expected) ? 'reimbursed' : 'partially_reimbursed'
}

export function getIncomeReimbursementStatus(
  income: { amount: number },
  allocations: AllocationLike[],
): IncomeReimbursementStatus {
  const allocated = sumAllocationAmounts(allocations)
  if (!hasPositiveAmount(allocated)) return 'unmapped'
  return isCovered(allocated, Number(income.amount)) ? 'fully_allocated' : 'partially_allocated'
}

export function getExpenseReimbursementSummary(
  expense: TransactionAmountLike,
  rates: RateLike[],
  allocations: AllocationLike[],
): ExpenseReimbursementSummary {
  const expectedAmount = getExpectedReimbursementAmount(expense, rates)
  const allocatedAmount = sumAllocationAmounts(allocations)
  return {
    expectedAmount,
    allocatedAmount,
    remainingExpectedAmount: expectedAmount == null
      ? null
      : hasPositiveAmount(expectedAmount - allocatedAmount)
        ? expectedAmount - allocatedAmount
        : 0,
    status: getExpenseReimbursementStatus(expense, rates, allocations),
  }
}

export function getIncomeReimbursementSummary(
  income: { amount: number },
  allocations: AllocationLike[],
): IncomeReimbursementSummary {
  const allocatedAmount = sumAllocationAmounts(allocations)
  const unallocatedAmount = Number(income.amount) - allocatedAmount
  return {
    allocatedAmount,
    unallocatedAmount: hasPositiveAmount(unallocatedAmount) ? unallocatedAmount : 0,
    status: getIncomeReimbursementStatus(income, allocations),
  }
}

export function calculateReimbursementAllocations(
  income: { amount: number },
  expenses: AllocationExpenseLike[],
  rates: RateLike[],
): CalculatedReimbursementAllocation[] {
  let remainingIncome = Number(income.amount)

  return [...expenses]
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    .flatMap((expense) => {
      const expected = expense.expectedAmount ?? getExpectedReimbursementAmount(expense, rates)
      if (expected == null) return []

      const remainingExpected = expected - sumAllocationAmounts(expense.existingAllocations)
      const amount = hasPositiveAmount(remainingIncome) && hasPositiveAmount(remainingExpected)
        ? Math.min(remainingIncome, remainingExpected)
        : 0
      remainingIncome -= amount

      return [{ expenseTxId: expense.id, amount }]
    })
}

export function expenseReimbursementStatusLabel(status: ExpenseReimbursementStatus): string {
  switch (status) {
    case 'manually_settled':
      return 'Manually settled'
    case 'reimbursed':
      return 'Reimbursed'
    case 'partially_reimbursed':
      return 'Partially reimbursed'
    case 'no_rate':
      return 'No rate'
    case 'not_reimbursed':
      return 'Not reimbursed'
  }
}

export function incomeReimbursementStatusLabel(status: IncomeReimbursementStatus): string {
  switch (status) {
    case 'fully_allocated':
      return 'Fully allocated'
    case 'partially_allocated':
      return 'Partially allocated'
    case 'unmapped':
      return 'Unmapped'
  }
}
