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
import type { Category, GroupMember } from '@/lib/db-types'
import type { GroupEntryFull } from '@/lib/queries/groups'

export type GroupEntrySaveData = {
  date: string
  amount: number
  direction: 'expense' | 'income'
  description: string | null
  payerId: string
  involvesAll: boolean
  participantMemberIds: string[]
  overrides: { memberId: string; amount: number; comment: string | null }[]
  categoryId: string | null
  method: PaymentMethod
}

interface GroupEntrySheetProps {
  open: boolean
  onClose: () => void
  members: GroupMember[]
  categories: Category[]
  selfId: string | null
  item?: GroupEntryFull | null
  linkedMeta?: { categoryId: string | null; method: PaymentMethod } | null
  onSave: (data: GroupEntrySaveData) => void
  onDelete?: () => void
}

export function GroupEntrySheet({
  open,
  onClose,
  members,
  categories,
  selfId,
  item,
  linkedMeta,
  onSave,
  onDelete,
}: GroupEntrySheetProps) {
  const [direction, setDirection] = useState<'expense' | 'income'>('expense')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [description, setDescription] = useState('')
  const [payerId, setPayerId] = useState(selfId ?? members[0]?.id ?? '')
  const [involvesAll, setInvolvesAll] = useState(true)
  const [participants, setParticipants] = useState<Set<string>>(new Set(members.map((m) => m.id)))
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [showOverrides, setShowOverrides] = useState(false)
  const [categoryId, setCategoryId] = useState<string>('')
  const [method, setMethod] = useState<PaymentMethod>('card')

  useEffect(() => {
    if (!open) return
    const dir = item?.direction ?? 'expense'
    setDirection(dir)
    setAmount(item ? String(item.amount) : '')
    setDate(item?.date ?? todayISO())
    setDescription(item?.description ?? '')
    setPayerId(item?.payerId ?? selfId ?? members[0]?.id ?? '')
    setInvolvesAll(item ? item.involvesAll === 1 : true)
    setParticipants(
      new Set(
        item && item.involvesAll === 0
          ? item.participants.map((p) => p.memberId)
          : members.map((m) => m.id),
      ),
    )
    const ov: Record<string, string> = {}
    for (const o of item?.overrides ?? []) ov[o.memberId] = String(o.amount)
    setOverrides(ov)
    setShowOverrides((item?.overrides.length ?? 0) > 0)
    setCategoryId(linkedMeta?.categoryId ?? '')
    setMethod(linkedMeta?.method ?? defaultPaymentMethodForKind(dir))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const activeParticipants = involvesAll
    ? members.map((m) => m.id)
    : members.filter((m) => participants.has(m.id)).map((m) => m.id)

  const overrideRows = activeParticipants
    .map((id) => ({ memberId: id, amount: parseDecimal(overrides[id] ?? '') }))
    .filter((o) => (overrides[o.memberId] ?? '').trim() !== '' && o.amount > 0)

  const isAllocated = !!item && item.ownsTransaction === 0 && !!item.transactionId
  const amountNum = parseDecimal(amount)
  const payerIsSelf = payerId === selfId
  const overrideTotal = overrideRows.reduce((s, o) => s + o.amount, 0)

  const valid =
    amountNum > 0 &&
    date.length === 10 &&
    payerId !== '' &&
    activeParticipants.length > 0 &&
    overrideTotal <= amountNum + 0.005

  const memberName = new Map(members.map((m) => [m.id, m.name]))
  const catOptions = categories.filter((c) => c.kind === direction && c.isActive === 1)

  const submit = () => {
    onSave({
      date,
      amount: amountNum,
      direction,
      description: description.trim() || null,
      payerId,
      involvesAll,
      participantMemberIds: involvesAll ? [] : activeParticipants,
      overrides: overrideRows.map((o) => ({ memberId: o.memberId, amount: o.amount, comment: null })),
      categoryId: payerIsSelf && categoryId ? categoryId : null,
      method,
    })
    onClose()
  }

  const toggleParticipant = (id: string) =>
    setParticipants((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

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
      title={item ? 'Edit shared item' : 'Add shared item'}
      primary={{ label: item ? 'Save' : 'Add', icon: 'check', onClick: submit, disabled: !valid }}
      secondaryAction={deleteAction}
    >
      {isAllocated && (
        <div style={{ fontSize: 12, color: 'var(--ink-faint)', padding: '8px 12px', background: 'var(--bg-sunken)', borderRadius: 8 }}>
          Linked to a movement. Amount, date and payer come from your ledger — only the split is
          editable here.
        </div>
      )}

      <div className="fern-type-toggle" style={{ marginBottom: 0 }}>
        <button
          type="button"
          className={direction === 'expense' ? 'active expense' : ''}
          disabled={isAllocated}
          onClick={() => setDirection('expense')}
        >
          <Icon name="arrowDown" size={14} /> Shared expense
        </button>
        <button
          type="button"
          className={direction === 'income' ? 'active income' : ''}
          disabled={isAllocated}
          onClick={() => setDirection('income')}
        >
          <Icon name="arrowUp" size={14} /> Shared revenue
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
            disabled={isAllocated}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label className="fern-field-label">Date</label>
          <input
            type="date"
            className="fern-input"
            value={date}
            disabled={isAllocated}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="fern-field-label">Description</label>
        <input
          className="fern-input"
          placeholder="What was this for?"
          value={description}
          disabled={isAllocated}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {!isAllocated && (
      <div>
        <label className="fern-field-label">Paid by</label>
        <select className="fern-input" value={payerId} onChange={(e) => setPayerId(e.target.value)}>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.id === selfId ? ' (you)' : ''}
            </option>
          ))}
        </select>
        {payerIsSelf && (
          <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
            This also adds a movement to your ledger.
          </span>
        )}
      </div>
      )}

      {!isAllocated && payerIsSelf && (
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label className="fern-field-label">Category</label>
            <select
              className="fern-input"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
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
      )}

      <div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
          <input
            type="checkbox"
            checked={involvesAll}
            onChange={(e) => setInvolvesAll(e.target.checked)}
          />
          Everyone is involved
        </label>
        {!involvesAll && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, marginLeft: 4 }}>
            {members.map((m) => (
              <label
                key={m.id}
                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}
              >
                <input
                  type="checkbox"
                  checked={participants.has(m.id)}
                  onChange={() => toggleParticipant(m.id)}
                />
                {m.name}
              </label>
            ))}
          </div>
        )}
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowOverrides((v) => !v)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--teal-ink)', fontSize: 13, padding: 0 }}
        >
          <Icon name={showOverrides ? 'chevronDown' : 'chevronRight'} size={12} /> Adjust individual shares
        </button>
        {showOverrides && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            {activeParticipants.map((id) => (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--ink)' }}>{memberName.get(id)}</span>
                <input
                  className="fern-input"
                  inputMode="decimal"
                  placeholder="auto"
                  style={{ width: 100, textAlign: 'right' }}
                  value={overrides[id] ?? ''}
                  onChange={(e) => setOverrides((v) => ({ ...v, [id]: e.target.value }))}
                />
              </div>
            ))}
            <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
              Leave blank to split the rest by the group percentages.
            </span>
          </div>
        )}
      </div>
    </SheetShell>
  )
}
