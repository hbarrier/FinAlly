import { createClient } from '@libsql/client'

const client = createClient({ url: 'file:./finance.db' })

const START = '2025-01-01'
const END = '2026-01-01'

async function main() {
  const [{ count: total2025 }] = (
    await client.execute({
      sql: `select count(*) as count from transactions where date >= ? and date < ?`,
      args: [START, END],
    })
  ).rows

  const [{ count: cashExpense2025 }] = (
    await client.execute({
      sql: `select count(*) as count
            from transactions
            where date >= ? and date < ?
              and kind = 'expense'
              and method = 'cash'`,
      args: [START, END],
    })
  ).rows

  await client.execute({
    sql: `update transactions
          set cleared = 0
          where date >= ? and date < ?`,
    args: [START, END],
  })

  await client.execute({
    sql: `update transactions
          set cleared = 1
          where date >= ? and date < ?
            and kind = 'expense'
            and method = 'cash'`,
    args: [START, END],
  })

  const [{ count: unclearedAfter }] = (
    await client.execute({
      sql: `select count(*) as count
            from transactions
            where date >= ? and date < ?
              and cleared = 0`,
      args: [START, END],
    })
  ).rows

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        year: 2025,
        totalTransactionsInYear: Number(total2025 ?? 0),
        cashExpenseTransactionsInYear: Number(cashExpense2025 ?? 0),
        unclearedInYearAfterReset: Number(unclearedAfter ?? 0),
      },
      null,
      2,
    ),
  )
}

main()
  .then(() => client.close())
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err)
    client.close()
    process.exitCode = 1
  })

