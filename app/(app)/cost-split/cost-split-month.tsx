'use client'

import { useTranslations } from 'next-intl'
import { fmt, formatDate } from '@/lib/derive'
import { parseDecimal } from '@/lib/utils'
import { expenseShares, type MonthView } from '@/lib/divorce-split'
import type { DivorceSplitEntry, DivorceSplitRentMonth } from '@/lib/db-types'

const GRID = '90px 230px 110px 130px 130px 90px 90px'
const NUM = { textAlign: 'right' } as const
const CENTER = { textAlign: 'center' } as const
const ROW = { display: 'grid', gridTemplateColumns: GRID, gap: 12, padding: '10px 16px', alignItems: 'center' } as const
const HEAD = { fontSize: 11, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' } as const
const LINE = { borderBottom: '1px solid var(--line-soft)' } as const
const HINT = { display: 'block', fontSize: 11, color: 'var(--ink-faint)', fontWeight: 400 } as const

export type MonthHandlers = {
  onOpen: (e: DivorceSplitEntry) => void
  onExpensePaid: (e: DivorceSplitEntry, who: 'me' | 'vincent', paid: boolean) => void
  onRentOverride: (month: string, data: { rent: number | null; apl: number | null }) => void
  onRentPaid: (month: string, who: 'vincent' | 'audrey', paid: boolean) => void
}

interface CostSplitMonthProps extends MonthHandlers {
  view: MonthView<DivorceSplitEntry>
  rentRow: DivorceSplitRentMonth | undefined
}

function Check({ checked, label, onChange }: { checked: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <span style={CENTER} onClick={(ev) => ev.stopPropagation()}>
      <input type="checkbox" aria-label={label} checked={checked} onChange={(ev) => onChange(ev.target.checked)} />
    </span>
  )
}

const struck = (paid: boolean) => (paid ? { textDecoration: 'line-through', color: 'var(--ink-faint)' } : {})

/**
 * One month as a single table: the rent row, Audrey's expenses, and a total row.
 * "Mum's share" is what I owe Audrey (negative when Audrey owes me); settled shares are excluded from the totals.
 */
export function CostSplitMonth({ view, rentRow, onOpen, onExpensePaid, onRentOverride, onRentPaid }: CostSplitMonthProps) {
  const t = useTranslations('costSplit')
  const { month, rent, expenses, balance } = view
  const amountTotal = (rent?.shared ?? 0) + expenses.reduce((s, e) => s + e.amount, 0)

  const overrideInput = (field: 'rent' | 'apl') => {
    const override = rentRow?.[field] ?? null
    const save = (raw: string) => {
      const next = raw.trim() === '' ? null : parseDecimal(raw)
      if (next !== override && !(next != null && isNaN(next))) {
        onRentOverride(month, { rent: rentRow?.rent ?? null, apl: rentRow?.apl ?? null, [field]: next })
      }
    }
    return (
      <input
        key={`${month}-${field}-${override}`}
        className="fern-input"
        inputMode="decimal"
        aria-label={t(field)}
        title={override == null ? t('defaultValue') : undefined}
        defaultValue={override ?? ''}
        placeholder={String(rent![field])}
        onBlur={(ev) => save(ev.target.value)}
        style={{ width: 64, textAlign: 'right', padding: '2px 6px' }}
      />
    )
  }

  const sectionRow = (label: string) => (
    <div style={{ ...LINE, padding: '6px 16px', fontSize: 12, fontWeight: 700, color: 'var(--teal-ink)' }}>{label}</div>
  )

  return (
    <section style={{ background: 'var(--bg-elevated)', borderRadius: 14, overflowX: 'auto', border: '1px solid var(--line-soft)' }}>
      <div style={{ minWidth: 'max-content' }}>
        <h2 style={{ ...LINE, margin: 0, padding: '12px 16px', fontSize: 15, fontWeight: 700, color: 'var(--ink)', textTransform: 'capitalize' }}>
          {formatDate(`${month}-01`, { month: 'long', year: 'numeric' })}
        </h2>

        <div style={{ ...ROW, ...HEAD, ...LINE, background: 'var(--bg-sunken)' }}>
          <span>{t('colDate')}</span>
          <span>{t('colDescription')}</span>
          <span style={NUM}>{t('colAmount')}</span>
          <span style={NUM}>{t('colMyShare')}</span>
          <span style={NUM}>{t('colVincentShare')}</span>
          <span style={CENTER}>{t('colMySettled')}</span>
          <span style={CENTER}>{t('colVincentSettled')}</span>
        </div>

        {rent && (
          <>
            {sectionRow(t('rentSection'))}
            <div style={{ ...ROW, ...LINE, fontSize: 13, color: 'var(--ink-soft)' }}>
              <span>—</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink)' }}>
                {t('rent')} {overrideInput('rent')} − {t('apl')} {overrideInput('apl')}
              </span>
              <span style={{ ...NUM, fontWeight: 700, color: 'var(--ink)' }}>
                {fmt(rent.shared)}
                <span style={HINT}>{t('shared')}</span>
              </span>
              <span style={{ ...NUM, ...struck(rent.audreyPaid) }}>
                {fmt(-rent.audreyOwesMe)}
                <span style={HINT}>{t('audreyOwes')}</span>
              </span>
              <span style={{ ...NUM, ...struck(rent.vincentPaid) }}>{fmt(rent.vincentShare)}</span>
              <Check checked={rent.audreyPaid} label={t('colMySettled')} onChange={(v) => onRentPaid(month, 'audrey', v)} />
              <Check checked={rent.vincentPaid} label={t('colVincentSettled')} onChange={(v) => onRentPaid(month, 'vincent', v)} />
            </div>
          </>
        )}

        {sectionRow(t('expensesSection'))}
        {expenses.length === 0 && (
          <div style={{ ...LINE, padding: '10px 16px', fontSize: 13, color: 'var(--ink-faint)' }}>{t('noExpenses')}</div>
        )}
        {expenses.map((e) => {
          const { mine, vincent } = expenseShares(e)
          const pct = e.myPercent ?? 0
          return (
            <div key={e.id} onClick={() => onOpen(e)} style={{ ...ROW, ...LINE, cursor: 'pointer', fontSize: 13, color: 'var(--ink-soft)' }}>
              <span>{formatDate(e.date)}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink)' }} title={e.description ?? undefined}>
                {e.description ?? '—'}
              </span>
              <span style={{ ...NUM, fontWeight: 700, color: 'var(--ink)' }}>{fmt(e.amount)}</span>
              <span style={{ ...NUM, ...struck(e.mePaid === 1) }}>
                {fmt(mine)}
                <span style={HINT}>{pct}%</span>
              </span>
              <span style={{ ...NUM, ...struck(e.vincentPaid === 1) }}>
                {fmt(vincent)}
                <span style={HINT}>{100 - pct}%</span>
              </span>
              <Check checked={e.mePaid === 1} label={t('colMySettled')} onChange={(v) => onExpensePaid(e, 'me', v)} />
              <Check checked={e.vincentPaid === 1} label={t('colVincentSettled')} onChange={(v) => onExpensePaid(e, 'vincent', v)} />
            </div>
          )
        })}

        <div style={{ ...ROW, background: 'var(--bg-sunken)', fontSize: 14, fontWeight: 800, color: 'var(--ink)', borderTop: '2px solid var(--line)' }}>
          <span />
          <span>{t('monthTotal')}</span>
          <span style={NUM}>{fmt(amountTotal)}</span>
          <span style={NUM}>{fmt(balance.iOweAudrey)}</span>
          <span style={NUM}>{fmt(balance.vincentOwesAudrey)}</span>
          <span />
          <span />
        </div>
      </div>
    </section>
  )
}
