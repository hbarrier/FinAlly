'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Icon } from '@/components/fern/icon'
import { CatSwatch } from '@/components/fern/cat-swatch'
import { Chip } from '@/components/fern/chip'
import { SegmentedControl } from '@/components/fern/segmented-control'
import { TransactionSheet } from '@/components/fern/sheets/transaction-sheet'
import { fmt, resolvedDayOfMonth, formatDate, type Category, type Transaction, type RecurringWithAmounts } from '@/lib/derive'
import { PageHeader } from '@/components/fern/page-header'
import { FernButton } from '@/components/fern/button'
import { EmptyState } from '@/components/fern/empty-state'
import { Fab } from '@/components/fern/fab'
import { PAYMENT_METHODS, paymentMethodLabel, type PaymentMethod } from '@/lib/payment-method'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import {
  ReimbursementMappingSheet,
  type ReimbursementMappingExpense,
} from '@/components/fern/sheets/reimbursement-mapping-sheet'
import {
  addTransaction,
  updateTransactionWithRecurringAmountOption,
  deleteTransaction,
  clearTransaction,
  detachTransactionFromRecurring,
} from '@/lib/actions/transactions'
import { markInstanceNotApplicable, unmarkInstanceNotApplicable } from '@/lib/actions/recurring-instances'
import {
  mapReimbursementIncomeToExpenses,
  setExpenseManualSettlement,
} from '@/lib/actions/reimbursements'
import { RecurringLinkSheet } from '@/components/fern/sheets/recurring-link-sheet'
import { BulkRecurringLinkSheet } from '@/components/fern/sheets/bulk-recurring-link-sheet'
import type { Merchant, RecurringInstance } from '@/lib/db-types'

const ImportWizard = dynamic(
  () => import('./import-wizard').then((m) => m.ImportWizard),
  { ssr: false },
)

type InstanceEntry = {
  _instance: true
  instanceId: string
  id: string
  date: string
  month: string
  amount: number
  kind: 'expense' | 'income'
  method: PaymentMethod
  categoryId: string | null
  merchantId: string | null
  recurringId: string
  name: string
  isNa?: true
}

type Movement = Transaction | InstanceEntry

const REIMB_OPTIONS = [
  { group: 'Summary', value: 'unresolved', label: 'Open work' },
  { group: 'Summary', value: 'resolved', label: 'Fully resolved' },
  { group: 'Expenses', value: 'expense:not_reimbursed', label: 'Not reimbursed' },
  { group: 'Expenses', value: 'expense:partially_reimbursed', label: 'Partially reimbursed' },
  { group: 'Expenses', value: 'expense:reimbursed', label: 'Reimbursed' },
  { group: 'Expenses', value: 'expense:manually_settled', label: 'Manually settled' },
  { group: 'Income', value: 'income:unmapped', label: 'Unmapped income' },
  { group: 'Income', value: 'income:claim_linked', label: 'Claim linked' },
  { group: 'Income', value: 'income:partially_allocated', label: 'Partially allocated' },
  { group: 'Income', value: 'income:fully_allocated', label: 'Fully allocated' },
] as const

function isInstance(m: Movement): m is InstanceEntry {
  return '_instance' in m
}

function paymentMethodIcon(method: PaymentMethod): string {
  switch (method) {
    case 'card':
      return 'wallet'
    case 'transfer':
      return 'bank'
    case 'cash':
      return 'sparkle'
    case 'check':
      return 'fileText'
    case 'debit':
      return 'bank'
    case 'paypal':
      return 'wallet'
  }
}

function isUnresolvedReimbursementStatus(status: string) {
  return (
    status === 'not_reimbursed' ||
    status === 'partially_reimbursed' ||
    status === 'no_rate' ||
    status === 'unmapped' ||
    status === 'partially_allocated'
  )
}

interface TransactionsClientProps {
  transactions: Transaction[]
  categories: Category[]
  merchants: Merchant[]
  recurring: RecurringWithAmounts[]
  instances: RecurringInstance[]
  eligibleReimbursementExpenses: ReimbursementMappingExpense[]
  reimbursementSummaries: Record<string, { status: string; label: string }>
  reimbursementMappingCounts: Record<string, number>
  initialMerchantId?: string
  selectedYear: number
  years: string[]
  initialMonths?: number
}


export function TransactionsClient({
  transactions: txns,
  categories,
  merchants,
  recurring,
  instances,
  eligibleReimbursementExpenses,
  reimbursementSummaries,
  reimbursementMappingCounts,
  initialMerchantId = 'all',
  selectedYear,
  years,
  initialMonths = 2,
}: TransactionsClientProps) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [kindFilter, setKindFilter] = useState('all')
  const [catFilter, setCatFilter] = useState<Set<string>>(new Set())
  const [catFilterOpen, setCatFilterOpen] = useState(false)
  const [merchantFilter, setMerchantFilter] = useState<Set<string>>(
    initialMerchantId && initialMerchantId !== 'all' ? new Set([initialMerchantId]) : new Set()
  )
  const [merchantFilterOpen, setMerchantFilterOpen] = useState(false)
  const [clearedFilter, setClearedFilter] = useState<'all' | 'cleared' | 'uncleared'>('all')
  const [methodFilter, setMethodFilter] = useState<Set<PaymentMethod>>(new Set())
  const [methodFilterOpen, setMethodFilterOpen] = useState(false)
  const [reimbursementFilter, setReimbursementFilter] = useState<Set<string>>(new Set())
  const [reimbFilterOpen, setReimbFilterOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null)
  const [linkSheetOpen, setLinkSheetOpen] = useState(false)
  const [linkingTxn, setLinkingTxn] = useState<Transaction | null>(null)
  const [mappingSheetOpen, setMappingSheetOpen] = useState(false)
  const [mappingIncome, setMappingIncome] = useState<Transaction | null>(null)
  const [prefillData, setPrefillData] = useState<{
    date: string; amount: number; kind: 'expense' | 'income'; method: PaymentMethod
    categoryId: string | null; merchantId: string | null; note: string; recurringId: string
    recurringAmountId: string | null
  } | null>(null)
  const [visibleMonthsByYear, setVisibleMonthsByYear] = useState<Record<number, number>>({})
  const [pendingScrollMonth, setPendingScrollMonth] = useState<string | null>(null)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const topSentinelRef = useRef<HTMLDivElement | null>(null)
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null)
  const loadingMoreRef = useRef(false)
  const [showNa, setShowNa] = useState(false)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkSheetOpen, setBulkSheetOpen] = useState(false)
  const [, startTransition] = useTransition()
  const clearSheetStateTimer = useRef<number | null>(null)

  const visibleMonths = visibleMonthsByYear[selectedYear] ?? initialMonths
  const setVisibleMonths = (updater: (current: number) => number) => {
    setVisibleMonthsByYear((prev) => ({
      ...prev,
      [selectedYear]: updater(prev[selectedYear] ?? initialMonths),
    }))
  }

  // Derive ghost entries from 'expected' (and optionally 'not_applicable') instances
  const instanceEntries = useMemo((): InstanceEntry[] => {
    const recurringById = new Map(recurring.map((r) => [r.id, r]))
    return instances
      .filter((inst) => inst.status === 'expected' || (showNa && inst.status === 'not_applicable'))
      .flatMap((inst): InstanceEntry[] => {
        const r = recurringById.get(inst.recurringId)
        if (!r) return []
        // Compute expected display date for the month
        let date: string
        if (r.cadence === 'monthly') {
          const dom = resolvedDayOfMonth(r.dayOfMonth ?? 1, new Date(inst.month + '-15'))
          date = `${inst.month}-${String(dom).padStart(2, '0')}`
        } else if (r.cadence === 'yearly') {
          date = `${inst.month.slice(0, 4)}-${r.startDate.slice(5)}`
        } else {
          // weekly: first occurrence of dayOfWeek in the month
          const d = new Date(inst.month + '-01T12:00:00')
          const target = r.dayOfWeek ?? 1
          while (d.getDay() !== target) d.setDate(d.getDate() + 1)
          date = `${inst.month}-${String(d.getDate()).padStart(2, '0')}`
        }
        return [{
          _instance: true,
          instanceId: inst.id,
          id: `instance:${inst.id}`,
          date,
          month: inst.month,
          amount: r.amount,
          kind: r.kind,
          method: r.method as PaymentMethod,
          categoryId: r.categoryId,
          merchantId: r.merchantId ?? null,
          recurringId: r.id,
          name: r.name,
          ...(inst.status === 'not_applicable' ? { isNa: true as const } : {}),
        }]
      })
  }, [instances, recurring, showNa])

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  )

  const merchantById = useMemo(
    () => new Map(merchants.map((m) => [m.id, m])),
    [merchants],
  )

  const merchantsSortedByName = useMemo(
    () => [...merchants].sort((a, b) => a.name.localeCompare(b.name)),
    [merchants],
  )

  const catFilterLabel = useMemo(() => {
    if (catFilter.size === 0) return 'All categories'
    return categories
      .filter((c) => catFilter.has(c.id))
      .map((c) => c.name)
      .sort((a, b) => a.localeCompare(b))
      .join(', ')
  }, [catFilter, categories])

  const merchantFilterLabel = useMemo(() => {
    if (merchantFilter.size === 0) return 'All merchants'
    return merchantsSortedByName
      .filter((m) => merchantFilter.has(m.id))
      .map((m) => m.name)
      .join(', ')
  }, [merchantFilter, merchantsSortedByName])

  const methodFilterLabel = useMemo(() => {
    if (methodFilter.size === 0) return 'All payment types'
    return [...methodFilter]
      .map((m) => paymentMethodLabel(m))
      .sort((a, b) => a.localeCompare(b))
      .join(', ')
  }, [methodFilter])

  const reimbFilterLabel = useMemo(() => {
    if (reimbursementFilter.size === 0) return 'All reimbursement states'
    return REIMB_OPTIONS
      .filter((o) => reimbursementFilter.has(o.value))
      .map((o) => o.label)
      .join(', ')
  }, [reimbursementFilter])

  const filtered = useMemo(() => {
    const all: Movement[] = [...txns, ...instanceEntries]
    const needle = q.toLowerCase()
    return all.filter((m) => {
      if (kindFilter !== 'all' && m.kind !== kindFilter) return false
      if (catFilter.size > 0 && !catFilter.has(m.categoryId ?? '')) return false
      if (merchantFilter.size > 0) {
        if (isInstance(m)) return false
        const mid = (m as Transaction).merchantId
        if (!mid || !merchantFilter.has(mid)) return false
      }
      if (clearedFilter !== 'all') {
        if (isInstance(m)) {
          if (clearedFilter === 'cleared') return false
        } else {
          const isCleared = (m as Transaction).cleared === 1
          if (clearedFilter === 'cleared' && !isCleared) return false
          if (clearedFilter === 'uncleared' && isCleared) return false
        }
      }
      if (methodFilter.size > 0 && !methodFilter.has(m.method)) return false
      if (reimbursementFilter.size > 0) {
        if (isInstance(m)) return false
        const summary = reimbursementSummaries[m.id]
        if (!summary) return false
        const tx = m as Transaction
        const matches = [...reimbursementFilter].some((f) => {
          if (f === 'unresolved') return isUnresolvedReimbursementStatus(summary.status)
          if (f === 'resolved') return !isUnresolvedReimbursementStatus(summary.status)
          const [scope, status] = f.split(':')
          if (summary.status !== status) return false
          if (scope === 'expense' && tx.kind !== 'expense') return false
          if (scope === 'income' && tx.kind !== 'income') return false
          return true
        })
        if (!matches) return false
      }
      if (q) {
        const cat = m.categoryId ? categoryById.get(m.categoryId) : undefined
        const merchant = !isInstance(m) && (m as Transaction).merchantId
          ? merchantById.get((m as Transaction).merchantId!)
          : undefined
        const hay = isInstance(m)
          ? `${m.name} ${cat?.name ?? ''}`.toLowerCase()
          : `${(m as Transaction).note ?? ''} ${cat?.name ?? ''} ${merchant?.name ?? ''}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [
    txns,
    instanceEntries,
    kindFilter,
    catFilter,
    merchantFilter,
    clearedFilter,
    methodFilter,
    reimbursementFilter,
    reimbursementSummaries,
    q,
    categoryById,
    merchantById,
  ])

  // All months in the loaded data (unfiltered), sorted newest-first
  const allMonths = useMemo(() => {
    const monthSet = new Set<string>()
    txns.forEach((t) => monthSet.add(t.date.slice(0, 7)))
    instanceEntries.forEach((t) => monthSet.add(t.date.slice(0, 7)))
    return [...monthSet].sort((a, b) => b.localeCompare(a))
  }, [txns, instanceEntries])

  const visibleMonthSet = useMemo(
    () => new Set(allMonths.slice(0, visibleMonths)),
    [allMonths, visibleMonths],
  )

  const canLoadMore = (() => {
    const currentYear = new Date().getFullYear()
    const maxMonths = selectedYear < currentYear ? 12 : selectedYear > currentYear ? 0 : new Date().getMonth() + 1
    return visibleMonths < allMonths.length || (allMonths.length > 0 && visibleMonths < maxMonths)
  })()

  useEffect(() => {
    // Allow deep-linking / post-navigation scroll with `scrollTo=YYYY-MM`.
    const params = new URLSearchParams(window.location.search)
    const month = params.get('scrollTo')
    if (month && (/^\d{4}-\d{2}$/.test(month) || /^txn-.+$/.test(month))) {
      setPendingScrollMonth(month)
    }
  }, [])

  useEffect(() => {
    const el = topSentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        // If the top is no longer visible, offer a quick way back.
        setShowScrollTop(!entry.isIntersecting)
      },
      { threshold: 0 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    const sentinel = bottomSentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && canLoadMore && !loadingMoreRef.current) {
          loadingMoreRef.current = true
          const next = visibleMonths + 1
          setVisibleMonths(() => next)
          const params = new URLSearchParams(window.location.search)
          params.set('view', 'timeline')
          params.set('year', String(selectedYear))
          params.set('months', String(next))
          router.push(`?${params.toString()}`)
        }
      },
      { threshold: 0.1 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [canLoadMore, visibleMonths, selectedYear, router])

  useEffect(() => { loadingMoreRef.current = false }, [visibleMonths])

  useEffect(() => {
    if (!pendingScrollMonth) return
    let el: HTMLElement | null
    if (pendingScrollMonth.startsWith('txn-')) {
      el = document.getElementById(pendingScrollMonth)
    } else {
      if (!visibleMonthSet.has(pendingScrollMonth)) return
      el = document.getElementById(`month-${pendingScrollMonth}`)
    }
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: pendingScrollMonth.startsWith('txn-') ? 'center' : 'start' })
    setPendingScrollMonth(null)
    // Clean up the scrollTo param so refreshes don't keep jumping.
    const params = new URLSearchParams(window.location.search)
    if (params.get('scrollTo') === pendingScrollMonth) {
      params.delete('scrollTo')
      const next = params.toString()
      window.history.replaceState(null, '', next ? `?${next}` : window.location.pathname)
    }
  }, [pendingScrollMonth, visibleMonthSet])

  const monthJumpOptions = useMemo(() => {
    const out: { value: string; label: string }[] = []
    for (let m = 1; m <= 12; m++) {
      const month = `${selectedYear}-${String(m).padStart(2, '0')}`
      out.push({
        value: month,
        label: formatDate(month + '-15T12:00:00', 'en-US', { month: 'short' }),
      })
    }
    return out
  }, [selectedYear])

  const jumpToMonth = (month: string) => {
    const idx = allMonths.indexOf(month)
    if (idx === -1) {
      // If the month isn't loaded yet, request enough months from the server to include it.
      const now = new Date()
      const currentYear = now.getFullYear()
      const endMonth = selectedYear < currentYear ? `${selectedYear}-12` : now.toISOString().slice(0, 7)
      const [ey, em] = endMonth.split('-').map(Number)
      const [ty, tm] = month.split('-').map(Number)
      const monthsNeeded = Math.max(1, (ey - ty) * 12 + (em - tm) + 1)
      const params = new URLSearchParams(window.location.search)
      params.set('view', 'timeline')
      params.set('year', String(selectedYear))
      params.set('months', String(monthsNeeded))
      params.set('scrollTo', month)
      router.push(`?${params.toString()}`)
      return
    }

    const nextVisible = idx + 1
    setPendingScrollMonth(month)
    setVisibleMonths(() => nextVisible)
    const params = new URLSearchParams(window.location.search)
    params.set('view', 'timeline')
    params.set('year', String(selectedYear))
    params.set('months', String(nextVisible))
    router.push(`?${params.toString()}`)
  }

  const visibleEntries = useMemo(
    () => filtered.filter((m) => visibleMonthSet.has(m.date.slice(0, 7))),
    [filtered, visibleMonthSet],
  )

  const cbExpensesByMonth = useMemo(() => {
    const out: Record<string, { cleared: number; total: number }> = {}
    for (const m of visibleEntries) {
      if (isInstance(m)) continue
      if (m.kind !== 'expense') continue
      if (m.method !== 'card') continue

      const month = m.date.slice(0, 7)
      const amountAbs = Math.abs(Number(m.amount ?? 0))
      out[month] = out[month] ?? { cleared: 0, total: 0 }
      out[month].total += amountAbs
      if (m.cleared === 1) out[month].cleared += amountAbs
    }
    return out
  }, [visibleEntries])

  const visibleRealIds = useMemo(
    () => visibleEntries.filter((m) => !isInstance(m)).map((m) => m.id),
    [visibleEntries],
  )

  const selectedTransactions = useMemo(
    () => txns.filter((t) => selectedIds.has(t.id)),
    [txns, selectedIds],
  )

  // Group visible entries by date
  const dateGroups = useMemo(() => {
    const byDate: Record<string, Movement[]> = {}
    visibleEntries.forEach((m) => {
      byDate[m.date] = byDate[m.date] ?? []
      byDate[m.date].push(m)
    })
    return Object.entries(byDate).sort(([a], [b]) => b.localeCompare(a))
  }, [visibleEntries])

  // Group date groups by month for section headers
  const monthGroups = useMemo(() => {
    const byMonth: Record<string, [string, Movement[]][]> = {}
    dateGroups.forEach(([date, items]) => {
      const month = date.slice(0, 7)
      byMonth[month] = byMonth[month] ?? []
      byMonth[month].push([date, items])
    })
    return Object.entries(byMonth).sort(([a], [b]) => b.localeCompare(a))
  }, [dateGroups])

  const monthGroupsMap = useMemo(
    () => Object.fromEntries(monthGroups) as Record<string, [string, Movement[]][]>,
    [monthGroups],
  )

  let filteredActual = 0
  let filteredScheduled = 0
  for (const m of filtered) {
    if (isInstance(m)) filteredScheduled++
    else filteredActual++
  }

  const closeSheet = () => {
    setSheetOpen(false)
    if (clearSheetStateTimer.current) window.clearTimeout(clearSheetStateTimer.current)
    // Keep editing state until the close animation ends to avoid flashing "create" UI.
    clearSheetStateTimer.current = window.setTimeout(() => {
      setEditingTxn(null)
      setPrefillData(null)
      clearSheetStateTimer.current = null
    }, 250)
  }

  useEffect(() => {
    // If the sheet is opened quickly again, don't let a pending timer clear state mid-open.
    if (sheetOpen && clearSheetStateTimer.current) {
      window.clearTimeout(clearSheetStateTimer.current)
      clearSheetStateTimer.current = null
    }
  }, [sheetOpen])

  useEffect(() => {
    return () => {
      if (clearSheetStateTimer.current) window.clearTimeout(clearSheetStateTimer.current)
    }
  }, [])

  const handleSave = async (data: Parameters<typeof addTransaction>[0]) => {
    if (editingTxn) {
      const mappingCount = reimbursementMappingCounts[editingTxn.id] ?? 0
      const currentCategory = editingTxn.categoryId ? categoryById.get(editingTxn.categoryId) : undefined
      const nextCategory = data.categoryId ? categoryById.get(data.categoryId) : undefined
      const wasReimbursableExpense = editingTxn.kind === 'expense' && editingTxn.reimbursable === 1
      const willBeReimbursableExpense = data.kind === 'expense' && data.reimbursable === 1
      const wasReimbursementIncome =
        editingTxn.kind === 'income' &&
        currentCategory?.kind === 'income' &&
        currentCategory.name === 'Remboursements'
      const willBeReimbursementIncome =
        data.kind === 'income' &&
        nextCategory?.kind === 'income' &&
        nextCategory.name === 'Remboursements'

      if (mappingCount > 0 && wasReimbursableExpense && !willBeReimbursableExpense) {
        const confirmed = window.confirm(
          'This expense has reimbursement mappings. Turning off reimbursable will clear its mappings and manual settlement state.',
        )
        if (!confirmed) return
      }

      if (mappingCount > 0 && wasReimbursementIncome && !willBeReimbursementIncome) {
        const confirmed = window.confirm(
          'This reimbursement income has mappings. Changing it out of the Remboursements category will clear those mappings.',
        )
        if (!confirmed) return
      }
    }

    startTransition(async () => {
      if (editingTxn) {
        let propagateRecurringAmount = false
        const amountChanged =
          typeof data.amount === 'number' && Math.abs(Number(data.amount) - Number(editingTxn.amount)) > 0.005

        if (editingTxn.recurringId && amountChanged) {
          const now = new Date()
          const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
          const isInCurrentMonth = editingTxn.date.startsWith(monthKey)
          if (isInCurrentMonth) {
            const candidates = txns
              .filter((t) => t.recurringId === editingTxn.recurringId && t.date.startsWith(monthKey))
              .slice()
              .sort((a, b) => {
                if (a.date !== b.date) return a.date.localeCompare(b.date)
                if (a.createdAt !== b.createdAt) return a.createdAt.localeCompare(b.createdAt)
                return a.id.localeCompare(b.id)
              })
            const latest = candidates[candidates.length - 1]
            const isLatestThisMonth = latest?.id === editingTxn.id
            if (isLatestThisMonth) {
              propagateRecurringAmount = window.confirm(
                'This is the latest instance of this recurring item this month.\n\nPush this amount to the recurring template going forward?',
              )
            }
          }
        }

        await updateTransactionWithRecurringAmountOption(
          editingTxn.id,
          data,
          { propagateRecurringAmount },
        )
      } else {
        await addTransaction({
          ...data,
          recurringId: prefillData?.recurringId ?? null,
          recurringAmountId: prefillData?.recurringAmountId ?? null,
        })
      }
    })
    closeSheet()
  }

  const handleDelete = async () => {
    if (!editingTxn) return
    startTransition(async () => { await deleteTransaction(editingTxn.id) })
    closeSheet()
  }

  const handleDetach = async () => {
    if (!linkingTxn) return
    startTransition(async () => { await detachTransactionFromRecurring(linkingTxn.id) })
    setLinkSheetOpen(false)
    setLinkingTxn(null)
  }

  const toggleSelectionMode = () => {
    setSelectionMode((v) => !v)
    setSelectedIds(new Set())
  }

  const exitSelectionMode = () => {
    setSelectionMode(false)
    setSelectedIds(new Set())
    setBulkSheetOpen(false)
  }

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllVisible = () => setSelectedIds(new Set(visibleRealIds))

  const selectAllInMonth = (month: string) => {
    const ids = visibleEntries
      .filter((m) => !isInstance(m) && m.date.startsWith(month))
      .map((m) => m.id)
    setSelectedIds((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => next.add(id))
      return next
    })
  }

  const handleOpenInstance = (entry: InstanceEntry) => {
    setPrefillData({
      date: entry.date,
      amount: entry.amount,
      kind: entry.kind,
      method: entry.method,
      categoryId: entry.categoryId,
      merchantId: entry.merchantId,
      note: entry.name,
      recurringId: entry.recurringId,
      recurringAmountId: null,
    })
    setEditingTxn(null)
    setSheetOpen(true)
  }

  const handleOpenMapping = (transaction: Transaction) => {
    setMappingIncome(transaction)
    setMappingSheetOpen(true)
  }

  const handleSaveMapping = (expenseIds: string[]) => {
    if (!mappingIncome) return
    startTransition(async () => {
      await mapReimbursementIncomeToExpenses(mappingIncome.id, expenseIds)
    })
  }

  const isReimbursementIncome = (transaction: Transaction, category?: Category) =>
    transaction.kind === 'income' &&
    category?.kind === 'income' &&
    category.name === 'Remboursements'

  const isReimbursableExpense = (transaction: Transaction) =>
    transaction.kind === 'expense' && transaction.reimbursable === 1

  return (
    <div>
      <div ref={topSentinelRef} />
      <PageHeader
        kicker="All history"
        title={<>Your <em>movements</em></>}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontFamily: 'var(--mono-fern)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-faint)' }}>
              {filteredActual} of {txns.length} in view
              {filteredScheduled > 0 && <> · <span style={{ color: 'var(--butter-ink)' }}>{filteredScheduled} scheduled</span></>}
            </span>
            {!selectionMode && (
              <>
                <FernButton tone="outline" onClick={() => setImportOpen(true)}>
                  <Icon name="upload" size={16} /> Import
                </FernButton>
                <FernButton onClick={() => { setEditingTxn(null); setPrefillData(null); setSheetOpen(true) }}>
                  <Icon name="plus" size={16} /> Add
                </FernButton>
              </>
            )}
            <FernButton tone={selectionMode ? 'teal' : 'outline'} onClick={toggleSelectionMode}>
              <Icon name="check-square" size={16} /> {selectionMode ? 'Cancel' : 'Select'}
            </FernButton>
          </div>
        }
      />

      {/* Row 1: Year picker + Jump to month */}
      {years.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="fern-segmented">
            {years.map((y) => (
              <button
                key={y}
                type="button"
                className={String(selectedYear) === y ? 'active' : ''}
                onClick={() => {
                  const params = new URLSearchParams(window.location.search)
                  params.set('year', y)
                  router.push(`?${params.toString()}`)
                }}
              >
                {y}
              </button>
            ))}
          </div>
          <select
            className="fern-select"
            style={{ maxWidth: 160 }}
            defaultValue=""
            onChange={(e) => {
              const v = e.target.value
              if (v) jumpToMonth(v)
              e.currentTarget.value = ''
            }}
          >
            <option value="" disabled>Jump to month…</option>
            {monthJumpOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Row 2: Search + toggle filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 220, background: 'var(--bg-elevated)', borderRadius: 10, padding: '0 12px', border: '1.5px solid var(--line)', flexShrink: 0 }}>
          <Icon name="search" size={16} style={{ color: 'var(--ink-faint)', flexShrink: 0 }} />
          <input
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: 'var(--ink)', padding: '10px 0', minWidth: 0 }}
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button onClick={() => setQ('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', padding: 0, display: 'grid', placeItems: 'center' }}>
              <Icon name="x" size={14} />
            </button>
          )}
        </div>
        <SegmentedControl
          value={kindFilter}
          onChange={setKindFilter}
          options={[{ value: 'all', label: 'All' }, { value: 'expense', label: 'Expenses' }, { value: 'income', label: 'Income' }]}
        />
        <SegmentedControl
          value={clearedFilter}
          onChange={(v) => setClearedFilter(v as 'all' | 'cleared' | 'uncleared')}
          options={[{ value: 'all', label: 'All' }, { value: 'cleared', label: 'Cleared' }, { value: 'uncleared', label: 'Pending' }]}
        />
        <div className="fern-segmented">
          <button
            type="button"
            className={showNa ? 'active' : ''}
            onClick={() => setShowNa((v) => !v)}
          >
            Show N/A
          </button>
        </div>
      </div>

      {/* Row 3: Dropdown filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Categories */}
        <Popover open={catFilterOpen} onOpenChange={setCatFilterOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="fern-select"
              style={{ maxWidth: 220, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {catFilterLabel}
              </span>
              {catFilter.size > 0 && (
                <span style={{ fontSize: 12, color: 'var(--ink-faint)', flexShrink: 0 }}>{catFilter.size}</span>
              )}
            </button>
          </PopoverTrigger>
          {catFilterOpen && (
            <PopoverContent style={{ padding: 0, width: 260 }} align="start">
              <Command>
                <CommandInput placeholder="Search categories…" />
                <CommandList>
                  <CommandEmpty>No results</CommandEmpty>
                  <CommandGroup heading="Categories">
                    {categories.map((c) => {
                      const checked = catFilter.has(c.id)
                      return (
                        <CommandItem
                          key={c.id}
                          value={c.name}
                          data-checked={checked ? 'true' : 'false'}
                          onSelect={() => setCatFilter((prev) => {
                            const next = new Set(prev)
                            if (next.has(c.id)) next.delete(c.id)
                            else next.add(c.id)
                            return next
                          })}
                        >
                          <CatSwatch color={c.color} icon={c.icon ?? 'tag'} size={16} />
                          {c.name}
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                  {catFilter.size > 0 && (
                    <CommandGroup>
                      <CommandItem value="Clear categories" onSelect={() => setCatFilter(new Set())}>Clear</CommandItem>
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          )}
        </Popover>

        {/* Merchants */}
        <Popover open={merchantFilterOpen} onOpenChange={setMerchantFilterOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="fern-select"
              style={{ maxWidth: 320, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {merchantFilterLabel}
              </span>
              {merchantFilter.size > 0 && (
                <span style={{ fontSize: 12, color: 'var(--ink-faint)', flexShrink: 0 }}>{merchantFilter.size}</span>
              )}
            </button>
          </PopoverTrigger>
          {merchantFilterOpen && (
            <PopoverContent style={{ padding: 0, width: 320 }} align="start">
              <Command>
                <CommandInput placeholder="Search merchants…" />
                <CommandList>
                  <CommandEmpty>No results</CommandEmpty>
                  <CommandGroup heading="Merchants">
                    {merchantsSortedByName.map((m) => {
                      const checked = merchantFilter.has(m.id)
                      return (
                        <CommandItem
                          key={m.id}
                          value={m.name}
                          data-checked={checked ? 'true' : 'false'}
                          style={{ whiteSpace: 'nowrap' }}
                          onSelect={() => setMerchantFilter((prev) => {
                            const next = new Set(prev)
                            if (next.has(m.id)) next.delete(m.id)
                            else next.add(m.id)
                            return next
                          })}
                        >
                          {m.name}
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                  {merchantFilter.size > 0 && (
                    <CommandGroup>
                      <CommandItem value="Clear merchants" onSelect={() => setMerchantFilter(new Set())}>Clear</CommandItem>
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          )}
        </Popover>

        {/* Payment types */}
        <Popover open={methodFilterOpen} onOpenChange={setMethodFilterOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="fern-select"
              style={{ maxWidth: 220, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {methodFilterLabel}
              </span>
              {methodFilter.size > 0 && (
                <span style={{ fontSize: 12, color: 'var(--ink-faint)', flexShrink: 0 }}>{methodFilter.size}</span>
              )}
            </button>
          </PopoverTrigger>
          {methodFilterOpen && (
            <PopoverContent style={{ padding: 0, width: 260 }} align="start">
              <Command>
                <CommandInput placeholder="Search payment types…" />
                <CommandList>
                  <CommandEmpty>No results</CommandEmpty>
                  <CommandGroup heading="Payment types">
                    {PAYMENT_METHODS.map((m) => {
                      const checked = methodFilter.has(m)
                      return (
                        <CommandItem
                          key={m}
                          value={paymentMethodLabel(m)}
                          data-checked={checked ? 'true' : 'false'}
                          onSelect={() => setMethodFilter((prev) => {
                            const next = new Set(prev)
                            if (next.has(m)) next.delete(m)
                            else next.add(m)
                            return next
                          })}
                        >
                          <Icon name={paymentMethodIcon(m)} size={14} style={{ color: 'var(--ink-faint)' }} />
                          {paymentMethodLabel(m)}
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                  {methodFilter.size > 0 && (
                    <CommandGroup>
                      <CommandItem value="Clear payment types" onSelect={() => setMethodFilter(new Set())}>Clear</CommandItem>
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          )}
        </Popover>

        {/* Reimbursement states */}
        <Popover open={reimbFilterOpen} onOpenChange={setReimbFilterOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="fern-select"
              style={{ maxWidth: 260, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {reimbFilterLabel}
              </span>
              {reimbursementFilter.size > 0 && (
                <span style={{ fontSize: 12, color: 'var(--ink-faint)', flexShrink: 0 }}>{reimbursementFilter.size}</span>
              )}
            </button>
          </PopoverTrigger>
          {reimbFilterOpen && (
            <PopoverContent style={{ padding: 0, width: 280 }} align="start">
              <Command>
                <CommandInput placeholder="Search states…" />
                <CommandList>
                  <CommandEmpty>No results</CommandEmpty>
                  {(['Summary', 'Expenses', 'Income'] as const).map((group) => (
                    <CommandGroup key={group} heading={group}>
                      {REIMB_OPTIONS.filter((o) => o.group === group).map((o) => {
                        const checked = reimbursementFilter.has(o.value)
                        return (
                          <CommandItem
                            key={o.value}
                            value={o.label}
                            data-checked={checked ? 'true' : 'false'}
                            onSelect={() => setReimbursementFilter((prev) => {
                              const next = new Set(prev)
                              if (next.has(o.value)) next.delete(o.value)
                              else next.add(o.value)
                              return next
                            })}
                          >
                            {o.label}
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                  ))}
                  {reimbursementFilter.size > 0 && (
                    <CommandGroup>
                      <CommandItem value="Clear states" onSelect={() => setReimbursementFilter(new Set())}>Clear</CommandItem>
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          )}
        </Popover>
      </div>

      {selectionMode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <button
            type="button"
            onClick={selectAllVisible}
            style={{ fontSize: 13, color: 'var(--teal-ink)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
          >
            Select all visible ({visibleRealIds.length})
          </button>
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              style={{ fontSize: 13, color: 'var(--ink-faint)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
            >
              Clear selection
            </button>
          )}
        </div>
      )}

      {txns.length === 0 && instanceEntries.length === 0 ? (
        <EmptyState title="No transactions yet" description="Log your first expense or income to see it here." />
      ) : filtered.length === 0 ? (
        <EmptyState illu="◌" title="Nothing matches" description="Try a different search or filter." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {allMonths.slice(0, visibleMonths).map((month) => {
            const dgs = monthGroupsMap[month] ?? []
            const monthLabel = formatDate(month + '-15T12:00:00', 'en-US', { month: 'long', year: 'numeric' })
            const cb = cbExpensesByMonth[month] ?? { cleared: 0, total: 0 }
            return (
              <div key={month} id={`month-${month}`}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
                  <h2 style={{ margin: 0, flex: 1, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-faint)', fontFamily: 'var(--mono-fern)' }}>{monthLabel}</h2>

                  {/* CB monthly KPI: cleared / total (amount sums, expenses only). */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <Icon name={paymentMethodIcon('card')} size={10} style={{ color: 'var(--ink-faint)' }} />
                    <span style={{ fontFamily: 'var(--mono-fern)', fontSize: 12, color: 'var(--ink-faint)' }}>
                      CB:{' '}
                      <span style={{ color: 'var(--ink)' }}>
                        {fmt(cb.cleared)} / {fmt(cb.total)}
                      </span>
                    </span>
                  </div>

                  {/* Reserve space for the right-side action buttons in transaction rows. */}
                  {!selectionMode && <div style={{ width: 64, flexShrink: 0 }} />}
                  {selectionMode && (
                    <button
                      type="button"
                      onClick={() => selectAllInMonth(month)}
                      style={{ fontSize: 12, color: 'var(--teal-ink)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px 2px 8px' }}
                    >
                      Select month
                    </button>
                  )}
                </div>
                <div className="fern-card" style={{ padding: '8px 16px' }}>
                  {dgs.length === 0 && (
                    <div style={{ padding: '10px 4px', fontSize: 13, color: 'var(--ink-faint)' }}>No transactions</div>
                  )}
                  {dgs.map(([date, items]) => {
                    const total = items.reduce((s, m) => s + (m.kind === 'income' ? 1 : -1) * Number(m.amount ?? 0), 0)
                    const label = formatDate(date + 'T12:00:00', 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })
                    return (
                      <div key={date}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 4px 6px', fontSize: 12, borderBottom: '1px solid var(--line-soft)' }}>
                          <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)' }}>{label}</h4>
                          <span style={{ fontFamily: 'var(--mono-fern)', fontSize: 12, color: total >= 0 ? 'var(--sage-ink)' : 'var(--ink-faint)' }}>
                            {total >= 0 ? '+' : '−'}{fmt(Math.abs(total))}
                          </span>
                        </div>
                        {items.map((m) => {
                    const cat = m.categoryId ? categoryById.get(m.categoryId) : undefined
                    if (isInstance(m)) {
                      return (
                        <div
                          key={m.id}
                          className="fern-txn-row"
                          style={{ opacity: m.isNa ? 0.35 : 0.6 }}
                          onClick={() => !m.isNa && handleOpenInstance(m)}
                        >
                          <CatSwatch color={cat?.color} icon={cat?.icon ?? 'tag'} size={34} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: m.isNa ? 'line-through' : undefined }}>
                              {m.name}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                              <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{cat?.name ?? 'Uncategorized'}</span>
                              {!m.isNa && (
                                <Chip tone="scheduled">
                                  <Icon name={paymentMethodIcon(m.method)} size={10} /> {paymentMethodLabel(m.method)}
                                </Chip>
                              )}
                              <Chip tone="recurring"><Icon name="repeat" size={10} /> {m.isNa ? 'N/A' : 'recurring'}</Chip>
                            </div>
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-faint)', fontFamily: 'var(--mono-fern)', flexShrink: 0, textDecoration: m.isNa ? 'line-through' : undefined }}>
                            {m.kind === 'income' ? '+' : '−'}{fmt(Math.abs(m.amount ?? 0))}
                          </div>
                          {m.isNa ? (
                            <button
                              title="Mark as expected again"
                              onClick={(e) => {
                                e.stopPropagation()
                                startTransition(async () => {
                                  await unmarkInstanceNotApplicable(m.instanceId)
                                })
                              }}
                              style={{
                                flexShrink: 0,
                                width: 20,
                                height: 20,
                                borderRadius: 4,
                                border: '1.5px solid var(--line)',
                                background: 'transparent',
                                display: 'grid',
                                placeItems: 'center',
                                cursor: 'pointer',
                                padding: 0,
                                fontSize: 10,
                                color: 'var(--ink-faint)',
                              }}
                            >
                              ↩
                            </button>
                          ) : (
                            <>
                              <button
                                title="Not applicable this month"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  startTransition(async () => {
                                    await markInstanceNotApplicable(m.instanceId)
                                  })
                                }}
                                style={{
                                  flexShrink: 0,
                                  width: 20,
                                  height: 20,
                                  borderRadius: 4,
                                  border: '1.5px solid var(--line)',
                                  background: 'transparent',
                                  display: 'grid',
                                  placeItems: 'center',
                                  cursor: 'pointer',
                                  padding: 0,
                                  fontSize: 10,
                                  color: 'var(--ink-faint)',
                                }}
                              >
                                N/A
                              </button>
                              <button
                                title="Log and mark as cleared"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  startTransition(async () => {
                                    await addTransaction({
                                      date: m.date,
                                      amount: m.amount,
                                      kind: m.kind,
                                      method: m.method,
                                      categoryId: m.categoryId,
                                      merchantId: m.merchantId,
                                      note: m.name,
                                      recurringId: m.recurringId,
                                      recurringAmountId: null,
                                      cleared: 1,
                                    })
                                  })
                                }}
                                style={{
                                  flexShrink: 0,
                                  width: 20,
                                  height: 20,
                                  borderRadius: '50%',
                                  border: '1.5px solid var(--line)',
                                  background: 'transparent',
                                  display: 'grid',
                                  placeItems: 'center',
                                  cursor: 'pointer',
                                  padding: 0,
                                }}
                              />
                            </>
                          )}
                        </div>
                      )
                    }
                    const t = m as Transaction
                    const merchant = t.merchantId ? merchantById.get(t.merchantId) : undefined
                    const isCleared = t.cleared === 1
                    const isSelected = selectedIds.has(t.id)
                    const reimbursementSummary = reimbursementSummaries[t.id]
                    const showReimbursementAction = isReimbursementIncome(t, cat)
                    const showManualSettlementAction = isReimbursableExpense(t)
                    const isManuallySettled = reimbursementSummary?.status === 'manually_settled'
                    return (
                      <div
                        key={t.id}
                        id={`txn-${t.id}`}
                        className="fern-txn-row"
                        onClick={() => {
                          if (selectionMode) {
                            toggleRow(t.id)
                          } else {
                            setEditingTxn(t)
                            setPrefillData(null)
                            setSheetOpen(true)
                          }
                        }}
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
                            {t.recurringId && <Chip tone="recurring"><Icon name="repeat" size={10} /> recurring</Chip>}
                            {reimbursementSummary && (
                              <Chip tone={reimbursementSummary.status === 'reimbursed' || reimbursementSummary.status === 'fully_allocated' || reimbursementSummary.status === 'manually_settled' ? 'recurring' : 'scheduled'}>
                                {reimbursementSummary.label}
                              </Chip>
                            )}
                          </div>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: t.kind === 'income' ? 'var(--sage-ink)' : 'var(--rose-ink)', fontFamily: 'var(--mono-fern)', flexShrink: 0 }}>
                          {t.kind === 'income' ? '+' : '−'}{fmt(Math.abs(t.amount ?? 0))}
                        </div>
                        {!selectionMode && showReimbursementAction && (
                          <button
                            title="Map reimbursement"
                            onClick={(e) => { e.stopPropagation(); handleOpenMapping(t) }}
                            style={{
                              flexShrink: 0,
                              width: 20,
                              height: 20,
                              borderRadius: 6,
                              border: 'none',
                              background: 'var(--teal-bg)',
                              color: 'var(--teal-ink)',
                              display: 'grid',
                              placeItems: 'center',
                              cursor: 'pointer',
                              padding: 0,
                            }}
                          >
                            <Icon name="bank" size={12} />
                          </button>
                        )}
                        {!selectionMode && showManualSettlementAction && (
                          <button
                            title={isManuallySettled ? 'Clear manual settlement' : 'Manually settle reimbursement'}
                            onClick={(e) => {
                              e.stopPropagation()
                              startTransition(async () => {
                                await setExpenseManualSettlement(t.id, !isManuallySettled)
                              })
                            }}
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
                        {!selectionMode && (
                          <button
                            title={t.recurringId ? 'Manage recurring link' : 'Make recurring'}
                            onClick={(e) => { e.stopPropagation(); setLinkingTxn(t); setLinkSheetOpen(true) }}
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
                          onClick={(e) => {
                            e.stopPropagation()
                            if (selectionMode) return
                            startTransition(async () => { await clearTransaction(t.id, !isCleared) })
                          }}
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
                  })}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {canLoadMore && <div ref={bottomSentinelRef} style={{ height: 40 }} />}
        </div>
      )}

      {!selectionMode && (
        <>
          {showScrollTop && (
            <button
              type="button"
              className="fern-fab fern-fab-top"
              aria-label="Scroll to top"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              <Icon name="arrowUp" size={22} />
            </button>
          )}
          <Fab
            onClick={() => { setEditingTxn(null); setPrefillData(null); setSheetOpen(true) }}
            label="Log something"
          />
        </>
      )}

      {selectionMode && selectedIds.size > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 50,
            background: 'var(--bg-elevated)',
            borderTop: '1.5px solid var(--line)',
            padding: '12px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
            {selectedIds.size} selected
          </span>
          <FernButton tone="outline" onClick={exitSelectionMode}>Cancel</FernButton>
          <FernButton tone="teal" onClick={() => setBulkSheetOpen(true)}>
            <Icon name="repeat" size={16} /> Set as recurring
          </FernButton>
        </div>
      )}

      <ImportWizard
        open={importOpen}
        onClose={() => setImportOpen(false)}
        merchants={merchants}
        recurring={recurring}
      />

      <TransactionSheet
        open={sheetOpen}
        onClose={closeSheet}
        categories={categories}
        merchants={merchants}
        item={editingTxn}
        prefill={prefillData ? {
          date: prefillData.date,
          amount: prefillData.amount,
          kind: prefillData.kind,
          method: prefillData.method,
          categoryId: prefillData.categoryId,
          merchantId: prefillData.merchantId,
          note: prefillData.note,
        } : null}
        onSave={handleSave}
        onDelete={editingTxn ? handleDelete : undefined}
      />

      {linkingTxn && (
        <RecurringLinkSheet
          open={linkSheetOpen}
          onClose={() => { setLinkSheetOpen(false); setLinkingTxn(null) }}
          transaction={linkingTxn}
          categories={categories}
          recurring={recurring}
          onDetach={linkingTxn.recurringId ? handleDetach : undefined}
        />
      )}

      {mappingIncome && (
        <ReimbursementMappingSheet
          key={mappingIncome.id}
          open={mappingSheetOpen}
          onClose={() => { setMappingSheetOpen(false); setMappingIncome(null) }}
          income={mappingIncome}
          expenses={eligibleReimbursementExpenses}
          onSave={handleSaveMapping}
        />
      )}

      {selectedTransactions.length > 0 && (
        <BulkRecurringLinkSheet
          open={bulkSheetOpen}
          onClose={() => setBulkSheetOpen(false)}
          transactions={selectedTransactions}
          categories={categories}
          recurring={recurring}
          onDone={exitSelectionMode}
        />
      )}
    </div>
  )
}
