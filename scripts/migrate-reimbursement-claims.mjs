import { createClient } from '@libsql/client'
import { randomUUID } from 'crypto'

const client = createClient({ url: 'file:./finance.db' })

async function main() {
  // Each income tx covers exactly one expense month (verified in reimbursement_allocations)
  const { rows } = await client.execute(`
    SELECT ra.reimbursement_tx_id,
           substr(e.date, 1, 7) AS expense_month,
           i.date               AS income_date
    FROM reimbursement_allocations ra
    JOIN transactions e ON e.id = ra.expense_tx_id
    JOIN transactions i ON i.id = ra.reimbursement_tx_id
    GROUP BY ra.reimbursement_tx_id
    ORDER BY expense_month
  `)

  let claimsCreated = 0
  let allocationsCreated = 0

  for (const row of rows) {
    const { reimbursement_tx_id, expense_month, income_date } = row

    // Get or create the claim for this expense month
    const existing = await client.execute({
      sql: `SELECT id FROM reimbursement_claims WHERE month = ?`,
      args: [expense_month],
    })

    let claimId
    if (existing.rows.length > 0) {
      claimId = existing.rows[0].id
    } else {
      claimId = randomUUID()
      await client.execute({
        sql: `INSERT INTO reimbursement_claims (id, month, claim_date) VALUES (?, ?, ?)`,
        args: [claimId, expense_month, income_date],
      })
      claimsCreated++
    }

    // Link the income tx to the claim (idempotent)
    const alloc = await client.execute({
      sql: `SELECT id FROM reimbursement_claim_allocations WHERE claim_id = ? AND reimbursement_tx_id = ?`,
      args: [claimId, reimbursement_tx_id],
    })
    if (alloc.rows.length === 0) {
      await client.execute({
        sql: `INSERT INTO reimbursement_claim_allocations (id, claim_id, reimbursement_tx_id) VALUES (?, ?, ?)`,
        args: [randomUUID(), claimId, reimbursement_tx_id],
      })
      allocationsCreated++
    }
  }

  console.log(JSON.stringify({ claimsCreated, allocationsCreated, total: rows.length }, null, 2))
}

main()
  .then(() => client.close())
  .catch((err) => {
    console.error(err)
    client.close()
    process.exitCode = 1
  })
