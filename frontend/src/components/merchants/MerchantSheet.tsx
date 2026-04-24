"use client";

import { Dialog } from "@base-ui/react/dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { API_URL } from "@/lib/api";
import { type CategoryRead } from "@/components/categories/CategorySheet";

export interface MerchantRead {
  id: number;
  name: string;
  comment: string | null;
  category_id: number | null;
  is_active: boolean;
  transaction_count: number;
}

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  comment: z.string().nullable().transform((v) => (v === "" ? null : v)),
  category_id: z.number().nullable(),
  is_active: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface MerchantSheetProps {
  open: boolean;
  onClose: () => void;
  merchant?: MerchantRead;
  onSaved: () => void;
  categories: CategoryRead[];
}

export function MerchantSheet({ open, onClose, merchant, onSaved, categories }: MerchantSheetProps) {
  const isEdit = merchant !== undefined;
  const [serverError, setServerError] = useState<string | null>(null);
  const [comboOpen, setComboOpen] = useState(false);
  const [comboText, setComboText] = useState("");
  const comboRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", comment: null, category_id: null, is_active: true },
  });

  const watchedCategoryId = watch("category_id");
  const watchedIsActive = watch("is_active");

  useEffect(() => {
    if (!open) return;
    setServerError(null);
    setComboOpen(false);
    if (merchant) {
      const cat = categories.find((c) => c.id === merchant.category_id);
      setComboText(cat?.name ?? "");
      reset({
        name: merchant.name,
        comment: merchant.comment,
        category_id: merchant.category_id,
        is_active: merchant.is_active,
      });
    } else {
      setComboText("");
      reset({ name: "", comment: null, category_id: null, is_active: true });
    }
  }, [open, merchant, categories, reset]);

  // Close combobox when clicking outside
  useEffect(() => {
    if (!comboOpen) return;
    function handleClick(e: MouseEvent) {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) {
        setComboOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [comboOpen]);

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(comboText.toLowerCase())
  );

  function selectCategory(cat: CategoryRead | null) {
    setValue("category_id", cat?.id ?? null);
    setComboText(cat?.name ?? "");
    setComboOpen(false);
  }

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const url = isEdit ? `${API_URL}/merchants/${merchant.id}` : `${API_URL}/merchants`;
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

  const selectedCategoryName = categories.find((c) => c.id === watchedCategoryId)?.name;

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fern-sheet-backdrop" />
        <Dialog.Popup className="fern-sheet-popup">
          <div className="fern-sheet-header">
            <Dialog.Title className="fern-sheet-title">
              {isEdit ? "Edit merchant" : "New merchant"}
            </Dialog.Title>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} style={{ display: "contents" }}>
            <div className="fern-sheet-body">
              {/* Name */}
              <div>
                <label className="fern-field-label" htmlFor="merchant-name">Name</label>
                <input
                  id="merchant-name"
                  className="fern-input"
                  placeholder="e.g. Netflix"
                  {...register("name")}
                />
                {errors.name && (
                  <p style={{ fontSize: 12, color: "var(--rose-ink)", marginTop: 4 }}>
                    {errors.name.message}
                  </p>
                )}
              </div>

              {/* Comment */}
              <div>
                <label className="fern-field-label" htmlFor="merchant-comment">Comment</label>
                <textarea
                  id="merchant-comment"
                  className="fern-input"
                  placeholder="Optional note…"
                  rows={2}
                  style={{ resize: "vertical" }}
                  {...register("comment")}
                />
              </div>

              {/* Category combobox */}
              <div>
                <label className="fern-field-label">Default category</label>
                <div className="fern-combobox-wrap" ref={comboRef}>
                  <input
                    className="fern-input"
                    placeholder="Search categories…"
                    value={comboText}
                    onFocus={() => setComboOpen(true)}
                    onChange={(e) => {
                      setComboText(e.target.value);
                      setComboOpen(true);
                      if (e.target.value === "") setValue("category_id", null);
                    }}
                    autoComplete="off"
                  />
                  {comboOpen && (
                    <div className="fern-combobox-dropdown">
                      {comboText !== "" && (
                        <div
                          className="fern-combobox-option"
                          style={{ color: "var(--ink-faint)" }}
                          onMouseDown={() => selectCategory(null)}
                        >
                          Clear selection
                        </div>
                      )}
                      {filteredCategories.length === 0 ? (
                        <div className="fern-combobox-empty">No categories found</div>
                      ) : (
                        filteredCategories.map((cat) => (
                          <div
                            key={cat.id}
                            className="fern-combobox-option"
                            onMouseDown={() => selectCategory(cat)}
                          >
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                background: `var(--${cat.color})`,
                                flexShrink: 0,
                              }}
                            />
                            {cat.name}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
                {selectedCategoryName && !comboOpen && (
                  <p style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 4 }}>
                    Selected: {selectedCategoryName}
                  </p>
                )}
              </div>

              {serverError && (
                <p style={{ fontSize: 12, color: "var(--rose-ink)" }}>{serverError}</p>
              )}

              {/* Active toggle */}
              <div>
                <label className="fern-field-label">Status</label>
                <div className="fern-type-toggle">
                  <button
                    type="button"
                    className={`fern-type-toggle-btn${watchedIsActive ? " income" : ""}`}
                    onClick={() => setValue("is_active", true)}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    className={`fern-type-toggle-btn${!watchedIsActive ? " expense" : ""}`}
                    onClick={() => setValue("is_active", false)}
                  >
                    Inactive
                  </button>
                </div>
              </div>
            </div>

            <div className="fern-sheet-footer">
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
