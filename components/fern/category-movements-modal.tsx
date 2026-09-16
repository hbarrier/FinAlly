'use client'

import { Modal } from './modal'
import { fmt, formatDate, type BudgetActualTxn } from '@/lib/derive'
import type { Merchant } from '@/lib/db-types'

interface CategoryMovementsModalProps {
  open: boolean
  onClose: () => void
  title: string
  movements: BudgetActualTxn[]
  merchants: Merchant[]
}

/** Lists the individual transactions behind a budget category or line's actual total. */
export function CategoryMovementsModal({ open, onClose, title, movements, merchants }: CategoryMovementsModalProps) {
  const merchantById = new Map(merchants.map((m) => [m.id, m]))
  const total = movements.reduce((s, t) => s + t.amount, 0)

  return (
    <Modal open={open} onClose={onClose} title={title}>
      {movements.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--ink-faint)' }}>No movements.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {movements.map((t) => (
            <div
              key={t.id}
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--line-soft)' }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.merchantId ? (merchantById.get(t.merchantId)?.name ?? 'Unknown merchant') : 'No merchant'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{formatDate(t.date)}</div>
              </div>
              <div style={{ fontFamily: 'var(--mono-fern)', color: 'var(--ink-soft)', flexShrink: 0 }}>{fmt(t.amount)}</div>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, paddingTop: 10 }}>
            <span>Total</span>
            <span style={{ fontFamily: 'var(--mono-fern)' }}>{fmt(total)}</span>
          </div>
        </div>
      )}
    </Modal>
  )
}
