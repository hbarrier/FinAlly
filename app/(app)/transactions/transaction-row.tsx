'use client'

import { Icon } from '@/components/fern/icon'
import { CatSwatch } from '@/components/fern/cat-swatch'
import { Chip } from '@/components/fern/chip'
import { fmt, type Category, type Transaction } from '@/lib/derive'
import { paymentMethodLabel, type PaymentMethod } from '@/lib/payment-method'
import type { Merchant } from '@/lib/db-types'

function paymentMethodIcon(method: PaymentMethod): string {
  switch (method) {
    case 'card': return 'wallet'
    case 'transfer': return 'bank'
    case 'cash': return 'sparkle'
    case 'check': return 'fileText'
    case 'debit': return 'bank'
    case 'paypal': return 'wallet'
  }
}

interface TransactionRowProps {
  t: Transaction
  cat: Category | undefined
  merchant: Merchant | undefined
  selectionMode: boolean
  isSelected: boolean
  reimbursementSummary: { status: string; label: string } | undefined
  recurringEnabled: boolean
  divorceEnabled: boolean
  onClick: () => void
  onLink: () => void
  onClear: () => void
  onSettle: () => void
}

export function TransactionRow({
  t,
  cat,
  merchant,
  selectionMode,
  isSelected,
  reimbursementSummary,
  recurringEnabled,
  divorceEnabled,
  onClick,
  onLink,
  onClear,
  onSettle,
}: TransactionRowProps) {
  const isCleared = t.cleared === 1
  const showManualSettlementAction = divorceEnabled && t.kind === 'expense' && t.reimbursable === 1
  const isManuallySettled = reimbursementSummary?.status === 'manually_settled'

  return (
    <div
      id={`txn-${t.id}`}
      className="fern-txn-row"
      onClick={onClick}
      style={selectionMode && isSelected ? { background: 'var(--bg-sunken)' } : undefined}
    >
      {selectionMode && (
        <div
          style={{
            flexShrink: 0,
            width: 18,
            height: 18,
            borderRadius: 5,
            border: isSelected ? 'none' : '1.5px solid var(--line)',
            background: isSelected ? 'var(--teal)' : 'transparent',
            display: 'grid',
            placeItems: 'center',
            transition: 'background 0.1s, border 0.1s',
          }}
        >
          {isSelected && <Icon name="check" size={11} style={{ color: '#fff' }} />}
        </div>
      )}
      <CatSwatch color={cat?.color} icon={cat?.icon ?? 'tag'} size={34} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {t.note ?? merchant?.name ?? cat?.name ?? 'Transaction'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{cat?.name ?? 'Uncategorized'}</span>
          {merchant && <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>· {merchant.name}</span>}
          <Chip tone="scheduled">
            <Icon name={paymentMethodIcon(t.method)} size={10} /> {paymentMethodLabel(t.method)}
          </Chip>
          {recurringEnabled && t.recurringId && <Chip tone="recurring"><Icon name="repeat" size={10} /> recurring</Chip>}
          {divorceEnabled && reimbursementSummary && (
            <Chip tone={reimbursementSummary.status === 'reimbursed' || reimbursementSummary.status === 'fully_allocated' || reimbursementSummary.status === 'manually_settled' ? 'recurring' : 'scheduled'}>
              {reimbursementSummary.label}
            </Chip>
          )}
        </div>
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: t.kind === 'income' ? 'var(--sage-ink)' : 'var(--rose-ink)', fontFamily: 'var(--mono-fern)', flexShrink: 0 }}>
        {t.kind === 'income' ? '+' : '−'}{fmt(Math.abs(t.amount ?? 0))}
      </div>
      {!selectionMode && showManualSettlementAction && (
        <button
          title={isManuallySettled ? 'Clear manual settlement' : 'Manually settle reimbursement'}
          onClick={(e) => { e.stopPropagation(); onSettle() }}
          style={{
            flexShrink: 0,
            width: 20,
            height: 20,
            borderRadius: 6,
            border: isManuallySettled ? 'none' : '1.5px solid var(--line)',
            background: isManuallySettled ? 'var(--sage-bg)' : 'transparent',
            color: isManuallySettled ? 'var(--sage-ink)' : 'var(--ink-faint)',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <Icon name={isManuallySettled ? 'x' : 'check'} size={12} />
        </button>
      )}
      {!selectionMode && recurringEnabled && (
        <button
          title={t.recurringId ? 'Manage recurring link' : 'Make recurring'}
          onClick={(e) => { e.stopPropagation(); onLink() }}
          style={{
            flexShrink: 0,
            width: 20,
            height: 20,
            borderRadius: 6,
            border: t.recurringId ? 'none' : '1.5px dashed var(--line)',
            background: t.recurringId ? 'var(--sage-bg)' : 'transparent',
            color: t.recurringId ? 'var(--sage-ink)' : 'var(--ink-faint)',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <Icon name="repeat" size={12} />
        </button>
      )}
      <button
        title={isCleared ? 'Mark as pending' : 'Mark as cleared'}
        onClick={(e) => { e.stopPropagation(); if (!selectionMode) onClear() }}
        style={{
          flexShrink: 0,
          width: 20,
          height: 20,
          borderRadius: '50%',
          border: isCleared ? 'none' : '1.5px solid var(--line)',
          background: isCleared ? 'var(--sage)' : 'transparent',
          display: 'grid',
          placeItems: 'center',
          cursor: selectionMode ? 'default' : 'pointer',
          padding: 0,
          transition: 'background 0.15s, border 0.15s',
        }}
      >
        {isCleared && <Icon name="check" size={12} style={{ color: '#fff' }} />}
      </button>
    </div>
  )
}
