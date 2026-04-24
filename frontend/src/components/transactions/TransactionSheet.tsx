"use client";

import { Dialog } from "@base-ui/react/dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { API_URL } from "@/lib/api";
import { type CategoryRead } from "@/components/categories/CategorySheet";
import { type MerchantRead } from "@/components/merchants/MerchantSheet";
import { CatSwatch } from "@/components/categories/CatSwatch";

export interface TransactionRead {
  id: number;
  date: string;
  amount: number;
  kind: "expense" | "income";
  category_id: number;
  merchant_id: number | null;
  note: string | null;
  cleared: boolean;
}

const schema = z.object({
  date: z.string().min(1, "Date is required"),
  amount: z.number().positive("Enter a positive amount"),
  kind: z.enum(["expense", "income"]),
  category_id: z.number().int().min(1, "Category is required"),
  merchant_id: z.number().nullable(),
  note: z.string().nullable().transform((v) => (v === "" ? null : v)),
  cleared: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface TransactionSheetProps {
  open: boolean;
  onClose: () => void;
  transaction?: TransactionRead;
  onSaved: () => void;
  onDelete?: (txn: TransactionRead) => void;
  categories: CategoryRead[];
  merchants: MerchantRead[];
}

export function TransactionSheet({
  open,
  onClose,
  transaction,
  onSaved,
  onDelete,
  categories,
  merchants,
}: TransactionSheetProps) {
  const isEdit = transaction !== undefined;
  const [serverError, setServerError] = useState<string | null>(null);

  const [catComboOpen, setCatComboOpen] = useState(false);
  const [catComboText, setCatComboText] = useState("");
  const catComboRef = useRef<HTMLDivElement>(null);

  const [merComboOpen, setMerComboOpen] = useState(false);
  const [merComboText, setMerComboText] = useState("");
  const merComboRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: "",
      amount: undefined as unknown as number,
      kind: "expense",
      category_id: 0,
      merchant_id: null,
      note: "",
      cleared: false,
    },
  });

  const watchedKind = watch("kind");
  const watchedCategoryId = watch("category_id");
  const watchedCleared = watch("cleared");

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  useEffect(() => {
    if (!open) return;
    setServerError(null);
    setCatComboOpen(false);
    setMerComboOpen(false);

    if (transaction) {
      const cat = categories.find((c) => c.id === transaction.category_id);
      const mer = merchants.find((m) => m.id === transaction.merchant_id);
      setCatComboText(cat?.name ?? "");
      setMerComboText(mer?.name ?? "");
      reset({
        date: transaction.date,
        amount: transaction.amount,
        kind: transaction.kind,
        category_id: transaction.category_id,
        merchant_id: transaction.merchant_id,
        note: transaction.note ?? "",
        cleared: transaction.cleared,
      });
    } else {
      setCatComboText("");
      setMerComboText("");
      reset({
        date: today,
        amount: undefined as unknown as number,
        kind: "expense",
        category_id: 0,
        merchant_id: null,
        note: "",
        cleared: false,
      });
    }
  }, [open, transaction, categories, merchants, reset, today]);

  useEffect(() => {
    if (!catComboOpen) return;
    function handleClick(e: MouseEvent) {
      if (catComboRef.current && !catComboRef.current.contains(e.target as Node)) {
        setCatComboOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [catComboOpen]);

  useEffect(() => {
    if (!merComboOpen) return;
    function handleClick(e: MouseEvent) {
      if (merComboRef.current && !merComboRef.current.contains(e.target as Node)) {
        setMerComboOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [merComboOpen]);

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(catComboText.toLowerCase())
  );

  const filteredMerchants = merchants.filter((m) =>
    m.name.toLowerCase().includes(merComboText.toLowerCase())
  );

  function selectCategory(cat: CategoryRead | null) {
    setValue("category_id", cat?.id ?? 0, { shouldValidate: true });
    setCatComboText(cat?.name ?? "");
    setCatComboOpen(false);
  }

  function selectMerchant(mer: MerchantRead | null) {
    setValue("merchant_id", mer?.id ?? null);
    setMerComboText(mer?.name ?? "");
    setMerComboOpen(false);
    if (mer?.category_id) {
      const cat = categories.find((c) => c.id === mer.category_id);
      if (cat) selectCategory(cat);
    }
  }

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const url = isEdit
      ? `${API_URL}/transactions/${transaction.id}`
      : `${API_URL}/transactions`;
    const method = isEdit ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      setServerError("Something went wrong. Please try again.");
      return;
    }
    onSaved();
  }

  const selectedCategory = categories.find((c) => c.id === watchedCategoryId);

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fern-sheet-backdrop" />
        <Dialog.Popup className="fern-sheet-popup">
          <div className="fern-sheet-header">
            <Dialog.Title className="fern-sheet-title">
              {isEdit ? "Edit transaction" : "New transaction"}
            </Dialog.Title>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} style={{ display: "contents" }}>
            <div className="fern-sheet-body">
              {/* Kind toggle */}
              <div>
                <label className="fern-field-label">Type</label>
                <div className="fern-type-toggle">
                  <button
                    type="button"
                    className={`fern-type-toggle-btn${watchedKind === "expense" ? " expense" : ""}`}
                    onClick={() => setValue("kind", "expense")}
                  >
                    Expense
                  </button>
                  <button
                    type="button"
                    className={`fern-type-toggle-btn${watchedKind === "income" ? " income" : ""}`}
                    onClick={() => setValue("kind", "income")}
                  >
                    Income
                  </button>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="fern-field-label" htmlFor="txn-amount">Amount</label>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <input
                    id="txn-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    className="fern-input big"
                    placeholder="0,00"
                    style={{ flex: 1 }}
                    {...register("amount", { valueAsNumber: true })}
                  />
                  <span style={{ fontFamily: "var(--serif)", fontSize: 28, fontStyle: "italic", color: "var(--ink-soft)", flexShrink: 0 }}>
                    €
                  </span>
                </div>
                {errors.amount && (
                  <p style={{ fontSize: 12, color: "var(--rose-ink)", marginTop: 4 }}>
                    {errors.amount.message}
                  </p>
                )}
              </div>

              {/* Date */}
              <div>
                <label className="fern-field-label" htmlFor="txn-date">Date</label>
                <input
                  id="txn-date"
                  type="date"
                  className="fern-input"
                  {...register("date")}
                />
                {errors.date && (
                  <p style={{ fontSize: 12, color: "var(--rose-ink)", marginTop: 4 }}>
                    {errors.date.message}
                  </p>
                )}
              </div>

              {/* Merchant combobox */}
              <div>
                <label className="fern-field-label">Merchant</label>
                <div className="fern-combobox-wrap" ref={merComboRef}>
                  <input
                    className="fern-input"
                    placeholder="Search merchants… (optional)"
                    value={merComboText}
                    onFocus={() => setMerComboOpen(true)}
                    onChange={(e) => {
                      setMerComboText(e.target.value);
                      setMerComboOpen(true);
                      if (e.target.value === "") selectMerchant(null);
                    }}
                    autoComplete="off"
                  />
                  {merComboOpen && (
                    <div className="fern-combobox-dropdown">
                      {merComboText !== "" && (
                        <div
                          className="fern-combobox-option"
                          style={{ color: "var(--ink-faint)" }}
                          onMouseDown={() => selectMerchant(null)}
                        >
                          Clear selection
                        </div>
                      )}
                      {filteredMerchants.length === 0 ? (
                        <div className="fern-combobox-empty">No merchants found</div>
                      ) : (
                        filteredMerchants.map((mer) => (
                          <div
                            key={mer.id}
                            className="fern-combobox-option"
                            onMouseDown={() => selectMerchant(mer)}
                          >
                            {mer.name}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Category combobox */}
              <div>
                <label className="fern-field-label">Category</label>
                <div className="fern-combobox-wrap" ref={catComboRef}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {selectedCategory && (
                      <CatSwatch color={selectedCategory.color} icon={selectedCategory.icon} size={28} />
                    )}
                    <input
                      className="fern-input"
                      placeholder="Search categories…"
                      value={catComboText}
                      onFocus={() => setCatComboOpen(true)}
                      onChange={(e) => {
                        setCatComboText(e.target.value);
                        setCatComboOpen(true);
                        if (e.target.value === "") selectCategory(null);
                      }}
                      autoComplete="off"
                    />
                  </div>
                  {catComboOpen && (
                    <div className="fern-combobox-dropdown">
                      {filteredCategories.length === 0 ? (
                        <div className="fern-combobox-empty">No categories found</div>
                      ) : (
                        filteredCategories.map((cat) => (
                          <div
                            key={cat.id}
                            className="fern-combobox-option"
                            onMouseDown={() => selectCategory(cat)}
                          >
                            <CatSwatch color={cat.color} icon={cat.icon} size={20} />
                            {cat.name}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
                {errors.category_id && (
                  <p style={{ fontSize: 12, color: "var(--rose-ink)", marginTop: 4 }}>
                    {errors.category_id.message}
                  </p>
                )}
              </div>

              {/* Note */}
              <div>
                <label className="fern-field-label" htmlFor="txn-note">Note</label>
                <textarea
                  id="txn-note"
                  className="fern-input"
                  placeholder="Optional note…"
                  rows={2}
                  style={{ resize: "vertical" }}
                  {...register("note")}
                />
              </div>

              {/* Cleared */}
              <div>
                <label className="fern-field-label">Cleared</label>
                <div className="fern-type-toggle">
                  <button
                    type="button"
                    className={`fern-type-toggle-btn${watchedCleared ? " income" : ""}`}
                    onClick={() => setValue("cleared", true)}
                  >
                    Cleared
                  </button>
                  <button
                    type="button"
                    className={`fern-type-toggle-btn${!watchedCleared ? " expense" : ""}`}
                    onClick={() => setValue("cleared", false)}
                  >
                    Uncleared
                  </button>
                </div>
              </div>

              {serverError && (
                <p style={{ fontSize: 12, color: "var(--rose-ink)" }}>{serverError}</p>
              )}
            </div>

            <div className="fern-sheet-footer">
              {isEdit && onDelete && (
                <button
                  type="button"
                  className="fern-sheet-btn danger"
                  onClick={() => onDelete(transaction)}
                >
                  Delete
                </button>
              )}
              <button type="button" className="fern-sheet-btn secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="fern-sheet-btn primary" disabled={isSubmitting}>
                {isSubmitting ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
