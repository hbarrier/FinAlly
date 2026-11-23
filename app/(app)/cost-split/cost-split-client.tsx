'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Fab } from '@/components/fern/fab'
import { CostSplitEntrySheet } from '@/components/fern/sheets/cost-split-entry-sheet'
import { fmt } from '@/lib/derive'
import { buildMonths, totalBalance } from '@/lib/divorce-split'
import {
  createSplitEntry,
  deleteSplitEntry,
  setExpensePaid,
  setRentOverride,
  setRentPaid,
  updateSplitEntry,
  updateSplitSettings,
  type SplitExpenseInput,
} from '@/lib/actions/divorce-split'
import { confirmDialog } from '@/lib/dialogs-store'
import { useServerAction } from '@/hooks/use-server-action'
import type { DivorceSplitEntry, DivorceSplitRentMonth, DivorceSplitSettings } from '@/lib/db-types'
import { CostSplitMonth } from './cost-split-month'
import { CostSplitSettings } from './cost-split-settings'

interface CostSplitClientProps {
  settings: DivorceSplitSettings
  rentRows: DivorceSplitRentMonth[]
  entries: DivorceSplitEntry[]
  currentMonth: string
}

export function CostSplitClient({ settings, rentRows, entries, currentMonth }: CostSplitClientProps) {
  const t = useTranslations('costSplit')
  const { run } = useServerAction()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<DivorceSplitEntry | null>(null)
  const [sheetKey, setSheetKey] = useState(0)

  const months = buildMonths(settings, rentRows, entries, currentMonth)
  const { iOweAudrey, vincentOwesAudrey } = totalBalance(months)
  const rentRowByMonth = new Map(rentRows.map((r) => [r.month, r]))

  const openSheet = (item: DivorceSplitEntry | null) => {
    setEditing(item)
    setSheetKey((k) => k + 1)
    setSheetOpen(true)
  }

  const save = (data: SplitExpenseInput) =>
    run(() => (editing ? updateSplitEntry(editing.id, data) : createSplitEntry(data)))

  const remove = async () => {
    if (!editing || !(await confirmDialog({ message: t('confirmDelete'), tone: 'danger' }))) return
    setSheetOpen(false)
    run(() => deleteSplitEntry(editing.id))
  }

  const meCard =
    Math.abs(iOweAudrey) < 0.01
      ? { label: t('settled'), value: fmt(0), tone: 'muted' as const }
      : iOweAudrey > 0
        ? { label: t('iOwe'), value: fmt(iOweAudrey), tone: 'rose' as const }
        : { label: t('audreyOwes'), value: fmt(-iOweAudrey), tone: 'sage' as const }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, padding: '32px 0' }}>
      <header style={{ display: 'grid', gap: 14 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--mono-fern)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--teal-ink)', fontWeight: 700 }}>
          {t('kicker')}
        </div>
        <h1 style={{ fontSize: 28, lineHeight: 1.05, fontWeight: 700, color: 'var(--ink)', margin: '6px 0 0' }}>
          {t('title')}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '8px 0 0', maxWidth: 620 }}>
          {t('intro')}
        </p>
      </header>

      <CostSplitSettings
        key={JSON.stringify(settings)}
        settings={settings}
        onSave={(data) => run(() => updateSplitSettings(data))}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        <SummaryCard {...meCard} />
        <SummaryCard
          label={vincentOwesAudrey >= 0 ? t('vincentOwes') : t('audreyOwesVincent')}
          value={fmt(Math.abs(vincentOwesAudrey))}
          tone="muted"
        />
      </div>

      {months.map((view) => (
        <CostSplitMonth
          key={view.month}
          view={view}
          rentRow={rentRowByMonth.get(view.month)}
          onOpen={openSheet}
          onExpensePaid={(e, who, paid) => run(() => setExpensePaid(e.id, who, paid))}
          onRentOverride={(month, data) => run(() => setRentOverride(month, data))}
          onRentPaid={(month, who, paid) => run(() => setRentPaid(month, who, paid))}
        />
      ))}

      <Fab label={t('add')} onClick={() => openSheet(null)} />

      <CostSplitEntrySheet
        key={sheetKey}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        item={editing}
        defaultMyPercent={settings.myPercent}
        onSave={save}
        onDelete={remove}
      />
    </div>
  )
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: 'rose' | 'sage' | 'muted' }) {
  const bg = tone === 'rose' ? 'var(--rose-bg)' : tone === 'sage' ? 'var(--sage-bg)' : 'var(--bg-elevated)'
  const color = tone === 'rose' ? 'var(--rose-ink)' : tone === 'sage' ? 'var(--sage-ink)' : 'var(--ink-soft)'
  return (
    <div style={{ background: bg, borderRadius: 14, padding: '14px 16px' }}>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>{label}</div>
    </div>
  )
}
