export function indexReimbursementAllocations<
  T extends { reimbursementTxId: string; expenseTxId: string },
>(allocations: T[]) {
  const allocationsByReimbursementTxId = new Map<string, T[]>()
  const allocationsByExpenseTxId = new Map<string, T[]>()

  for (const allocation of allocations) {
    const incomeBucket = allocationsByReimbursementTxId.get(allocation.reimbursementTxId) ?? []
    incomeBucket.push(allocation)
    allocationsByReimbursementTxId.set(allocation.reimbursementTxId, incomeBucket)

    const expenseBucket = allocationsByExpenseTxId.get(allocation.expenseTxId) ?? []
    expenseBucket.push(allocation)
    allocationsByExpenseTxId.set(allocation.expenseTxId, expenseBucket)
  }

  return { allocationsByReimbursementTxId, allocationsByExpenseTxId }
}

