'use client'

import { useMemo, useState } from 'react'
import { Dialog as SheetPrimitive } from 'radix-ui'
import { XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Icon } from '../icon'
import { MonthlyBarsChart } from '../monthly-bars-chart'
import {
  fmt,
  formatDate,
  completeMonthsWindow,
  groupTransactionsByMonth,
  roundToTen,
  simulationLineSourceTransactions,
} from '@/lib/derive'
import type { Category } from '@/lib/derive'
import type { Merchant, SimulationInputs, SimulationLine, Transaction } from '@/lib/db-types'

interface SimulationLineDetailSheetProps {
  open: boolean
  onClose: () => void
  line: SimulationLine
  inputs: SimulationInputs
  transactions: Transaction[]
  categories: Category[]
  merchants: Merchant[]
  onApply: (data: { months: number; excludedTxnIds: string[] }) => void
  pending?: boolean
}

const MONTH_OPTIONS = Array.from({ length: 24 }, (_, i) => i + 1)

/** All `YYYY-MM` keys in the look-back window, oldest first. */
function monthAxis(months: number): string[] {
  const { start, endExclusive } = completeMonthsWindow(months)
  const keys: string[] = []
  const d = new Date(`${start}T00:00:00`)
  const end = new Date(`${endExclusive}T00:00:00`)
  while (d < end) {
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    d.setMonth(d.getMonth() + 1)
  }
  return keys
}

function parseExcluded(raw: string | null): Set<string> {
  try {
    return new Set<string>(JSON.parse(raw ?? '[]'))
  } catch {
    return new Set<string>()
  }
}

export function SimulationLineDetailSheet({
  open,
  onClose,
  line,
  inputs,
  transactions,
  categories,
  merchants,
  onApply,
  pending,
}: SimulationLineDetailSheetProps) {
  const seededMonths = line.avgMonths ?? inputs.avg.periodMonths
  const [months, setMonths] = useState(seededMonths)
  const [excluded, setExcluded] = useState<Set<string>>(() => parseExcluded(line.excludedTxnIds))
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const source = useMemo(
    () => simulationLineSourceTransactions(line, inputs, transactions, undefined, months),
    [line, inputs, transactions, months],
  )

  const groups = useMemo(() => {
    const byMonth = new Map(groupTransactionsByMonth(source).map((g) => [g.month, g]))
    return monthAxis(months)
      .map((month) => byMonth.get(month) ?? { month, total: 0, txns: [] as Transaction[] })
      .sort((a, b) => b.month.localeCompare(a.month))
  }, [source, months])

  const chartMonths = useMemo(() => [...groups].reverse().map((g) => ({ month: g.month, total: g.total })), [groups])

  const keptAvg = useMemo(
    () => source.filter((t) => !excluded.has(t.id)).reduce((s, t) => s + Number(t.amount || 0), 0) / months,
    [source, excluded, months],
  )

  const baseExcluded = useMemo(() => parseExcluded(line.excludedTxnIds), [line.excludedTxnIds])
  const excludedChanged =
    excluded.size !== baseExcluded.size || [...excluded].some((id) => !baseExcluded.has(id))
  const dirty = excludedChanged || months !== seededMonths || roundToTen(keptAvg) !== line.amount

  const allCollapsed = groups.length > 0 && groups.every((g) => collapsed.has(g.month))

  const toggleMonth = (month: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(month)) next.delete(month)
      else next.add(month)
      return next
    })

  const toggleAll = () =>
    setCollapsed(allCollapsed ? new Set() : new Set(groups.map((g) => g.month)))

  const toggleTxn = (id: string) =>
    setExcluded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const barColor = line.kind === 'income' ? 'var(--sage)' : 'var(--rose)'

  return (
    <SheetPrimitive.Root open={open} onOpenChange={(v) => !v && onClose()} modal={false}>
      <SheetPrimitive.Portal>
        <SheetPrimitive.Content
          aria-describedby={undefined}
          onInteractOutside={(e) => e.preventDefault()}
          className="fern-sheet-content detail"
          style={{
            position: 'fixed',
            top: 0,
            bottom: 0,
            right: 460,
            width: 440,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-elevated)',
            borderRight: '1px solid var(--line)',
            zIndex: 50,
            boxShadow: 'var(--shadow-lg, -8px 0 24px rgba(0,0,0,0.08))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
            <SheetPrimitive.Title className="fern-sheet-title">Source transactions</SheetPrimitive.Title>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </Button>
          </div>

          <div className="fern-sheet-body">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ink-soft)' }}>
              Look back
              <select
                className="fern-select"
                value={months}
                onChange={(e) => setMonths(Number(e.target.value))}
                style={{ padding: '6px 10px', fontSize: 13 }}
              >
                {MONTH_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m} month{m === 1 ? '' : 's'}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <div className="fern-display" style={{ fontSize: 28, color: line.kind === 'income' ? 'var(--sage-ink)' : 'var(--rose-ink)' }}>
                {fmt(keptAvg)}
                <span style={{ fontSize: 12, color: 'var(--ink-faint)', fontFamily: 'inherit' }}>
                  {' '}/mo over {months} month{months === 1 ? '' : 's'}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 2 }}>
                Line currently {fmt(line.amount)}
              </div>
              <button
                type="button"
                className="fern-btn sheet-primary primary"
                disabled={!dirty || pending}
                onClick={() => onApply({ months, excludedTxnIds: [...excluded] })}
                style={{ marginTop: 10 }}
              >
                <Icon name="check" size={14} /> Push to simulation
              </button>
            </div>

            <MonthlyBarsChart months={chartMonths} color={barColor} />

            <button
              type="button"
              onClick={toggleAll}
              style={{ alignSelf: 'flex-start', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--ink-faint)', padding: 0 }}
            >
              {allCollapsed ? 'Expand all' : 'Collapse all'}
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {groups.map((g) => {
                const isCollapsed = collapsed.has(g.month)
                return (
                  <div key={g.month}>
                    <button
                      type="button"
                      onClick={() => toggleMonth(g.month)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                    >
                      <Icon name={isCollapsed ? 'chevronRight' : 'chevronDown'} size={12} />
                      <span style={{ flex: 1, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {formatDate(`${g.month}-01`, 'fr-FR', { month: 'long', year: 'numeric' })}
                      </span>
                      <span style={{ fontSize: 11, fontFamily: 'var(--mono-fern)', color: 'var(--ink-faint)' }}>
                        {fmt(g.total)}
                      </span>
                    </button>
                    {!isCollapsed &&
                      (g.txns.length === 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--ink-faint)', padding: '6px 0 6px 18px' }}>No transactions</div>
                      ) : (
                        g.txns.map((t) => {
                          const included = !excluded.has(t.id)
                          const merchant = t.merchantId ? merchants.find((m) => m.id === t.merchantId) : undefined
                          const cat = t.categoryId ? categories.find((c) => c.id === t.categoryId) : undefined
                          return (
                            <label
                              key={t.id}
                              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0 6px 18px', cursor: 'pointer', opacity: included ? 1 : 0.45 }}
                            >
                              <input type="checkbox" checked={included} onChange={() => toggleTxn(t.id)} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, color: 'var(--ink)' }}>
                                  {merchant?.name || t.note || cat?.name || 'Transaction'}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{formatDate(t.date)}</div>
                              </div>
                              <div style={{ fontSize: 13, fontFamily: 'var(--mono-fern)', color: 'var(--ink-soft)', textDecoration: included ? 'none' : 'line-through' }}>
                                {fmt(t.amount)}
                              </div>
                            </label>
                          )
                        })
                      ))}
                  </div>
                )
              })}
            </div>
          </div>
        </SheetPrimitive.Content>
      </SheetPrimitive.Portal>
    </SheetPrimitive.Root>
  )
}
