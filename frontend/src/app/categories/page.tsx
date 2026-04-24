"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { CatSwatch } from "@/components/categories/CatSwatch";
import { CategorySheet, type CategoryRead } from "@/components/categories/CategorySheet";
import { ConfirmModal } from "@/components/categories/ConfirmModal";
import { API_URL } from "@/lib/api";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CategoryRead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryRead | null>(null);

  async function fetchCategories() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/categories`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setCategories(await res.json());
    } catch {
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchCategories(); }, []);

  function openCreate() {
    setEditTarget(null);
    setSheetOpen(true);
  }

  function openEdit(category: CategoryRead) {
    setEditTarget(category);
    setSheetOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const res = await fetch(`${API_URL}/categories/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    if (res.ok || res.status === 404) fetchCategories();
  }

  return (
    <div>
      <PageHeader
        kicker="Tags"
        title={<>Spending <em>categories</em>.</>}
      />

      {loading ? (
        <p style={{ color: "var(--ink-faint)", fontSize: 14 }}>Loading…</p>
      ) : categories.length === 0 ? (
        <div className="fern-empty">
          <span className="illu">◇</span>
          <p style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)", margin: 0 }}>
            No categories yet
          </p>
          <p style={{ margin: 0 }}>Tap + to create your first category.</p>
        </div>
      ) : (
        <div className="fern-cat-page-grid">
          {categories.map((cat) => (
            <div key={cat.id} className="fern-cat-card" onClick={() => openEdit(cat)}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <CatSwatch color={cat.color} icon={cat.icon} size={40} />
                <button
                  className="fern-cat-card-delete"
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(cat); }}
                  aria-label={`Delete ${cat.name}`}
                >
                  <Trash2 size={14} strokeWidth={1.75} />
                </button>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>
                {cat.name}
              </div>
              <div style={{ marginBottom: 8 }}>
                <span className={`fern-chip ${cat.kind}`}>{cat.kind}</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-faint)", fontFamily: "var(--mono-fern)" }}>
                {cat.movement_count} tx · {cat.monthly_spend.toFixed(2)} € this month
              </div>
            </div>
          ))}
        </div>
      )}

      <button className="fern-fab" onClick={openCreate} aria-label="Add category">
        <Plus size={26} strokeWidth={2} />
      </button>

      <CategorySheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        category={editTarget ?? undefined}
        onSaved={() => { setSheetOpen(false); fetchCategories(); }}
      />

      <ConfirmModal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        categoryName={deleteTarget?.name ?? ""}
      />
    </div>
  );
}
