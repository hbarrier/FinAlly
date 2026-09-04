'use client'

import { useMemo, useState } from 'react'
import { Icon } from '@/components/fern/icon'
import { PageHeader } from '@/components/fern/page-header'
import { FernButton } from '@/components/fern/button'
import { Fab } from '@/components/fern/fab'
import { Money } from '@/components/fern/money'
import { EmptyState } from '@/components/fern/empty-state'
import { TransactionSheet, type TransactionSheetSave } from '@/components/fern/sheets/transaction-sheet'
import { SavingAccountSheet } from '@/components/fern/sheets/saving-account-sheet'
import { fmt, formatDate, type Transaction } from '@/lib/derive'
import type { SavingAccount } from '@/lib/db-types'
import {
  addTransaction,
  updateSavingTransfer,
  updateInterest,
  deleteTransaction,
} from '@/lib/actions/transactions'
import { updateSavingAccount } from '@/lib/actions/saving-accounts'
import { useServerAction } from '@/hooks/use-server-action'

interface Props {
  account: SavingAccount
  balance: number
  transfers: Transaction[]
  savingAccounts: SavingAccount[]
  categoryIcon: string
}

export function SavingAccountClient({ account, balance, transfers, savingAccounts, categoryIcon }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null)
  const [interestPrefill, setInterestPrefill] = useState(false)
  const [accountSheetOpen, setAccountSheetOpen] = useState(false)
  const [q, setQ] = useState('')
  const { run } = useServerAction()

  const nameById = useMemo(
    () => new Map(savingAccounts.map((a) => [a.id, a.name])),
    [savingAccounts],
  )

  const counterparty = (t: Transaction) => {
    if (t.kind === 'interest') return 'Interest'
    const other = t.sourceSavingAccountId === account.id ? t.destSavingAccountId : t.sourceSavingAccountId
    return other ? nameById.get(other) ?? 'Saving account' : 'Credit account'
  }
  const signedFor = (t: Transaction) =>
    (t.destSavingAccountId === account.id ? 1 : -1) * Number(t.amount || 0)

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return transfers
    return transfers.filter(
      (t) =>
        counterparty(t).toLowerCase().includes(needle) ||
        (t.note ?? '').toLowerCase().includes(needle),
    )
  }, [transfers, q]) // eslint-disable-line react-hooks/exhaustive-deps

  const byMonth = useMemo(() => {
    const map = new Map<string, Transaction[]>()
    for (const t of filtered) {
      const key = t.date.slice(0, 7)
      const list = map.get(key) ?? []
      list.push(t)
      map.set(key, list)
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  const openNew = () => {
    setEditingTxn(null)
    setInterestPrefill(false)
    setSheetOpen(true)
  }

  const openInterest = () => {
    setEditingTxn(null)
    setInterestPrefill(true)
    setSheetOpen(true)
  }

  const handleSave = (data: TransactionSheetSave) => {
    if (data.kind === 'saving') {
      run(async () => {
        if (editingTxn) {
          await updateSavingTransfer(editingTxn.id, {
            date: data.date,
            amount: data.amount,
            note: data.note,
            sourceSavingAccountId: data.sourceSavingAccountId,
            destSavingAccountId: data.destSavingAccountId,
          })
        } else {
          await addTransaction(data)
        }
      })
    } else if (data.kind === 'interest') {
      run(async () => {
        if (editingTxn) {
          await updateInterest(editingTxn.id, {
            date: data.date,
            amount: data.amount,
            note: data.note,
            destSavingAccountId: data.destSavingAccountId,
          })
        } else {
          await addTransaction(data)
        }
      })
    } else {
      return
    }
    setSheetOpen(false)
    setEditingTxn(null)
  }

  const handleDelete = () => {
    if (!editingTxn) return
    run(() => deleteTransaction(editingTxn.id))
    setSheetOpen(false)
    setEditingTxn(null)
  }

  return (
    <div>
      <PageHeader
        kicker={account.description || 'Saving account'}
        title={<>{account.name}</>}
        actions={
          <FernButton tone="outline" onClick={() => setAccountSheetOpen(true)}>
            <Icon name="edit" size={16} /> Edit
          </FernButton>
        }
      />

      <div className="fern-card" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--mono-fern)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-faint)', marginBottom: 8 }}>
          Balance
        </div>
        <Money amount={balance} />
      </div>

      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <input
          className="fern-input"
          placeholder="Search transfers…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <FernButton onClick={openNew}>
          <Icon name="plus" size={16} /> Move money
        </FernButton>
        <FernButton tone="outline" onClick={openInterest}>
          <Icon name="sparkle" size={16} /> Add interest
        </FernButton>
      </div>

      {byMonth.length === 0 ? (
        <EmptyState
          illu="∅"
          title="No transfers yet"
          description="Move money in from your credit account to get started."
        />
      ) : (
        byMonth.map(([month, items]) => {
          const monthTotal = items.reduce((s, t) => s + signedFor(t), 0)
          return (
            <div key={month} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 4px', fontSize: 12 }}>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)' }}>
                  {formatDate(month + '-01T12:00:00', 'en-US', { month: 'long', year: 'numeric' })}
                </h3>
                <span style={{ fontFamily: 'var(--mono-fern)', color: monthTotal >= 0 ? 'var(--sage-ink)' : 'var(--rose-ink)' }}>
                  {monthTotal >= 0 ? '+' : '−'}{fmt(Math.abs(monthTotal))}
                </span>
              </div>
              <div className="fern-card" style={{ padding: '4px 16px' }}>
                {items.map((t) => {
                  const signed = signedFor(t)
                  const incoming = signed >= 0
                  return (
                    <div
                      key={t.id}
                      className="fern-txn-row"
                      onClick={() => { setEditingTxn(t); setSheetOpen(true) }}
                    >
                      <div style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', background: incoming ? 'var(--sage-bg)' : 'var(--rose-bg)', color: incoming ? 'var(--sage-ink)' : 'var(--rose-ink)', flexShrink: 0 }}>
                        <Icon name={t.kind === 'interest' ? 'sparkle' : categoryIcon} size={16} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>
                          {t.kind === 'interest' ? counterparty(t) : `${incoming ? 'From ' : 'To '}${counterparty(t)}`}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
                          {formatDate(t.date + 'T12:00:00', 'en-US', { day: 'numeric', month: 'short' })}
                          {t.note ? ` · ${t.note}` : ''}
                        </div>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--mono-fern)', color: incoming ? 'var(--sage-ink)' : 'var(--rose-ink)', flexShrink: 0 }}>
                        {incoming ? '+' : '−'}{fmt(Math.abs(signed))}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })
      )}

      <Fab onClick={openNew} label="Move money" />

      <TransactionSheet
        open={sheetOpen}
        onClose={() => { setSheetOpen(false); setEditingTxn(null); setInterestPrefill(false) }}
        categories={[]}
        merchants={[]}
        savingAccounts={savingAccounts}
        item={editingTxn}
        lockKind
        prefill={
          editingTxn
            ? null
            : interestPrefill
              ? { kind: 'interest', destSavingAccountId: account.id }
              : { kind: 'saving', sourceSavingAccountId: account.id, destSavingAccountId: null }
        }
        onSave={handleSave}
        onDelete={editingTxn ? handleDelete : undefined}
      />

      <SavingAccountSheet
        open={accountSheetOpen}
        onClose={() => setAccountSheetOpen(false)}
        item={account}
        onSave={(data) => {
          run(() => updateSavingAccount(account.id, data))
          setAccountSheetOpen(false)
        }}
      />
    </div>
  )
}
