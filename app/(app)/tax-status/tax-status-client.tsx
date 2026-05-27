'use client'

import { useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { fmt, formatDate } from '@/lib/derive'
import { setTaxAllocation } from '@/lib/actions/tax-allocations'
import { runAction } from '@/lib/utils'
import { YearPicker } from '@/components/fern/year-picker'
import type { TaxIncomeRow, TaxExpenseRow } from '@/lib/queries/tax-data'
import type { TaxAllocationValue } from '@/lib/db-types'

interface Props {
  rows: TaxIncomeRow[]
  expenseRows: TaxExpenseRow[]
  years: string[]
  selectedYear: number
}

function AllocationPicker({ txId, current }: { txId: string; current: TaxAllocationValue | null }) {
  const [isPending, startTransition] = useTransition()

  const pick = (v: TaxAllocationValue) => {
    startTransition(runAction(async () => {
      await setTaxAllocation(txId, v)
    }))
  }

  const options: { value: TaxAllocationValue; label: string }[] = [
    { value: 'audrey', label: 'Audrey' },
    { value: 'split', label: '50/50' },
    { value: 'lucie', label: 'Lucie' },
  ]

  return (
    <div style={{ display: 'flex', gap: 4, opacity: isPending ? 0.5 : 1 }}>
      {options.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => pick(value)}
          disabled={isPending}
          style={{
            padding: '4px 10px',
            borderRadius: 8,
            border: 'none',
            fontSize: 12,
            fontWeight: current === value ? 700 : 400,
            background: current === value ? 'var(--teal-bg)' : 'var(--bg-sunken)',
            color: current === value ? 'var(--teal-ink)' : 'var(--ink-soft)',
            cursor: isPending ? 'default' : 'pointer',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export function TaxStatusClient({ rows, expenseRows, years, selectedYear }: Props) {
  const router = useRouter()

  const totals = useMemo(() => {
    let audrey = 0, lucie = 0, unallocated = 0
    let audreyReimb = 0, audreyPension = 0, lucieReimb = 0, luciePension = 0
    for (const row of rows) {
      const isReimb = row.type === 'reimbursement'
      if (row.allocation === 'audrey') {
        audrey += row.amount
        if (isReimb) audreyReimb += row.amount; else audreyPension += row.amount
      } else if (row.allocation === 'lucie') {
        lucie += row.amount
        if (isReimb) lucieReimb += row.amount; else luciePension += row.amount
      } else if (row.allocation === 'split') {
        audrey += row.amount / 2
        lucie += row.amount / 2
        if (isReimb) { audreyReimb += row.amount / 2; lucieReimb += row.amount / 2 }
        else { audreyPension += row.amount / 2; luciePension += row.amount / 2 }
      } else {
        unallocated++
      }
    }
    return { audrey, lucie, unallocated, audreyReimb, audreyPension, lucieReimb, luciePension }
  }, [rows])

  const reimbursements = useMemo(
    () => rows.filter((r) => r.type === 'reimbursement').sort((a, b) => a.date.localeCompare(b.date)),
    [rows],
  )
  const pensions = useMemo(
    () => rows.filter((r) => r.type === 'pension').sort((a, b) => a.date.localeCompare(b.date)),
    [rows],
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, padding: '32px 0' }}>
      <header style={{ display: 'grid', gap: 14 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--mono-fern)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--teal-ink)', fontWeight: 700 }}>
          Tax
        </div>
        <h1 style={{ fontSize: 28, lineHeight: 1.05, fontWeight: 700, color: 'var(--ink)', margin: '6px 0 0' }}>
          Yearly Status
        </h1>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '8px 0 0', maxWidth: 620 }}>
          Allocate reimbursements and pension alimentaire to Audrey or Lucie for tax declaration.
        </p>
      </header>

      {/* Year picker */}
      {years.length > 0 && (
        <YearPicker
          years={years}
          selectedYear={selectedYear}
          onSelect={(y) => {
            const params = new URLSearchParams(window.location.search)
            params.set('year', y)
            router.push(`?${params.toString()}`)
          }}
        />
      )}

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        <SummaryCard label="Audrey" value={fmt(totals.audrey)} tone="teal" reimbursement={totals.audreyReimb} pension={totals.audreyPension} />
        <SummaryCard label="Lucie" value={fmt(totals.lucie)} tone="sage" reimbursement={totals.lucieReimb} pension={totals.luciePension} />
        {totals.unallocated > 0 && (
          <SummaryCard label="Unallocated" value={String(totals.unallocated)} tone="muted" />
        )}
      </div>

      {/* Income rows */}
      {rows.length === 0 ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 14 }}>
          No reimbursements or pension alimentaire found for {selectedYear}.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {reimbursements.length > 0 && (
            <TxSection title="Reimbursements" rows={reimbursements} />
          )}
          {pensions.length > 0 && (
            <TxSection title="Pensions alimentaires" rows={pensions} />
          )}
        </div>
      )}

      {/* Expense allocations */}
      {expenseRows.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Dépenses remboursables
          </div>
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--line-soft)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 90px 1fr auto', gap: 12, padding: '10px 16px', background: 'var(--bg-sunken)', borderBottom: '1px solid var(--line-soft)', fontSize: 11, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              <span>Date</span>
              <span>Montant</span>
              <span>Description</span>
              <span>Allocation</span>
            </div>
            {expenseRows.map((row, i) => (
              <div
                key={row.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '100px 90px 1fr auto',
                  gap: 12,
                  padding: '12px 16px',
                  borderBottom: i < expenseRows.length - 1 ? '1px solid var(--line-soft)' : undefined,
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{formatDate(row.date)}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--rose-ink)' }}>-{fmt(row.amount)}</span>
                <span style={{ fontSize: 13, color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.merchantName ?? row.categoryName ?? row.note ?? '—'}
                </span>
                <AllocationPicker txId={row.id} current={row.allocation} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({
  label, value, tone, reimbursement, pension,
}: {
  label: string
  value: string
  tone: 'teal' | 'sage' | 'muted'
  reimbursement?: number
  pension?: number
}) {
  const bg =
    tone === 'teal' ? 'var(--teal-bg)' : tone === 'sage' ? 'var(--sage-bg)' : 'var(--bg-elevated)'
  const color =
    tone === 'teal' ? 'var(--teal-ink)' : tone === 'sage' ? 'var(--sage-ink)' : 'var(--ink-soft)'
  return (
    <div style={{ background: bg, borderRadius: 14, padding: '14px 16px' }}>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>{label}</div>
      {(reimbursement !== undefined || pension !== undefined) && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {reimbursement !== undefined && reimbursement > 0 && (
            <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
              Reimb. <span style={{ fontWeight: 600 }}>{fmt(reimbursement)}</span>
            </div>
          )}
          {pension !== undefined && pension > 0 && (
            <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
              Pension <span style={{ fontWeight: 600 }}>{fmt(pension)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TxSection({ title, rows }: { title: string; rows: TaxIncomeRow[] }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ background: 'var(--bg-elevated)', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--line-soft)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '100px 90px 1fr auto', gap: 12, padding: '10px 16px', background: 'var(--bg-sunken)', borderBottom: '1px solid var(--line-soft)', fontSize: 11, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          <span>Date</span>
          <span>Amount</span>
          <span>For</span>
          <span>Allocation</span>
        </div>
        {rows.map((row, i) => {
          const forText =
            row.type === 'reimbursement' && row.coveredExpenses.length > 0
              ? row.coveredExpenses.map((e) => e.merchantName ?? e.expenseNote ?? '—').join(', ')
              : row.note ?? '—'
          return (
            <div
              key={row.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '100px 90px 1fr auto',
                gap: 12,
                padding: '12px 16px',
                borderBottom: i < rows.length - 1 ? '1px solid var(--line-soft)' : undefined,
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{formatDate(row.date)}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--sage-ink)' }}>+{fmt(row.amount)}</span>
              <span style={{ fontSize: 13, color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={forText}>
                {forText}
              </span>
              <AllocationPicker txId={row.id} current={row.allocation} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
