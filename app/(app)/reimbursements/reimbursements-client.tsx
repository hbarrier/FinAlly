'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CatSwatch } from '@/components/fern/cat-swatch'
import { Icon } from '@/components/fern/icon'
import { SegmentedControl } from '@/components/fern/segmented-control'
import { fmt, formatDate } from '@/lib/derive'
import type { ReimbursementRate as Rate, TaxAllocationValue } from '@/lib/db-types'
import {
  addReimbursementRate,
  deleteReimbursementRate,
  updateReimbursementRate,
} from '@/lib/actions/reimbursements'
import {
  setMonthClaimDate,
  clearMonthClaimDate,
  setExpenseAmountOverride,
  linkIncomeToClaim,
  unlinkAllFromClaim,
  setMonthClaimSettled,
} from '@/lib/actions/reimbursement-claims'
import { setTaxAllocation, clearTaxAllocation } from '@/lib/actions/tax-allocations'

// ---- types ----

type MonthExpense = {
  id: string
  date: string
  amount: number
  cleared: number
  categoryIcon: string | null
  categoryColor: string | null
  categoryName: string | null
  merchantName: string | null
  note: string | null
  rate: number | null
  reimbursementAmountOverride: number | null
  reimbursementComment: string | null
  taxAllocation: TaxAllocationValue | null
}

type LinkedIncome = {
  reimbursementTxId: string
  date: string
  amount: number
  note: string | null
}

type ClaimData = {
  id: string
  month: string
  claimDate: string
  settledAt: string | null
}

type MonthData = {
  month: string
  claim: ClaimData | null
  expenses: MonthExpense[]
  linkedIncomes: LinkedIncome[]
}

type PickerIncome = {
  id: string
  date: string
  amount: number
  note: string | null
  claimedByMonth: string | null
}

interface Props {
  monthData: MonthData[]
  pickerIncomes: PickerIncome[]
  rates: Rate[]
  years: string[]
  selectedYear: number
}

// ---- helpers ----

function reimbursableAmount(expense: MonthExpense): number | null {
  if (expense.reimbursementAmountOverride !== null) return expense.reimbursementAmountOverride
  if (expense.rate === null) return null
  return expense.amount * expense.rate / 100
}

function addMonths(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setMonth(d.getMonth() + n)
  return d.toISOString().slice(0, 10)
}

type StatusTone = 'green' | 'orange' | 'red'

type ClaimStatus = {
  tone: StatusTone
  label: string
  icon: string
  isNoPay: boolean
  isSettled: boolean
}

function getClaimStatus(claim: ClaimData, linkedIncomes: LinkedIncome[]): ClaimStatus {
  const today = new Date().toISOString().slice(0, 10)
  const d1 = addMonths(claim.claimDate, 1)
  const d2 = addMonths(claim.claimDate, 2)

  if (linkedIncomes.length === 0) {
    if (claim.settledAt) {
      return { tone: 'green', label: 'Clôturé', icon: 'check', isNoPay: false, isSettled: true }
    }
    if (today < d1) return { tone: 'green', label: 'En attente de paiement', icon: 'calendar', isNoPay: false, isSettled: false }
    if (today < d2) return { tone: 'orange', label: 'Pas de paiement — 1 mois de retard', icon: 'x', isNoPay: true, isSettled: false }
    return { tone: 'red', label: 'Pas de paiement — +1 mois de retard', icon: 'x', isNoPay: true, isSettled: false }
  }

  const latestDate = [...linkedIncomes].map((i) => i.date).sort().at(-1)!
  const settled = !!claim.settledAt
  if (latestDate < d1) return { tone: 'green', label: settled ? 'Clôturé — Payé dans les délais' : 'Payé dans les délais', icon: 'check', isNoPay: false, isSettled: settled }
  if (latestDate < d2) return { tone: 'orange', label: settled ? 'Clôturé — Payé en retard (< 1 mois)' : 'Payé en retard (< 1 mois)', icon: 'minus', isNoPay: false, isSettled: settled }
  return { tone: 'red', label: settled ? 'Clôturé — Payé en retard (> 1 mois)' : 'Payé en retard (> 1 mois)', icon: 'minus', isNoPay: false, isSettled: settled }
}

const TONE: Record<StatusTone, { ink: string; bg: string; solid: string }> = {
  green: { ink: 'var(--sage-ink)', bg: 'var(--sage-bg)', solid: 'var(--sage)' },
  orange: { ink: 'var(--terracotta-ink)', bg: 'var(--terracotta-bg)', solid: 'var(--terracotta)' },
  red: { ink: 'var(--rose-ink)', bg: 'var(--rose-bg)', solid: 'var(--rose)' },
}

function monthTitle(month: string): string {
  return formatDate(month + '-15T12:00:00', 'fr-FR', { month: 'long', year: 'numeric' })
}

function clearedTotal(expenses: MonthExpense[]): number {
  return Math.round(
    expenses
      .filter((e) => e.cleared === 1)
      .reduce((sum, e) => sum + (reimbursableAmount(e) ?? 0), 0),
  )
}

// ---- main component ----

export function ReimbursementsClient({ monthData, pickerIncomes, rates, years, selectedYear }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [settlementFilter, setSettlementFilter] = useState<'all' | 'unsettled' | 'settled'>('all')
  const [showAllExpenses, setShowAllExpenses] = useState(false)
  const [showRates, setShowRates] = useState(false)
  const [overrideModal, setOverrideModal] = useState<{
    expense: MonthExpense
    draftAmount: string
    draftComment: string
  } | null>(null)

  const filteredMonths = monthData.filter((md) => {
    if (settlementFilter === 'settled') return !!md.claim?.settledAt
    if (settlementFilter === 'unsettled') return !md.claim?.settledAt
    return true
  })

  const handleYearChange = (y: string) => {
    const params = new URLSearchParams(window.location.search)
    params.set('year', y)
    router.push(`?${params.toString()}`)
  }

  const handleSaveOverride = () => {
    if (!overrideModal) return
    const { expense, draftAmount, draftComment } = overrideModal
    const amt = draftAmount ? Number(draftAmount.replace(',', '.')) : null
    setOverrideModal(null)
    startTransition(async () => {
      await setExpenseAmountOverride(expense.id, amt, draftComment.trim() || null)
    })
  }

  const handleClearOverride = () => {
    if (!overrideModal) return
    const { expense } = overrideModal
    setOverrideModal(null)
    startTransition(async () => {
      await setExpenseAmountOverride(expense.id, null, null)
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '32px 0' }}>
      {/* Page header */}
      <header style={{ display: 'grid', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontFamily: 'var(--mono-fern)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--teal-ink)', fontWeight: 700 }}>
            Remboursements
          </div>
          <h1 style={{ fontSize: 28, lineHeight: 1.05, fontWeight: 700, color: 'var(--ink)', margin: '6px 0 0' }}>
            Suivre les remboursements.
          </h1>
        </div>

        {years.length > 0 && (
          <div className="fern-segmented">
            {years.map((y) => (
              <button
                key={y}
                type="button"
                className={String(selectedYear) === y ? 'active' : ''}
                onClick={() => handleYearChange(y)}
              >
                {y}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <SegmentedControl
            value={settlementFilter}
            onChange={(v) => setSettlementFilter(v as typeof settlementFilter)}
            options={[
              { value: 'all', label: 'Tout' },
              { value: 'unsettled', label: 'En cours' },
              { value: 'settled', label: 'Clôturé' },
            ]}
          />
          <SegmentedControl
            value={showAllExpenses ? 'all' : 'cleared'}
            onChange={(v) => setShowAllExpenses(v === 'all')}
            options={[
              { value: 'cleared', label: 'Encaissées uniquement' },
              { value: 'all', label: 'Toutes' },
            ]}
          />
        </div>
      </header>

      {filteredMonths.length === 0 ? (
        <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 14 }}>
          Aucune dépense remboursable.
        </div>
      ) : (
        filteredMonths.map((md) => (
          <MonthContainer
            key={md.month}
            data={md}
            showAllExpenses={showAllExpenses}
            pickerIncomes={pickerIncomes}
            onOpenOverride={(expense) =>
              setOverrideModal({
                expense,
                draftAmount: (reimbursableAmount(expense) ?? '').toString(),
                draftComment: expense.reimbursementComment ?? '',
              })
            }
          />
        ))
      )}

      {/* Rates section */}
      <div style={{ marginTop: 8 }}>
        <button
          type="button"
          onClick={() => setShowRates((v) => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
        >
          <Icon name={showRates ? 'chevronDown' : 'chevronRight'} size={12} />
          Taux de remboursement
        </button>
        {showRates && <RatesSection rates={rates} />}
      </div>

      {/* Amount override modal */}
      {overrideModal && (
        <AmountOverrideModal
          expense={overrideModal.expense}
          draftAmount={overrideModal.draftAmount}
          draftComment={overrideModal.draftComment}
          onDraftAmountChange={(v) => setOverrideModal((m) => m ? { ...m, draftAmount: v } : null)}
          onDraftCommentChange={(v) => setOverrideModal((m) => m ? { ...m, draftComment: v } : null)}
          onSave={handleSaveOverride}
          onClear={handleClearOverride}
          onClose={() => setOverrideModal(null)}
        />
      )}
    </div>
  )
}

// ---- MonthContainer ----

function MonthContainer({
  data,
  showAllExpenses,
  pickerIncomes,
  onOpenOverride,
}: {
  data: MonthData
  showAllExpenses: boolean
  pickerIncomes: PickerIncome[]
  onOpenOverride: (expense: MonthExpense) => void
}) {
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      borderRadius: 16,
      border: '1px solid var(--line-soft)',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        <ExpensesPanel
          month={data.month}
          expenses={data.expenses}
          claim={data.claim}
          showAll={showAllExpenses}
          onOpenOverride={onOpenOverride}
        />
        <div style={{ borderLeft: '1px solid var(--line-soft)' }}>
          <ClaimsPanel
            month={data.month}
            claim={data.claim}
            linkedIncomes={data.linkedIncomes}
            pickerIncomes={pickerIncomes}
          />
        </div>
      </div>
    </div>
  )
}

// ---- ClaimDateInput ----

function isoToDisplay(iso: string): string {
  if (!iso) return ''
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
}

function displayToIso(text: string): string | null {
  const m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const d = m[1].padStart(2, '0'), mo = m[2].padStart(2, '0'), y = m[3]
  if (Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31) return null
  return `${y}-${mo}-${d}`
}

function ClaimDateInput({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const pickerRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState(isoToDisplay(value))

  useEffect(() => { setText(isoToDisplay(value)) }, [value])

  const commit = (raw: string) => {
    if (!raw) { onChange(''); return }
    const iso = displayToIso(raw)
    if (iso) onChange(iso)
    else setText(isoToDisplay(value))
  }

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
      <input
        className="fern-input"
        style={{ flex: 1, fontSize: 12 }}
        value={text}
        placeholder="JJ/MM/AAAA"
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(text) }}
      />
      <div style={{ position: 'relative', flexShrink: 0, width: 24, height: 24 }}>
        <input
          ref={pickerRef}
          type="date"
          value={value}
          onChange={(e) => {
            if (e.target.value) {
              setText(isoToDisplay(e.target.value))
              onChange(e.target.value)
            }
          }}
          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
        />
        <Icon name="calendar" size={14} style={{ color: 'var(--ink-faint)', pointerEvents: 'none', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
      </div>
    </div>
  )
}

// ---- ExpensesPanel ----

function ExpensesPanel({
  month,
  expenses,
  claim,
  showAll,
  onOpenOverride,
}: {
  month: string
  expenses: MonthExpense[]
  claim: ClaimData | null
  showAll: boolean
  onOpenOverride: (expense: MonthExpense) => void
}) {
  const [, startTransition] = useTransition()

  const visible = showAll ? expenses : expenses.filter((e) => e.cleared === 1)
  const total = clearedTotal(expenses)

  const handleClaimDate = (value: string) => {
    startTransition(async () => {
      if (!value) await clearMonthClaimDate(month)
      else await setMonthClaimDate(month, value)
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line-soft)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', textTransform: 'capitalize' }}>
            {monthTitle(month)}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--mono-fern)', color: 'var(--teal-ink)', flexShrink: 0 }}>
            €{total}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', flexShrink: 0, whiteSpace: 'nowrap' }}>
            Date demande
          </label>
          <ClaimDateInput value={claim?.claimDate ?? ''} onChange={handleClaimDate} />
        </div>
      </div>

      <div>
        {visible.length === 0 ? (
          <div style={{ padding: '16px', fontSize: 13, color: 'var(--ink-faint)' }}>
            {showAll ? 'Aucune dépense.' : 'Aucune dépense encaissée.'}
          </div>
        ) : (
          visible.map((expense, i) => (
            <ExpenseRow
              key={expense.id}
              expense={expense}
              isLast={i === visible.length - 1}
              onOpenOverride={onOpenOverride}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ---- ExpenseRow ----

function ExpenseRow({
  expense,
  isLast,
  onOpenOverride,
}: {
  expense: MonthExpense
  isLast: boolean
  onOpenOverride: (expense: MonthExpense) => void
}) {
  const [, startTransition] = useTransition()
  const amount = reimbursableAmount(expense)
  const isOverride = expense.reimbursementAmountOverride !== null

  const pickAllocation = (v: TaxAllocationValue) => {
    startTransition(async () => {
      if (expense.taxAllocation === v) await clearTaxAllocation(expense.id)
      else await setTaxAllocation(expense.id, v)
    })
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'auto 1fr auto',
      gap: 10,
      padding: '10px 16px',
      borderBottom: isLast ? 'none' : '1px solid var(--line-soft)',
      alignItems: 'start',
      opacity: expense.cleared === 0 ? 0.55 : 1,
    }}>
      <CatSwatch color={expense.categoryColor ?? 'teal'} icon={expense.categoryIcon ?? 'tag'} size={28} />

      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          <Link
            href={`/transactions?year=${expense.date.slice(0, 4)}&scrollTo=txn-${expense.id}`}
            style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}
          >
            {expense.merchantName ?? expense.categoryName ?? expense.note ?? '—'}
            <Icon name="arrowUp" size={10} style={{ color: 'var(--ink-faint)', transform: 'rotate(45deg)', flexShrink: 0 }} />
          </Link>
          <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
            {formatDate(expense.date)}
          </span>
          {expense.cleared === 0 && (
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--butter-ink)', background: 'var(--butter-bg)', borderRadius: 4, padding: '1px 5px' }}>
              Non encaissée
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 3, marginTop: 5 }}>
          {(['audrey', 'split', 'lucie'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => pickAllocation(v)}
              style={{
                padding: '2px 7px', borderRadius: 6, border: 'none', fontSize: 11, cursor: 'pointer',
                fontWeight: expense.taxAllocation === v ? 700 : 400,
                background: expense.taxAllocation === v ? 'var(--teal-bg)' : 'var(--bg-sunken)',
                color: expense.taxAllocation === v ? 'var(--teal-ink)' : 'var(--ink-faint)',
              }}
            >
              {v === 'split' ? '50/50' : v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: 'var(--rose-ink)', fontFamily: 'var(--mono-fern)' }}>
          -{fmt(expense.amount)}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {expense.rate !== null && (
            <span style={{ fontSize: 10, color: 'var(--ink-faint)' }}>{expense.rate}%</span>
          )}
          <span style={{
            fontSize: 13, fontWeight: 700, fontFamily: 'var(--mono-fern)',
            color: isOverride ? 'var(--terracotta-ink)' : 'var(--ink)',
          }}>
            {amount !== null
              ? amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              : '—'}
          </span>
          <button
            type="button"
            onClick={() => onOpenOverride(expense)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: isOverride ? 'var(--terracotta-ink)' : 'var(--ink-faint)', padding: 2, display: 'grid', placeItems: 'center' }}
            title={isOverride ? 'Montant personnalisé' : 'Modifier le montant'}
          >
            <Icon name="edit" size={12} />
          </button>
        </div>
        {expense.reimbursementComment && (
          <span style={{ fontSize: 10, color: 'var(--terracotta-ink)', maxWidth: 110, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {expense.reimbursementComment}
          </span>
        )}
      </div>
    </div>
  )
}

// ---- ClaimsPanel ----

function ClaimsPanel({
  month,
  claim,
  linkedIncomes,
  pickerIncomes,
}: {
  month: string
  claim: ClaimData | null
  linkedIncomes: LinkedIncome[]
  pickerIncomes: PickerIncome[]
}) {
  const [, startTransition] = useTransition()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())

  if (!claim) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120, padding: 24 }}>
        <div style={{ textAlign: 'center', color: 'var(--ink-faint)', fontSize: 12, lineHeight: 1.5 }}>
          <Icon name="calendar" size={18} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.35 }} />
          Saisir une date de demande<br />pour suivre le remboursement
        </div>
      </div>
    )
  }

  const status = getClaimStatus(claim, linkedIncomes)
  const colors = TONE[status.tone]

  const alreadyLinkedIds = new Set(linkedIncomes.map((i) => i.reimbursementTxId))

  // Eligible: date >= claimDate, not claimed by a different month
  const eligible = pickerIncomes
    .filter((inc) =>
      inc.date >= claim.claimDate &&
      (inc.claimedByMonth === null || inc.claimedByMonth === month),
    )
    .sort((a, b) => a.date.localeCompare(b.date))

  const handleLinkSelected = () => {
    const toLink = [...pendingIds].filter((id) => !alreadyLinkedIds.has(id))
    startTransition(async () => {
      for (const id of toLink) {
        await linkIncomeToClaim(month, id)
      }
    })
    setPendingIds(new Set())
    setPickerOpen(false)
  }

  const handleDetachAll = () => {
    startTransition(async () => {
      await unlinkAllFromClaim(month)
    })
  }

  const handleToggleSettled = () => {
    startTransition(async () => {
      await setMonthClaimSettled(month, !claim.settledAt)
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Status header */}
      <div style={{
        padding: '14px 16px', borderBottom: '1px solid var(--line-soft)',
        background: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name={status.icon} size={13} style={{ color: colors.ink }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: colors.ink }}>{status.label}</span>
        </div>
        <button
          type="button"
          onClick={handleToggleSettled}
          style={{
            fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: status.isSettled ? 'var(--bg-elevated)' : colors.solid,
            color: status.isSettled ? colors.ink : 'white',
          }}
        >
          {status.isSettled ? 'Rouvrir' : 'Clôturer'}
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Linked incomes */}
        {linkedIncomes.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {linkedIncomes.map((inc) => (
              <div key={inc.reimbursementTxId} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontSize: 12, padding: '6px 10px', background: 'var(--bg-sunken)', borderRadius: 8,
              }}>
                <span style={{ color: 'var(--ink-soft)' }}>
                  {formatDate(inc.date)}
                  {inc.note && (
                    <span style={{ color: 'var(--ink-faint)', marginLeft: 6 }}>{inc.note}</span>
                  )}
                </span>
                <span style={{ fontWeight: 700, fontFamily: 'var(--mono-fern)', color: 'var(--sage-ink)' }}>
                  +{fmt(inc.amount)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => { setPickerOpen((v) => !v); setPendingIds(new Set()) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: pickerOpen ? 'var(--bg-sunken)' : 'var(--teal-bg)',
              color: pickerOpen ? 'var(--ink-soft)' : 'var(--teal-ink)',
            }}
          >
            <Icon name={pickerOpen ? 'x' : 'plus'} size={11} />
            {pickerOpen ? 'Fermer' : 'Ajouter'}
          </button>
          {linkedIncomes.length > 0 && (
            <button
              type="button"
              onClick={handleDetachAll}
              style={{
                fontSize: 12, padding: '5px 12px', borderRadius: 8, border: '1px solid var(--line)', cursor: 'pointer',
                background: 'transparent', color: 'var(--ink-soft)',
              }}
            >
              Tout détacher
            </button>
          )}
        </div>

        {/* Income picker */}
        {pickerOpen && (
          <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{
              padding: '8px 10px', background: 'var(--bg-sunken)', borderBottom: '1px solid var(--line-soft)',
              fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)',
            }}>
              Remboursements reçus après le {formatDate(claim.claimDate)}
            </div>
            {eligible.length === 0 ? (
              <div style={{ padding: '12px 10px', fontSize: 12, color: 'var(--ink-faint)' }}>
                Aucun remboursement disponible.
              </div>
            ) : (
              eligible.map((inc) => {
                const isLinked = alreadyLinkedIds.has(inc.id)
                const isPending = pendingIds.has(inc.id)
                return (
                  <label
                    key={inc.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                      borderBottom: '1px solid var(--line-soft)', cursor: isLinked ? 'default' : 'pointer',
                      background: isLinked ? 'var(--sage-bg)' : 'transparent',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isLinked || isPending}
                      disabled={isLinked}
                      onChange={(e) =>
                        setPendingIds((prev) => {
                          const next = new Set(prev)
                          if (e.target.checked) next.add(inc.id)
                          else next.delete(inc.id)
                          return next
                        })
                      }
                    />
                    <span style={{ flex: 1, fontSize: 12, color: 'var(--ink)' }}>
                      {formatDate(inc.date)}
                      {inc.note && <span style={{ color: 'var(--ink-faint)', marginLeft: 5 }}>{inc.note}</span>}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--mono-fern)', color: 'var(--sage-ink)', flexShrink: 0 }}>
                      +{fmt(inc.amount)}
                    </span>
                    {isLinked && (
                      <span style={{ fontSize: 10, color: 'var(--sage-ink)', flexShrink: 0 }}>Lié</span>
                    )}
                  </label>
                )
              })
            )}
            {pendingIds.size > 0 && (
              <div style={{ padding: '8px 10px', display: 'flex', gap: 6, borderTop: '1px solid var(--line-soft)', background: 'var(--bg-sunken)' }}>
                <button
                  type="button"
                  onClick={handleLinkSelected}
                  style={{ fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--teal)', color: 'white' }}
                >
                  Lier {pendingIds.size} sélection{pendingIds.size > 1 ? 's' : ''}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ---- AmountOverrideModal ----

function AmountOverrideModal({
  expense,
  draftAmount,
  draftComment,
  onDraftAmountChange,
  onDraftCommentChange,
  onSave,
  onClear,
  onClose,
}: {
  expense: MonthExpense
  draftAmount: string
  draftComment: string
  onDraftAmountChange: (v: string) => void
  onDraftCommentChange: (v: string) => void
  onSave: () => void
  onClear: () => void
  onClose: () => void
}) {
  return (
    <div
      role="dialog"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--bg-elevated)', borderRadius: 16, padding: 24, width: 340, boxShadow: '0 12px 48px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: 14 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
          Modifier le montant remboursable
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
          {expense.merchantName ?? expense.categoryName ?? expense.note ?? '—'} · {formatDate(expense.date)}
          {expense.rate !== null && (
            <span style={{ marginLeft: 8, color: 'var(--ink-faint)' }}>Taux : {expense.rate}%</span>
          )}
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', display: 'block', marginBottom: 4 }}>
            Montant (€)
          </label>
          <input
            className="fern-input"
            type="number"
            step="0.01"
            min="0"
            value={draftAmount}
            onChange={(e) => onDraftAmountChange(e.target.value)}
            placeholder="0.00"
            autoFocus
          />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', display: 'block', marginBottom: 4 }}>
            Commentaire (optionnel)
          </label>
          <input
            className="fern-input"
            value={draftComment}
            onChange={(e) => onDraftCommentChange(e.target.value)}
            placeholder="Raison de la modification…"
          />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            type="button"
            onClick={onClear}
            style={{ fontSize: 11, padding: '6px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--bg-sunken)', color: 'var(--ink-soft)' }}
          >
            Rétablir le calcul
          </button>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ fontSize: 12, padding: '7px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--bg-sunken)', color: 'var(--ink-soft)' }}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={onSave}
              style={{ fontSize: 12, fontWeight: 600, padding: '7px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--teal)', color: 'white' }}
            >
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- RatesSection ----

function RatesSection({ rates }: { rates: Rate[] }) {
  const [, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [ratePercent, setRatePercent] = useState('')
  const [rateDate, setRateDate] = useState(new Date().toISOString().slice(0, 10))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPercent, setEditPercent] = useState('')
  const [editDate, setEditDate] = useState('')

  const handleAdd = () => {
    const pct = Number(ratePercent.replace(',', '.'))
    if (!pct || !rateDate) return
    startTransition(async () => { await addReimbursementRate(pct, rateDate) })
    setShowForm(false)
    setRatePercent('')
    setRateDate(new Date().toISOString().slice(0, 10))
  }

  const handleSaveEdit = () => {
    if (!editingId) return
    const pct = Number(editPercent.replace(',', '.'))
    if (!pct || !editDate) return
    startTransition(async () => { await updateReimbursementRate(editingId, pct, editDate) })
    setEditingId(null)
  }

  const handleDelete = (id: string) => {
    startTransition(async () => { await deleteReimbursementRate(id) })
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
          {rates.length} taux configuré{rates.length !== 1 ? 's' : ''}
        </span>
        <button
          type="button"
          onClick={() => { setShowForm((v) => !v); setEditingId(null) }}
          style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--terracotta-ink)', background: 'var(--terracotta-bg)', border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}
        >
          <Icon name="plus" size={12} /> Nouveau taux
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: 14, marginBottom: 10, display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 140px' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', display: 'block', marginBottom: 3 }}>Taux (%)</label>
            <input className="fern-input" placeholder="ex: 75" inputMode="decimal" value={ratePercent} onChange={(e) => setRatePercent(e.target.value)} />
          </div>
          <div style={{ flex: '1 1 160px' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', display: 'block', marginBottom: 3 }}>Applicable dès le</label>
            <input className="fern-input" type="date" value={rateDate} onChange={(e) => setRateDate(e.target.value)} />
          </div>
          <button type="button" onClick={handleAdd} style={{ background: 'var(--terracotta)', color: 'white', border: 'none', borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Ajouter</button>
          <button type="button" onClick={() => setShowForm(false)} style={{ background: 'var(--bg-sunken)', color: 'var(--ink-soft)', border: 'none', borderRadius: 10, padding: '9px 14px', fontSize: 13, cursor: 'pointer' }}>Annuler</button>
        </div>
      )}

      {rates.length > 0 && (
        <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, overflow: 'hidden' }}>
          {rates.map((rate, i) =>
            editingId === rate.id ? (
              <div key={rate.id} style={{ padding: '10px 14px', borderBottom: i < rates.length - 1 ? '1px solid var(--line-soft)' : undefined, display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 120px' }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', display: 'block', marginBottom: 3 }}>Taux (%)</label>
                  <input className="fern-input" placeholder="ex: 75" inputMode="decimal" value={editPercent} onChange={(e) => setEditPercent(e.target.value)} />
                </div>
                <div style={{ flex: '1 1 140px' }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', display: 'block', marginBottom: 3 }}>Applicable dès le</label>
                  <input className="fern-input" type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                </div>
                <button type="button" onClick={handleSaveEdit} style={{ background: 'var(--teal)', color: 'white', border: 'none', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', height: 36 }}><Icon name="check" size={14} /></button>
                <button type="button" onClick={() => setEditingId(null)} style={{ background: 'var(--bg-sunken)', color: 'var(--ink-soft)', border: 'none', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', height: 36 }}><Icon name="x" size={14} /></button>
              </div>
            ) : (
              <div key={rate.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: i < rates.length - 1 ? '1px solid var(--line-soft)' : undefined }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{i === 0 ? 'Taux actuel' : 'Taux historique'}</div>
                  <div style={{ fontSize: i === 0 ? 20 : 14, fontWeight: 700, color: i === 0 ? 'var(--teal-ink)' : 'var(--ink)' }}>{rate.percent}%</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>dès le {formatDate(rate.startDate)}</span>
                  <button type="button" onClick={() => { setEditingId(rate.id); setEditPercent(String(rate.percent)); setEditDate(rate.startDate) }} style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', cursor: 'pointer', padding: 4 }} title="Modifier"><Icon name="edit" size={14} /></button>
                  {i > 0 && (
                    <button type="button" onClick={() => handleDelete(rate.id)} style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', cursor: 'pointer', padding: 4 }} title="Supprimer"><Icon name="trash" size={14} /></button>
                  )}
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  )
}
