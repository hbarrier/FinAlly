'use client'

import { useState, useTransition, useMemo } from 'react'
import { Icon } from '@/components/fern/icon'
import { ReimbursementSheet } from '@/components/fern/sheets/reimbursement-sheet'
import { fmt, formatDate } from '@/lib/derive'
import type {
  ReimbursementRate as Rate,
  Transaction as PensionTx,
} from '@/lib/db-types'
import {
  addReimbursementRate,
  updateReimbursementRate,
  deleteReimbursementRate,
  recordReimbursement,
  deleteReimbursement,
} from '@/lib/actions/reimbursements'

interface Expense {
  id: string
  date: string
  amount: number
  merchantName: string | null
  reimbursementTxId: string | null
  claimedDate: string | null
  reimbursement: { date: string; amount: number } | null
  applicableRate: number | null
}

interface Props {
  expenses: Expense[]
  pensionTxs: PensionTx[]
  rates: Rate[]
}

function addOneMonth(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  d.setMonth(d.getMonth() + 1)
  return d.toISOString().slice(0, 10)
}

// Annual summary helpers
function groupByYear(items: { date: string; amount: number }[]) {
  const map: Record<string, number> = {}
  items.forEach(({ date, amount }) => {
    const year = date.slice(0, 4)
    map[year] = (map[year] ?? 0) + amount
  })
  return map
}

export function ReimbursementsClient({ expenses, pensionTxs, rates }: Props) {
  const [, startTransition] = useTransition()
  const [sheetExpense, setSheetExpense] = useState<Expense | null>(null)

  // --- Add rate state ---
  const [showRateForm, setShowRateForm] = useState(false)
  const [ratePercent, setRatePercent] = useState('')
  const [rateDate, setRateDate] = useState(new Date().toISOString().slice(0, 10))

  // --- Edit rate state ---
  const [editingRateId, setEditingRateId] = useState<string | null>(null)
  const [editPercent, setEditPercent] = useState('')
  const [editDate, setEditDate] = useState('')

  // --- Rate management ---
  const currentRate = rates[0] ?? null

  const handleAddRate = () => {
    const pct = Number(ratePercent.replace(',', '.'))
    if (!pct || !rateDate) return
    startTransition(async () => {
      await addReimbursementRate(pct, rateDate)
    })
    setShowRateForm(false)
    setRatePercent('')
    setRateDate(new Date().toISOString().slice(0, 10))
  }

  const handleStartEditRate = (rate: Rate) => {
    setEditingRateId(rate.id)
    setEditPercent(String(rate.percent))
    setEditDate(rate.startDate)
    setShowRateForm(false)
  }

  const handleSaveEditRate = () => {
    if (!editingRateId) return
    const pct = Number(editPercent.replace(',', '.'))
    if (!pct || !editDate) return
    startTransition(async () => {
      await updateReimbursementRate(editingRateId, pct, editDate)
    })
    setEditingRateId(null)
  }

  const handleDeleteRate = (id: string) => {
    startTransition(async () => {
      await deleteReimbursementRate(id)
    })
  }

  // --- Reimbursement actions ---
  const handleSaveReimbursement = (expenseId: string, date: string, amount: number, claimedDate: string | null) => {
    startTransition(async () => {
      await recordReimbursement(expenseId, date, amount, claimedDate)
    })
  }

  const handleDeleteReimbursement = (expenseId: string) => {
    startTransition(async () => {
      await deleteReimbursement(expenseId)
    })
  }

  // --- Annual summary ---
  const reimbByYear = useMemo(() => {
    const settled = expenses
      .filter((e) => e.reimbursement != null)
      .map((e) => ({ date: e.reimbursement!.date, amount: e.reimbursement!.amount }))
    return groupByYear(settled)
  }, [expenses])

  const pensionByYear = useMemo(() => {
    return groupByYear(pensionTxs.map((t) => ({ date: t.date, amount: t.amount })))
  }, [pensionTxs])

  const allYears = useMemo(() => {
    const ys = new Set([...Object.keys(reimbByYear), ...Object.keys(pensionByYear)])
    return [...ys].sort((a, b) => b.localeCompare(a))
  }, [reimbByYear, pensionByYear])

  const today = new Date().toISOString().slice(0, 10)
  const pending = expenses.filter((e) => !e.reimbursement)
  const settled = expenses.filter((e) => e.reimbursement)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32, padding: '32px 0' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>Remboursements</h1>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '4px 0 0' }}>
          Dépenses remboursables et pension alimentaire
        </p>
      </div>

      {/* ── Section A: Rate configuration ── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>Taux de remboursement</h2>
          <button
            onClick={() => { setShowRateForm((v) => !v); setEditingRateId(null) }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--terracotta-ink)', background: 'var(--terracotta-bg)', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}
          >
            <Icon name="plus" size={12} /> Nouveau taux
          </button>
        </div>

        {/* Add rate form */}
        {showRateForm && (
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: 16, marginBottom: 12, display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', display: 'block', marginBottom: 4 }}>Taux (%)</label>
              <input
                className="fern-input"
                placeholder="ex: 75"
                inputMode="decimal"
                value={ratePercent}
                onChange={(e) => setRatePercent(e.target.value)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', display: 'block', marginBottom: 4 }}>À partir du</label>
              <input
                className="fern-input"
                type="date"
                value={rateDate}
                onChange={(e) => setRateDate(e.target.value)}
              />
            </div>
            <button
              onClick={handleAddRate}
              style={{ background: 'var(--terracotta)', color: 'white', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Ajouter
            </button>
            <button
              onClick={() => setShowRateForm(false)}
              style={{ background: 'var(--bg-sunken)', color: 'var(--ink-soft)', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13, cursor: 'pointer' }}
            >
              Annuler
            </button>
          </div>
        )}

        {currentRate ? (
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, overflow: 'hidden' }}>
            {/* Current rate */}
            {editingRateId === currentRate.id ? (
              <RateEditRow
                percent={editPercent}
                date={editDate}
                onPercentChange={setEditPercent}
                onDateChange={setEditDate}
                onSave={handleSaveEditRate}
                onCancel={() => setEditingRateId(null)}
              />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: rates.length > 1 ? '1px solid var(--line)' : undefined }}>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Taux actuel</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--teal-ink)' }}>{currentRate.percent}%</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>depuis le</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{formatDate(currentRate.startDate)}</div>
                  </div>
                  <button
                    onClick={() => handleStartEditRate(currentRate)}
                    style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', cursor: 'pointer', padding: 4 }}
                    title="Modifier"
                  >
                    <Icon name="edit" size={14} />
                  </button>
                </div>
              </div>
            )}
            {/* Rate history */}
            {rates.slice(1).map((r) => (
              editingRateId === r.id ? (
                <RateEditRow
                  key={r.id}
                  percent={editPercent}
                  date={editDate}
                  onPercentChange={setEditPercent}
                  onDateChange={setEditDate}
                  onSave={handleSaveEditRate}
                  onCancel={() => setEditingRateId(null)}
                />
              ) : (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                    <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{r.percent}%</span> à partir du {formatDate(r.startDate)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button
                      onClick={() => handleStartEditRate(r)}
                      style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', cursor: 'pointer', padding: 4 }}
                      title="Modifier"
                    >
                      <Icon name="edit" size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteRate(r.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', cursor: 'pointer', padding: 4 }}
                      title="Supprimer"
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </div>
              )
            ))}
          </div>
        ) : (
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: '20px 16px', color: 'var(--ink-soft)', fontSize: 13, textAlign: 'center' }}>
            Aucun taux configuré. Ajoutez un taux pour calculer les remboursements attendus.
          </div>
        )}
      </section>

      {/* ── Section B: Reimbursable expenses ── */}
      <section>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', margin: '0 0 12px' }}>
          Dépenses remboursables
          {expenses.length > 0 && (
            <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color: 'var(--ink-soft)' }}>
              {pending.length} en attente · {settled.length} remboursées
            </span>
          )}
        </h2>

        {expenses.length === 0 ? (
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: '24px 16px', color: 'var(--ink-soft)', fontSize: 13, textAlign: 'center' }}>
            Aucune dépense remboursable. Cochez &laquo;&nbsp;Remboursable&nbsp;&raquo; lors de la saisie d&rsquo;une dépense.
          </div>
        ) : (
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, overflow: 'hidden' }}>
            {/* Pending */}
            {pending.map((e, i) => {
              const dueDate = e.claimedDate ? addOneMonth(e.claimedDate) : null
              const isOverdue = dueDate != null && dueDate < today
              return (
                <button
                  key={e.id}
                  onClick={() => setSheetExpense(e)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    background: 'none',
                    border: 'none',
                    borderBottom: i < pending.length - 1 || settled.length > 0 ? '1px solid var(--line)' : undefined,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                        {e.merchantName ?? '—'}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{formatDate(e.date)}</span>
                    </div>
                    {e.applicableRate != null && (
                      <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
                        Attendu {fmt(Math.round(e.amount * e.applicableRate / 100))} ({e.applicableRate}%)
                      </div>
                    )}
                    {e.claimedDate && (
                      <div style={{ fontSize: 11, marginTop: 2, display: 'flex', gap: 8 }}>
                        <span style={{ color: 'var(--ink-soft)' }}>Déclaré le {formatDate(e.claimedDate)}</span>
                        {dueDate && (
                          <span style={{ color: isOverdue ? 'var(--rose-ink)' : 'var(--ink-soft)', fontWeight: isOverdue ? 600 : 400 }}>
                            · Échéance {formatDate(dueDate)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--rose-ink)' }}>{fmt(e.amount)}</div>
                    <div style={{ marginTop: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--terracotta-ink)', background: 'var(--terracotta-bg)', borderRadius: 6, padding: '2px 7px' }}>En attente</span>
                    </div>
                  </div>
                </button>
              )
            })}

            {/* Settled */}
            {settled.map((e, i) => (
              <button
                key={e.id}
                onClick={() => setSheetExpense(e)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: i < settled.length - 1 ? '1px solid var(--line)' : undefined,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                      {e.merchantName ?? '—'}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{formatDate(e.date)}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {e.claimedDate && <span>Déclaré le {formatDate(e.claimedDate)}</span>}
                    <span>Reçu le {formatDate(e.reimbursement!.date)}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--rose-ink)' }}>{fmt(e.amount)}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal-ink)', marginTop: 2 }}>
                    +{fmt(e.reimbursement!.amount)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── Section C: Pension alimentaire ── */}
      <section>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', margin: '0 0 12px' }}>
          Pension alimentaire
        </h2>
        {pensionTxs.length === 0 ? (
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: '24px 16px', color: 'var(--ink-soft)', fontSize: 13, textAlign: 'center' }}>
            Aucun versement enregistré. Ajoutez un revenu avec la catégorie &laquo;&nbsp;Pension alimentaire&nbsp;&raquo;.
          </div>
        ) : (
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, overflow: 'hidden' }}>
            {pensionTxs.map((t, i) => (
              <div
                key={t.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderBottom: i < pensionTxs.length - 1 ? '1px solid var(--line)' : undefined,
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                    {formatDate(t.date)}
                  </div>
                  {t.note && <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>{t.note}</div>}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--teal-ink)' }}>
                  +{fmt(t.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Section D: Annual summary ── */}
      {allYears.length > 0 && (
        <section>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', margin: '0 0 12px' }}>
            Récapitulatif annuel
            <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--ink-soft)', marginLeft: 8 }}>
              basé sur la date de réception
            </span>
          </h2>
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, overflow: 'hidden' }}>
            {/* Header row */}
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr', gap: 8, padding: '10px 16px', background: 'var(--bg-sunken)', borderBottom: '1px solid var(--line)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)' }}>Année</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', textAlign: 'right' }}>Remboursements</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', textAlign: 'right' }}>Pension alim.</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', textAlign: 'right' }}>Total</div>
            </div>
            {allYears.map((year, i) => {
              const reimb = reimbByYear[year] ?? 0
              const pension = pensionByYear[year] ?? 0
              const total = reimb + pension
              return (
                <div
                  key={year}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '80px 1fr 1fr 1fr',
                    gap: 8,
                    padding: '12px 16px',
                    borderBottom: i < allYears.length - 1 ? '1px solid var(--line)' : undefined,
                    alignItems: 'center',
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{year}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: reimb > 0 ? 'var(--teal-ink)' : 'var(--ink-faint)', textAlign: 'right' }}>
                    {reimb > 0 ? fmt(reimb) : '—'}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: pension > 0 ? 'var(--teal-ink)' : 'var(--ink-faint)', textAlign: 'right' }}>
                    {pension > 0 ? fmt(pension) : '—'}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--teal-ink)', textAlign: 'right' }}>
                    {fmt(total)}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Reimbursement sheet */}
      {sheetExpense && (
        <ReimbursementSheet
          open={sheetExpense != null}
          onClose={() => setSheetExpense(null)}
          expense={sheetExpense}
          applicableRate={sheetExpense.applicableRate}
          existingReimbursement={sheetExpense.reimbursement}
          onSave={(date, amount, claimedDate) => handleSaveReimbursement(sheetExpense.id, date, amount, claimedDate)}
          onDelete={sheetExpense.reimbursement ? () => handleDeleteReimbursement(sheetExpense.id) : undefined}
        />
      )}
    </div>
  )
}

function RateEditRow({
  percent,
  date,
  onPercentChange,
  onDateChange,
  onSave,
  onCancel,
}: {
  percent: string
  date: string
  onPercentChange: (v: string) => void
  onDateChange: (v: string) => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
      <div style={{ flex: 1 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', display: 'block', marginBottom: 4 }}>Taux (%)</label>
        <input
          className="fern-input"
          placeholder="ex: 75"
          inputMode="decimal"
          value={percent}
          onChange={(e) => onPercentChange(e.target.value)}
        />
      </div>
      <div style={{ flex: 1 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', display: 'block', marginBottom: 4 }}>À partir du</label>
        <input
          className="fern-input"
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
        />
      </div>
      <button
        onClick={onSave}
        style={{ background: 'var(--teal)', color: 'white', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', height: 38 }}
      >
        <Icon name="check" size={14} />
      </button>
      <button
        onClick={onCancel}
        style={{ background: 'var(--bg-sunken)', color: 'var(--ink-soft)', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 13, cursor: 'pointer', height: 38 }}
      >
        <Icon name="x" size={14} />
      </button>
    </div>
  )
}
