'use client'

import { useState } from 'react'
import { Icon } from '@/components/fern/icon'
import { SavingAccountSheet } from '@/components/fern/sheets/saving-account-sheet'
import { PageHeader } from '@/components/fern/page-header'
import { FernButton } from '@/components/fern/button'
import { EmptyState } from '@/components/fern/empty-state'
import { fmt } from '@/lib/derive'
import type { SavingAccount } from '@/lib/db-types'
import {
  addSavingAccount,
  updateSavingAccount,
  deleteSavingAccount,
} from '@/lib/actions/saving-accounts'
import { confirmDialog } from '@/lib/dialogs-store'
import { useServerAction } from '@/hooks/use-server-action'

type Row = SavingAccount & { balance: number; hasTransfers: boolean }

export function AccountsClient({ accounts }: { accounts: Row[] }) {
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const { run, pending } = useServerAction()

  const editingItem = editing && editing !== 'new' ? accounts.find((a) => a.id === editing) : null

  const handleSave = (data: Parameters<typeof addSavingAccount>[0]) => {
    run(async () => {
      if (editing && editing !== 'new') await updateSavingAccount(editing, data)
      else await addSavingAccount(data)
    })
    setEditing(null)
  }

  const handleDelete = async (a: Row) => {
    if (!(await confirmDialog({ message: `Delete "${a.name}"?`, confirmLabel: 'Delete', tone: 'danger' }))) return
    run(() => deleteSavingAccount(a.id))
  }

  const total = accounts.reduce((s, a) => s + a.balance, 0)

  return (
    <div>
      <PageHeader
        kicker={
          accounts.length
            ? `${accounts.length} account${accounts.length === 1 ? '' : 's'} · ${fmt(total)} saved`
            : 'Admin'
        }
        title={<>Saving <em>accounts</em></>}
        actions={
          <FernButton onClick={() => setEditing('new')}>
            <Icon name="plus" size={16} /> New account
          </FernButton>
        }
      />

      {accounts.length === 0 ? (
        <EmptyState
          illu="∅"
          title="No saving accounts yet"
          description="Create one to start moving money aside."
          action={
            <FernButton
              tone="outline"
              onClick={() => setEditing('new')}
              style={{ marginTop: 12, padding: '8px 14px', borderRadius: 10, fontSize: 13, background: 'transparent', color: 'var(--ink)' }}
            >
              <Icon name="plus" size={14} /> Add account
            </FernButton>
          }
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {accounts.map((a) => {
            const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', padding: 4, display: 'grid', placeItems: 'center', borderRadius: 6 } as const
            return (
              <div key={a.id} className="fern-card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--sage-bg)', color: 'var(--sage-ink)', flexShrink: 0 }}>
                    <Icon name="bank" size={20} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>{a.name}</div>
                    {a.description && (
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>{a.description}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 2 }}>
                    <button onClick={() => setEditing(a.id)} style={iconBtn} aria-label="Edit">
                      <Icon name="edit" size={14} />
                    </button>
                    {a.hasTransfers ? (
                      <button
                        style={{ ...iconBtn, opacity: 0.3, cursor: 'not-allowed' }}
                        aria-label="Cannot delete: account has transfers"
                        title="This account has transfers recorded and cannot be deleted."
                        disabled
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    ) : (
                      <button onClick={() => handleDelete(a)} disabled={pending} style={iconBtn} aria-label="Delete">
                        <Icon name="trash" size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontSize: 12, color: 'var(--ink-soft)', borderTop: '1px solid var(--line-soft)', paddingTop: 12 }}>
                  <span>Balance</span>
                  <span style={{ fontFamily: 'var(--mono-fern)', fontWeight: 600, color: 'var(--ink)' }}>{fmt(a.balance)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <SavingAccountSheet
        open={!!editing}
        onClose={() => setEditing(null)}
        item={editingItem ?? null}
        onSave={handleSave}
      />
    </div>
  )
}
