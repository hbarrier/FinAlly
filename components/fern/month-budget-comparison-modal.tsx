'use client'

import { useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { Modal } from './modal'
import { CatSwatch } from './cat-swatch'
import { fmt, formatDate, monthBudgetComparison, type Category } from '@/lib/derive'
import type { Merchant, BudgetWithLines, Transaction } from '@/lib/db-types'

interface Props {
  open: boolean
  onClose: () => void
  month: string
  budget: BudgetWithLines | null
  categories: Category[]
  merchants: Merchant[]
  transactions: Transaction[]
}

const STATUS_COLOR: Record<'ok' | 'warn' | 'over', string> = {
  ok: 'var(--sage-ink)',
  warn: 'var(--butter-ink)',
  over: 'var(--rose-ink)',
}

const GRID = 'minmax(0, 1fr) 96px 12px 96px'

export function MonthBudgetComparisonModal({ open, onClose, month, budget, categories, merchants, transactions }: Props) {
  const [includeYearly, setIncludeYearly] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const merchantById = useMemo(() => new Map(merchants.map((m) => [m.id, m])), [merchants])
  const title = `${formatDate(month + '-15T12:00:00', 'en-US', { month: 'long', year: 'numeric' })} vs budget`

  const cmp = useMemo(
    () =>
      budget
        ? monthBudgetComparison(budget.lines, transactions, month, categories, includeYearly)
        : null,
    [budget, transactions, month, categories, includeYearly],
  )

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const lineLabel = (line: { name: string | null; merchantId: string | null }) =>
    (line.merchantId ? merchantById.get(line.merchantId)?.name : null) ?? line.name ?? 'Line'

  const amountPair = (actual: number | null, budgeted: number | null, bad: boolean) => (
    <>
      <span style={{ fontFamily: 'var(--mono-fern)', fontSize: 12, textAlign: 'right', color: bad ? 'var(--rose-ink)' : 'var(--ink)' }}>
        {actual === null ? '—' : fmt(actual)}
      </span>
      <span style={{ textAlign: 'center', color: 'var(--ink-faint)' }}>/</span>
      <span style={{ fontFamily: 'var(--mono-fern)', fontSize: 12, textAlign: 'right', color: 'var(--ink-faint)' }}>
        {budgeted === null ? '—' : fmt(budgeted)}
      </span>
    </>
  )

  return (
    <Modal open={open} onClose={onClose} title={title} className="fern-modal-wide">
      {!cmp ? (
        <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>No budget yet. Create one from the Budget page.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ink-faint)', cursor: 'pointer' }}>
            <input type="checkbox" checked={includeYearly} onChange={(e) => setIncludeYearly(e.target.checked)} />
            Include yearly recurring
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: GRID, alignItems: 'baseline', columnGap: 8, rowGap: 6 }}>
            <span />
            <span style={{ textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-faint)', fontSize: 10, textAlign: 'right' }}>Actual</span>
            <span />
            <span style={{ textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-faint)', fontSize: 10, textAlign: 'right' }}>Budget</span>

            <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Revenues</span>
            {amountPair(cmp.income.actual, cmp.income.budgeted, cmp.income.actual < cmp.income.budgeted)}
            <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Expenses</span>
            {amountPair(cmp.expense.actual, cmp.expense.budgeted, cmp.expense.actual > cmp.expense.budgeted)}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: GRID, alignItems: 'baseline', columnGap: 8, rowGap: 2 }}>
            {cmp.categories.map((cat) => {
              const isOpen = expanded.has(cat.category.id)
              const rows: { label: string; recurring: boolean; actual: number | null; budgeted: number | null }[] = []
              for (const m of cat.matched)
                rows.push({ label: lineLabel(m.line), recurring: m.line.recurring === 1, actual: m.actual, budgeted: m.budgeted })
              for (const u of cat.unmatchedActual)
                rows.push({
                  label: (u.merchantId ? merchantById.get(u.merchantId)?.name : null) ?? 'Other',
                  recurring: u.recurring,
                  actual: u.amount,
                  budgeted: null,
                })
              for (const u of cat.unmatchedLines)
                rows.push({ label: lineLabel(u.line), recurring: u.line.recurring === 1, actual: null, budgeted: u.budgeted })
              // Tag recurring / one-off only where the same merchant appears as both.
              const dup = new Set(
                rows.map((r) => r.label).filter((l, i, a) => a.indexOf(l) !== i),
              )
              for (const r of rows)
                if (dup.has(r.label)) r.label += r.recurring ? ' · recurring' : ' · one-off'

              return (
                <div key={cat.category.id} style={{ display: 'contents' }}>
                  <button
                    type="button"
                    onClick={() => toggle(cat.category.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 0',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      borderTop: '1px solid var(--line-soft)',
                    }}
                  >
                    <ChevronRight
                      size={14}
                      style={{
                        color: 'var(--ink-faint)',
                        flexShrink: 0,
                        transform: isOpen ? 'rotate(90deg)' : 'none',
                        transition: 'transform 0.1s',
                      }}
                    />
                    <CatSwatch color={cat.category.color} icon={cat.category.icon} size={20} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {cat.category.name}
                    </span>
                  </button>
                  <span style={{ fontFamily: 'var(--mono-fern)', fontSize: 12, textAlign: 'right', color: STATUS_COLOR[cat.status], borderTop: '1px solid var(--line-soft)', paddingTop: 7 }}>
                    {fmt(cat.actual)}
                  </span>
                  <span style={{ textAlign: 'center', color: 'var(--ink-faint)', borderTop: '1px solid var(--line-soft)', paddingTop: 7 }}>/</span>
                  <span style={{ fontFamily: 'var(--mono-fern)', fontSize: 12, textAlign: 'right', color: 'var(--ink-faint)', borderTop: '1px solid var(--line-soft)', paddingTop: 7 }}>
                    {fmt(cat.budgeted)}
                  </span>

                  {isOpen &&
                    rows.map((r, i) => (
                      <div key={i} style={{ display: 'contents' }}>
                        <span style={{ fontSize: 12, color: 'var(--ink-soft)', paddingLeft: 26, paddingBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.label}
                        </span>
                        {amountPair(r.actual, r.budgeted, false)}
                      </div>
                    ))}
                </div>
              )
            })}
            {cmp.categories.length === 0 && (
              <p style={{ gridColumn: '1 / -1', fontSize: 13, color: 'var(--ink-faint)' }}>No budgeted expenses and nothing spent this month.</p>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
