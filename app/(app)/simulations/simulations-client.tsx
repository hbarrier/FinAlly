'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/fern/icon'
import { PageHeader } from '@/components/fern/page-header'
import { FernButton } from '@/components/fern/button'
import { EmptyState } from '@/components/fern/empty-state'
import { SimulationSheet } from '@/components/fern/sheets/simulation-sheet'
import { fmt, simulationTotals } from '@/lib/derive'
import type { SimulationWithLines } from '@/lib/db-types'
import { createSimulation, deleteSimulation, duplicateSimulation, type SimulationInputs } from '@/lib/actions/simulations'
import { confirmDialog } from '@/lib/dialogs-store'
import { useServerAction } from '@/hooks/use-server-action'

interface SimulationsClientProps {
  simulations: SimulationWithLines[]
  recurringEnabled: boolean
}

export function SimulationsClient({ simulations, recurringEnabled }: SimulationsClientProps) {
  const [creating, setCreating] = useState(false)
  const { run, pending } = useServerAction()
  const router = useRouter()

  const handleCreate = (data: { name: string; description: string | null; inputs: SimulationInputs | null }) => {
    run(async () => {
      const { id } = await createSimulation(data)
      router.push(`/simulations/${id}`)
    })
  }

  const handleDuplicate = (id: string) => {
    run(async () => {
      const clone = await duplicateSimulation(id)
      router.push(`/simulations/${clone.id}`)
    })
  }

  const handleDelete = async (id: string) => {
    if (!(await confirmDialog({ message: 'Delete this simulation?', confirmLabel: 'Delete', tone: 'danger' }))) return
    run(() => deleteSimulation(id))
  }

  return (
    <div>
      <PageHeader
        kicker="What-if scenarios"
        title={<><em>Simulations</em></>}
        actions={
          <FernButton onClick={() => setCreating(true)}>
            <Icon name="plus" size={16} /> New simulation
          </FernButton>
        }
      />

      {simulations.length === 0 ? (
        <EmptyState
          illu="◇"
          title="No simulations yet"
          description="Model a raise, a new bill, or a job change before it happens."
          action={
            <FernButton
              tone="outline"
              onClick={() => setCreating(true)}
              style={{ marginTop: 12, padding: '8px 14px', borderRadius: 10, fontSize: 13, background: 'transparent', color: 'var(--ink)' }}
            >
              <Icon name="plus" size={14} /> Add first simulation
            </FernButton>
          }
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {simulations.map((s) => {
            const monthly = simulationTotals(s.lines, 'monthly-with-yearly')
            const yearly = simulationTotals(s.lines, 'yearly')
            return (
              <Link key={s.id} href={`/simulations/${s.id}`} className="fern-card" style={{ padding: 16, display: 'block', textDecoration: 'none', color: 'inherit' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>{s.name}</div>
                    {s.description && (
                      <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 2 }}>{s.description}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                    <button
                      disabled={pending}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDuplicate(s.id) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', padding: 4, display: 'grid', placeItems: 'center', borderRadius: 6 }}
                    >
                      <Icon name="repeat" size={14} />
                    </button>
                    <button
                      disabled={pending}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(s.id) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', padding: 4, display: 'grid', placeItems: 'center', borderRadius: 6 }}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 14, fontSize: 12, borderTop: '1px solid var(--line-soft)', paddingTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--ink-faint)' }}>Monthly</span>
                    <span style={{ fontFamily: 'var(--mono-fern)' }}>
                      <span style={{ color: 'var(--sage-ink)' }}>+{fmt(monthly.income)}</span>{' '}
                      <span style={{ color: 'var(--rose-ink)' }}>−{fmt(monthly.expense)}</span>
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--ink-faint)' }}>Yearly</span>
                    <span style={{ fontFamily: 'var(--mono-fern)' }}>
                      <span style={{ color: 'var(--sage-ink)' }}>+{fmt(yearly.income)}</span>{' '}
                      <span style={{ color: 'var(--rose-ink)' }}>−{fmt(yearly.expense)}</span>
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <SimulationSheet open={creating} onClose={() => setCreating(false)} onSave={handleCreate} recurringEnabled={recurringEnabled} />
    </div>
  )
}
