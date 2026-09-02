'use client'

import { useEffect, useState } from 'react'
import { SheetShell } from '../sheet-shell'
import { Icon } from '../icon'
import { parseDecimal } from '@/lib/utils'
import { todayISO } from '@/lib/dates'
import {
  PAYMENT_METHODS,
  paymentMethodLabel,
  defaultPaymentMethodForKind,
  type PaymentMethod,
} from '@/lib/payment-method'
import type { Category, GroupMember, GroupReimbursement, GroupStatement } from '@/lib/db-types'

export type GroupReimbursementSaveData = {
  date: string
  amount: number
  direction: 'paid' | 'received'
  memberId: string
  note: string | null
  categoryId: string | null
  method: PaymentMethod
  statementId: string | null
}

interface GroupReimbursementSheetProps {
  open: boolean
  onClose: () => void
  members: GroupMember[]
  categories: Category[]
  statements: GroupStatement[]
  item?: GroupReimbursement | null
  linkedMeta?: { categoryId: string | null; method: PaymentMethod } | null
  onSave: (data: GroupReimbursementSaveData) => void
  onDelete?: () => void
}

export function GroupReimbursementSheet({
  open,
  onClose,
  members,
  categories,
  statements,
  item,
  linkedMeta,
  onSave,
  onDelete,
}: GroupReimbursementSheetProps) {
  const others = members.filter((m) => m.isSelf !== 1)
  const [direction, setDirection] = useState<'paid' | 'received'>('paid')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [memberId, setMemberId] = useState(others[0]?.id ?? '')
  const [note, setNote] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('transfer')
  const [statementId, setStatementId] = useState('')

  useEffect(() => {
    if (!open) return
    const dir = item?.direction ?? 'paid'
    setDirection(dir)
    setAmount(item ? String(item.amount) : '')
    setDate(item?.date ?? todayISO())
    setMemberId(item?.memberId ?? others[0]?.id ?? '')
    setNote(item?.note ?? '')
    setCategoryId(linkedMeta?.categoryId ?? '')
    setMethod(linkedMeta?.method ?? defaultPaymentMethodForKind(dir === 'paid' ? 'expense' : 'income'))
    setStatementId(item?.statementId ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const amountNum = parseDecimal(amount)
  const valid = amountNum > 0 && date.length === 10 && memberId !== ''
  const kind = direction === 'paid' ? 'expense' : 'income'
  const catOptions = categories.filter((c) => c.kind === kind && c.isActive === 1)

  const submit = () => {
    onSave({
      date,
      amount: amountNum,
      direction,
      memberId,
      note: note.trim() || null,
      categoryId: categoryId || null,
      method,
      statementId: statementId || null,
    })
    onClose()
  }

  const deleteAction =
    item && onDelete ? (
      <button
        type="button"
        onClick={() => {
          onDelete()
          onClose()
        }}
        className="fern-btn sheet-delete"
      >
        <Icon name="trash" size={14} /> Delete
      </button>
    ) : undefined

  return (
    <SheetShell
      open={open}
      onClose={onClose}
      title={item ? 'Edit reimbursement' : 'Record a reimbursement'}
      primary={{ label: item ? 'Save' : 'Record', icon: 'check', onClick: submit, disabled: !valid }}
      secondaryAction={deleteAction}
    >
      <div className="fern-type-toggle" style={{ marginBottom: 0 }}>
        <button
          type="button"
          className={direction === 'paid' ? 'active expense' : ''}
          onClick={() => setDirection('paid')}
        >
          <Icon name="arrowDown" size={14} /> I paid them
        </button>
        <button
          type="button"
          className={direction === 'received' ? 'active income' : ''}
          onClick={() => setDirection('received')}
        >
          <Icon name="arrowUp" size={14} /> They paid me
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label className="fern-field-label">Amount</label>
          <input
            className="fern-input"
            inputMode="decimal"
            placeholder="0,00"
            value={amount}
            autoFocus
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label className="fern-field-label">Date</label>
          <input type="date" className="fern-input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="fern-field-label">{direction === 'paid' ? 'Paid to' : 'Received from'}</label>
        <select className="fern-input" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
          {others.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label className="fern-field-label">Category</label>
          <select className="fern-input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">No category</option>
            {catOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label className="fern-field-label">Method</label>
          <select
            className="fern-input"
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {paymentMethodLabel(m)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="fern-field-label">Note</label>
        <input
          className="fern-input"
          placeholder="Optional"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {statements.length > 0 && (
        <div>
          <label className="fern-field-label">Attach to statement (optional)</label>
          <select
            className="fern-input"
            value={statementId}
            onChange={(e) => setStatementId(e.target.value)}
          >
            <option value="">None</option>
            {statements.map((s) => (
              <option key={s.id} value={s.id}>
                {s.periodFrom} → {s.periodTo}
              </option>
            ))}
          </select>
        </div>
      )}

      <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: 0 }}>
        This adds a matching {kind} movement to your ledger.
      </p>
    </SheetShell>
  )
}
