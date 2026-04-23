"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  ArrowUpDown,
  RefreshCw,
  Receipt,
  Store,
  Tag,
  Wallet,
  Sun,
  Moon,
  type LucideIcon,
} from "lucide-react";

const NAV_ITEMS: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/movements", label: "Movements", Icon: ArrowUpDown },
  { href: "/recurring", label: "Recurring", Icon: RefreshCw },
  { href: "/reimbursements", label: "Reimbursements", Icon: Receipt },
  { href: "/merchants", label: "Merchants", Icon: Store },
  { href: "/categories", label: "Categories", Icon: Tag },
  { href: "/budgets", label: "Budgets", Icon: Wallet },
];

export function Sidebar() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = localStorage.getItem("fern-theme");
    if (saved === "dark") {
      setTheme("dark");
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }, []);

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next === "dark" ? "dark" : "");
    localStorage.setItem("fern-theme", next);
  }

  return (
    <aside className="fern-sidebar">
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 12px 16px" }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: "var(--terracotta)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontFamily: "var(--serif)",
            fontSize: 20,
            fontStyle: "italic",
          }}
        >
          f
        </div>
        <span
          style={{
            fontFamily: "var(--serif)",
            fontSize: 18,
            fontStyle: "italic",
            color: "var(--ink)",
          }}
        >
          FinAlly
        </span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`fern-nav-item${isActive ? " active" : ""}`}
            >
              <Icon size={16} strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 4px 0",
          borderTop: "1px solid var(--line-soft)",
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "var(--terracotta-bg)",
            color: "var(--terracotta-ink)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 600,
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          H
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)", lineHeight: 1.2 }}>
            Hermine
          </div>
          <div
            style={{
              fontSize: 11,
              fontFamily: "var(--mono-fern)",
              color: "var(--ink-faint)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            EUR
          </div>
        </div>
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--ink-faint)",
            fontSize: 16,
            padding: 4,
            borderRadius: 6,
            transition: "color 0.15s",
          }}
        >
          {theme === "light" ? <Moon size={15} strokeWidth={1.75} /> : <Sun size={15} strokeWidth={1.75} />}
        </button>
      </div>
    </aside>
  );
}
