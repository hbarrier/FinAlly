'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { SheetShell } from '../sheet-shell'
import { Icon } from '../icon'
import { parseDecimal } from '@/lib/utils'
import { todayISO } from '@/lib/dates'
import type { DivorceSplitEntry } from '@/lib/db-types'
import type { SplitExpenseInput } from '@/lib/actions/divorce-split'

/** Form state is initialised from `item`; remount (via `key`) on each open. */
interface CostSplitEntrySheetProps {
  open: boolean
  onClose: () => void
  item?: DivorceSplitEntry | null
  defaultMyPercent: number
  onSave: (data: SplitExpenseInput) => void
  onDelete?: () => void
}

export function CostSplitEntrySheet({ open, onClose, item, defaultMyPercent, onSave, onDelete }: CostSplitEntrySheetProps) {
  const t = useTranslations('costSplit')
  const tc = useTranslations('common')
  const [amount, setAmount] = useState(item ? String(item.amount) : '')
  const [date, setDate] = useState(item?.date ?? todayISO())
  const [myPercent, setMyPercent] = useState(String(item?.myPercent ?? defaultMyPercent))
  const [description, setDescription] = useState(item?.description ?? '')

  const amountNum = parseDecimal(amount)
  const pctNum = parseDecimal(myPercent)
  const valid = amountNum > 0 && date.length === 10 && pctNum >= 0 && pctNum <= 100

  const submit = () => {
    onSave({ date, amount: amountNum, myPercent: pctNum, description: description.trim() || null })
    onClose()
  }

  const deleteAction =
    item && onDelete ? (
      <button type="button" onClick={onDelete} className="fern-btn sheet-delete">
        <Icon name="trash" size={14} /> {tc('delete')}
      </button>
    ) : undefined

  return (
    <SheetShell
      open={open}
      onClose={onClose}
      title={item ? t('editTitle') : t('newTitle')}
      primary={{ label: item ? tc('save') : tc('add'), icon: 'check', onClick: submit, disabled: !valid }}
      cancelLabel={tc('cancel')}
      secondaryAction={deleteAction}
    >
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label className="fern-field-label">{t('amount')}</label>
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
          <label className="fern-field-label">{t('date')}</label>
          <input type="date" className="fern-input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="fern-field-label">{t('description')}</label>
        <input className="fern-input" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div>
        <label className="fern-field-label">{t('myShare')}</label>
        <input className="fern-input" inputMode="decimal" value={myPercent} onChange={(e) => setMyPercent(e.target.value)} />
        <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
          {t('vincentShare', { pct: isNaN(pctNum) ? '—' : String(100 - pctNum) })}
        </span>
      </div>
    </SheetShell>
  )
}
