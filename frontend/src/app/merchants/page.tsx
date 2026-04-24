"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { MerchantSheet, type MerchantRead } from "@/components/merchants/MerchantSheet";
import { ConfirmModal } from "@/components/merchants/ConfirmModal";
import { type CategoryRead } from "@/components/categories/CategorySheet";
import { API_URL } from "@/lib/api";

export default function MerchantsPage() {
  const [merchants, setMerchants] = useState<MerchantRead[]>([]);
  const [categories, setCategories] = useState<CategoryRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MerchantRead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MerchantRead | null>(null);

  async function fetchAll() {
    setLoading(true);
    try {
      const [mRes, cRes] = await Promise.all([
        fetch(`${API_URL}/merchants`),
        fetch(`${API_URL}/categories`),
      ]);
      setMerchants(mRes.ok ? await mRes.json() : []);
      setCategories(cRes.ok ? await cRes.json() : []);
    } catch {
      setMerchants([]);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAll(); }, []);

  function openCreate() {
    setEditTarget(null);
    setSheetOpen(true);
  }

  function openEdit(merchant: MerchantRead) {
    setEditTarget(merchant);
    setSheetOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const res = await fetch(`${API_URL}/merchants/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    if (res.ok || res.status === 404) fetchAll();
  }

  function findCategory(id: number | null) {
    if (id === null) return null;
    return categories.find((c) => c.id === id) ?? null;
  }

  return (
    <div>
      <PageHeader kicker="Payees" title={<>Your <em>merchants</em>.</>} />

      {loading ? (
        <p style={{ color: "var(--ink-faint)", fontSize: 14 }}>Loading…</p>
      ) : merchants.length === 0 ? (
        <div className="fern-empty">
          <span className="illu">◎</span>
          <p style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)", margin: 0 }}>
            No merchants yet
          </p>
          <p style={{ margin: 0 }}>Tap + to add your first merchant.</p>
        </div>
      ) : (
        <div className="fern-merchant-table">
          <div className="fern-merchant-header">
            <span>Name</span>
            <span>Category</span>
            <span>Comment</span>
            <span>Status</span>
            <span />
          </div>
          {merchants.map((m) => {
            const cat = findCategory(m.category_id);
            return (
              <div key={m.id} className="fern-merchant-row" onClick={() => openEdit(m)}>
                <div style={{ fontWeight: 500, fontSize: 14, color: "var(--ink)" }}>
                  {m.name}
                  {m.transaction_count > 0 && (
                    <span style={{ marginLeft: 6, fontSize: 11, color: "var(--ink-faint)", fontFamily: "var(--mono-fern)" }}>
                      {m.transaction_count} tx
                    </span>
                  )}
                </div>
                <div>
                  {cat ? (
                    <span className={`fern-chip ${cat.kind}`}>{cat.name}</span>
                  ) : (
                    <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>—</span>
                  )}
                </div>
                <div style={{
                  fontSize: 13,
                  color: "var(--ink-soft)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {m.comment ?? <span style={{ color: "var(--ink-faint)" }}>—</span>}
                </div>
                <div>
                  {m.is_active ? (
                    <span style={{ fontSize: 12, color: "var(--sage-ink)" }}>Active</span>
                  ) : (
                    <span className="fern-chip inactive">Inactive</span>
                  )}
                </div>
                <div>
                  <button
                    className="fern-merchant-row-delete"
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(m); }}
                    aria-label={`Delete ${m.name}`}
                  >
                    <Trash2 size={14} strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button className="fern-fab" onClick={openCreate} aria-label="Add merchant">
        <Plus size={26} strokeWidth={2} />
      </button>

      <MerchantSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        merchant={editTarget ?? undefined}
        onSaved={() => { setSheetOpen(false); fetchAll(); }}
        categories={categories}
      />

      <ConfirmModal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        merchantName={deleteTarget?.name ?? ""}
      />
    </div>
  );
}
