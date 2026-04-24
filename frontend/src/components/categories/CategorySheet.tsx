"use client";

import { Dialog } from "@base-ui/react/dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import * as LucideIcons from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { API_URL } from "@/lib/api";
import { CatSwatch } from "./CatSwatch";
import {
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  COLOR_VARS,
  type CategoryColor,
} from "./constants";

export interface CategoryRead {
  id: number;
  name: string;
  icon: string;
  color: CategoryColor;
  kind: "expense" | "income";
  monthly_spend: number;
  movement_count: number;
}

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  icon: z.string(),
  color: z.enum(CATEGORY_COLORS as [CategoryColor, ...CategoryColor[]]),
  kind: z.enum(["expense", "income"]),
});

type FormValues = z.infer<typeof schema>;

interface CategorySheetProps {
  open: boolean;
  onClose: () => void;
  category?: CategoryRead;
  onSaved: () => void;
}

export function CategorySheet({ open, onClose, category, onSaved }: CategorySheetProps) {
  const isEdit = category !== undefined;
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", icon: "Tag", color: "teal", kind: "expense" },
  });

  const watchedColor = watch("color");
  const watchedIcon = watch("icon");
  const watchedKind = watch("kind");

  useEffect(() => {
    if (!open) return;
    setServerError(null);
    if (category) {
      reset({ name: category.name, icon: category.icon, color: category.color, kind: category.kind });
    } else {
      reset({ name: "", icon: "Tag", color: "teal", kind: "expense" });
    }
  }, [open, category, reset]);

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const url = isEdit ? `${API_URL}/categories/${category.id}` : `${API_URL}/categories`;
    const method = isEdit ? "PATCH" : "POST";
    const body = isEdit
      ? { name: values.name, icon: values.icon, color: values.color }
      : values;

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.status === 409) {
      setServerError("A category with that name already exists.");
      return;
    }
    if (!res.ok) {
      setServerError("Something went wrong. Please try again.");
      return;
    }
    onSaved();
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fern-sheet-backdrop" />
        <Dialog.Popup className="fern-sheet-popup">
          <div className="fern-sheet-header">
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <CatSwatch color={watchedColor as CategoryColor} icon={watchedIcon} size={36} />
              <Dialog.Title className="fern-sheet-title">
                {isEdit ? "Edit category" : "New category"}
              </Dialog.Title>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} style={{ display: "contents" }}>
            <div className="fern-sheet-body">
              {/* Name */}
              <div>
                <label className="fern-field-label" htmlFor="cat-name">Name</label>
                <input
                  id="cat-name"
                  className="fern-input"
                  placeholder="e.g. Groceries"
                  {...register("name")}
                />
                {errors.name && (
                  <p style={{ fontSize: 12, color: "var(--rose-ink)", marginTop: 4 }}>
                    {errors.name.message}
                  </p>
                )}
                {serverError && (
                  <p style={{ fontSize: 12, color: "var(--rose-ink)", marginTop: 4 }}>
                    {serverError}
                  </p>
                )}
              </div>

              {/* Kind — create only */}
              {!isEdit && (
                <div>
                  <label className="fern-field-label">Type</label>
                  <div className="fern-type-toggle">
                    {(["expense", "income"] as const).map((k) => (
                      <button
                        key={k}
                        type="button"
                        className={`fern-type-toggle-btn ${watchedKind === k ? k : ""}`}
                        onClick={() => setValue("kind", k)}
                      >
                        {k.charAt(0).toUpperCase() + k.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Color */}
              <div>
                <label className="fern-field-label">Color</label>
                <div className="fern-color-picker">
                  {CATEGORY_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="fern-color-swatch"
                      onClick={() => setValue("color", c)}
                      aria-label={c}
                      style={{
                        background: COLOR_VARS[c].solid,
                        outline: watchedColor === c ? `2px solid ${COLOR_VARS[c].solid}` : "2px solid transparent",
                        outlineOffset: 3,
                        boxShadow: watchedColor === c ? `0 0 0 2px var(--bg-elevated)` : "none",
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Icon */}
              <div>
                <label className="fern-field-label">Icon</label>
                <div className="fern-cat-grid">
                  {CATEGORY_ICONS.map(({ name, label }) => {
                    const IconComp = (LucideIcons as unknown as Record<string, React.ElementType>)[name];
                    if (!IconComp) return null;
                    return (
                      <button
                        key={name}
                        type="button"
                        className={`fern-cat-tile${watchedIcon === name ? " selected" : ""}`}
                        onClick={() => setValue("icon", name)}
                        title={label}
                      >
                        <IconComp size={18} strokeWidth={1.75} />
                        <span>{label}</span>
                      </button>
                    );
                  })}
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
