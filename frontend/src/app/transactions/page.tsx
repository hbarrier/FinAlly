"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Circle, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { TransactionSheet, type TransactionRead } from "@/components/transactions/TransactionSheet";
import { ConfirmModal } from "@/components/transactions/ConfirmModal";
import { type CategoryRead } from "@/components/categories/CategorySheet";
import { type MerchantRead } from "@/components/merchants/MerchantSheet";
import { CatSwatch } from "@/components/categories/CatSwatch";
import { API_URL } from "@/lib/api";

interface Filters {
  year: number | null;
  kind: "all" | "expense" | "income";
  categoryId: number | null;
  merchantId: number | null;
  cleared: "all" | "cleared" | "uncleared";
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatAmount(amount: number): string {
  return (
    new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount) + " €"
  );
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<TransactionRead[]>([]);
  const [categories, setCategories] = useState<CategoryRead[]>([]);
  const [merchants, setMerchants] = useState<MerchantRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TransactionRead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TransactionRead | null>(null);

  const currentYear = new Date().getFullYear();
  const [filters, setFilters] = useState<Filters>({
    year: currentYear,
    kind: "all",
    categoryId: null,
    merchantId: null,
    cleared: "all",
  });

  async function fetchAll() {
    setLoading(true);
    try {
      const [tRes, cRes, mRes] = await Promise.all([
        fetch(`${API_URL}/transactions`),
        fetch(`${API_URL}/categories`),
        fetch(`${API_URL}/merchants`),
      ]);
      setTransactions(tRes.ok ? await tRes.json() : []);
      setCategories(cRes.ok ? await cRes.json() : []);
      setMerchants(mRes.ok ? await mRes.json() : []);
    } catch {
      setTransactions([]);
      setCategories([]);
      setMerchants([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAll(); }, []);

  function openCreate() {
    setEditTarget(null);
    setSheetOpen(true);
  }

  function openEdit(txn: TransactionRead) {
    setEditTarget(txn);
    setSheetOpen(true);
  }

  async function handleClear(txn: TransactionRead) {
    const res = await fetch(`${API_URL}/transactions/${txn.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cleared: !txn.cleared }),
    });
    if (res.ok) fetchAll();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const res = await fetch(`${API_URL}/transactions/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    if (res.ok || res.status === 404) fetchAll();
  }

  const availableYears = useMemo(() => {
    const years = new Set(transactions.map((t) => new Date(t.date + "T00:00:00").getFullYear()));
    years.add(currentYear);
    return Array.from(years).sort((a, b) => b - a);
  }, [transactions, currentYear]);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (filters.year !== null) {
        const y = new Date(t.date + "T00:00:00").getFullYear();
        if (y !== filters.year) return false;
      }
      if (filters.kind !== "all" && t.kind !== filters.kind) return false;
      if (filters.categoryId !== null && t.category_id !== filters.categoryId) return false;
      if (filters.merchantId !== null && t.merchant_id !== filters.merchantId) return false;
      if (filters.cleared === "cleared" && !t.cleared) return false;
      if (filters.cleared === "uncleared" && t.cleared) return false;
      return true;
    });
  }, [transactions, filters]);

  function getCat(id: number) {
    return categories.find((c) => c.id === id) ?? null;
  }

  function getMer(id: number | null) {
    if (id === null) return null;
    return merchants.find((m) => m.id === id) ?? null;
  }

  function txnLabel(txn: TransactionRead): string {
    const mer = getMer(txn.merchant_id);
    return mer ? mer.name : (getCat(txn.category_id)?.name ?? "—");
  }

  return (
    <div>
      <PageHeader kicker="Ledger" title={<>Your <em>transactions</em>.</>} />

      {!loading && transactions.length > 0 && (
        <div className="fern-filter-bar">
          {/* Year */}
          <div className="fern-segmented">
            <button
              className={`fern-segmented-btn${filters.year === null ? " active" : ""}`}
              onClick={() => setFilters((f) => ({ ...f, year: null }))}
            >
              All
            </button>
            {availableYears.map((y) => (
              <button
                key={y}
                className={`fern-segmented-btn${filters.year === y ? " active" : ""}`}
                onClick={() => setFilters((f) => ({ ...f, year: y }))}
              >
                {y}
              </button>
            ))}
          </div>

          {/* Kind */}
          <div className="fern-segmented">
            {(["all", "expense", "income"] as const).map((k) => (
              <button
                key={k}
                className={`fern-segmented-btn${filters.kind === k ? " active" : ""}`}
                onClick={() => setFilters((f) => ({ ...f, kind: k }))}
              >
                {k === "all" ? "All" : k.charAt(0).toUpperCase() + k.slice(1)}
              </button>
            ))}
          </div>

          {/* Category */}
          <select
            className="fern-select"
            value={filters.categoryId ?? ""}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                categoryId: e.target.value ? Number(e.target.value) : null,
              }))
            }
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Merchant */}
          <select
            className="fern-select"
            value={filters.merchantId ?? ""}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                merchantId: e.target.value ? Number(e.target.value) : null,
              }))
            }
          >
            <option value="">All merchants</option>
            {merchants.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>

          {/* Cleared */}
          <div className="fern-segmented">
            {(["all", "cleared", "uncleared"] as const).map((c) => (
              <button
                key={c}
                className={`fern-segmented-btn${filters.cleared === c ? " active" : ""}`}
                onClick={() => setFilters((f) => ({ ...f, cleared: c }))}
              >
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: "var(--ink-faint)", fontSize: 14 }}>Loading…</p>
      ) : transactions.length === 0 ? (
        <div className="fern-empty">
          <span className="illu">—</span>
          <p style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)", margin: 0 }}>
            No transactions yet
          </p>
          <p style={{ margin: 0 }}>Tap + to record your first transaction.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="fern-empty">
          <span className="illu">∅</span>
          <p style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)", margin: 0 }}>
            No matching transactions
          </p>
          <p style={{ margin: 0 }}>Try adjusting your filters.</p>
        </div>
      ) : (
        <div className="fern-txn-list">
          {filtered.map((txn) => {
            const cat = getCat(txn.category_id);
            const mer = getMer(txn.merchant_id);
            const secondary = mer && cat ? cat.name : formatDate(txn.date);

            return (
              <div
                key={txn.id}
                className={`fern-txn-row${txn.cleared ? " cleared" : ""}`}
                onClick={() => openEdit(txn)}
              >
                {cat && (
                  <CatSwatch color={cat.color} icon={cat.icon} size={28} />
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {txnLabel(txn)}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-faint)", fontFamily: "var(--mono-fern)", marginTop: 2 }}>
                    {secondary}
                  </div>
                </div>

                <div style={{
                  fontFamily: "var(--mono-fern)",
                  fontSize: 14,
                  fontWeight: 600,
                  color: txn.kind === "income" ? "var(--sage-ink)" : "var(--rose-ink)",
                  flexShrink: 0,
                }}>
                  {formatAmount(txn.amount)}
                </div>

                <button
                  className={`fern-txn-clear-btn${txn.cleared ? " cleared" : ""}`}
                  onClick={(e) => { e.stopPropagation(); handleClear(txn); }}
                  aria-label={txn.cleared ? "Mark uncleared" : "Mark cleared"}
                  title={txn.cleared ? "Mark uncleared" : "Mark cleared"}
                >
                  {txn.cleared
                    ? <Check size={16} strokeWidth={2} />
                    : <Circle size={16} strokeWidth={1.5} />
                  }
                </button>

                <button
                  className="fern-txn-delete-btn"
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(txn); }}
                  aria-label="Delete transaction"
                >
                  <Trash2 size={14} strokeWidth={1.75} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <button className="fern-fab" onClick={openCreate} aria-label="Add transaction">
        <Plus size={26} strokeWidth={2} />
      </button>

      <TransactionSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        transaction={editTarget ?? undefined}
        onSaved={() => { setSheetOpen(false); fetchAll(); }}
        onDelete={(txn) => { setSheetOpen(false); setDeleteTarget(txn); }}
        categories={categories}
        merchants={merchants}
      />

      <ConfirmModal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        transactionLabel={deleteTarget ? txnLabel(deleteTarget) : ""}
      />
    </div>
  );
}
