'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/fern/icon'
import { PageHeader } from '@/components/fern/page-header'
import { FernButton } from '@/components/fern/button'
import { EmptyState } from '@/components/fern/empty-state'
import { GroupSheet } from '@/components/fern/sheets/group-sheet'
import { fmt } from '@/lib/derive'
import { createGroup } from '@/lib/actions/groups'
import { useServerAction } from '@/hooks/use-server-action'

interface GroupCard {
  id: string
  name: string
  description: string | null
  isActive: boolean
  memberCount: number
  youNet: number
  hasActivity: boolean
}

function netLabel(net: number): { text: string; color: string } {
  if (Math.abs(net) < 0.01) return { text: 'Settled up', color: 'var(--ink-faint)' }
  if (net > 0) return { text: `You are owed ${fmt(net)}`, color: 'var(--sage-ink)' }
  return { text: `You owe ${fmt(Math.abs(net))}`, color: 'var(--rose-ink)' }
}

export function GroupsClient({ cards }: { cards: GroupCard[] }) {
  const router = useRouter()
  const { run } = useServerAction()
  const [creating, setCreating] = useState(false)

  const active = cards.filter((c) => c.isActive)
  const inactive = cards.filter((c) => !c.isActive)

  const handleCreate = (data: { name: string; description: string | null }) => {
    run(async () => {
      const { id } = await createGroup(data)
      router.push(`/groups/${id}`)
    })
  }

  const renderCard = (c: GroupCard) => {
    const net = netLabel(c.youNet)
    return (
      <Link
        key={c.id}
        href={`/groups/${c.id}`}
        className="fern-card"
        style={{
          padding: 16,
          display: 'block',
          textDecoration: 'none',
          color: 'inherit',
          opacity: c.isActive ? 1 : 0.6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>{c.name}</div>
            {c.description && (
              <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 2 }}>{c.description}</div>
            )}
          </div>
          {!c.isActive && (
            <span style={{ fontSize: 11, color: 'var(--ink-faint)', flexShrink: 0 }}>Inactive</span>
          )}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 14,
            fontSize: 13,
            borderTop: '1px solid var(--line-soft)',
            paddingTop: 12,
          }}
        >
          <span style={{ color: 'var(--ink-faint)' }}>
            {c.memberCount} {c.memberCount === 1 ? 'member' : 'members'}
          </span>
          <span style={{ fontFamily: 'var(--mono-fern)', color: net.color }}>{net.text}</span>
        </div>
      </Link>
    )
  }

  return (
    <div>
      <PageHeader
        kicker="Shared expenses"
        title={<em>Groups</em>}
        actions={
          <FernButton onClick={() => setCreating(true)}>
            <Icon name="plus" size={16} /> New group
          </FernButton>
        }
      />

      {cards.length === 0 ? (
        <EmptyState
          illu="◇"
          title="No groups yet"
          description="Create a group to split expenses with other people and track who owes whom."
          action={<FernButton onClick={() => setCreating(true)}>Create first group</FernButton>}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {active.map(renderCard)}
          </div>
          {inactive.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontFamily: 'var(--mono-fern)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: 'var(--ink-faint)',
                  marginBottom: 8,
                }}
              >
                Inactive
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                {inactive.map(renderCard)}
              </div>
            </div>
          )}
        </div>
      )}

      <GroupSheet open={creating} onClose={() => setCreating(false)} onSave={handleCreate} />
    </div>
  )
}
