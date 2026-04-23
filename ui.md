# Fern UI System

A reference for reproducing the look and feel of this app. Fern is a quiet, editorial personal finance app — warm but not colourful, precise but not cold.

---

## Aesthetic

- **Warm neutrals**: backgrounds and text use slightly warm-tinted grays (hue ~60–70 in oklch), never pure grey or white.
- **Accent colour is terracotta**: one dominant warm-orange accent used for primary buttons, active nav items, and focus rings. All other colours are used semantically (sage = income, rose = expense, teal = recurring, butter = scheduled, lilac = supplementary).
- **Serif for display, sans for body, mono for data**: three typefaces with strict roles. Never use serif for body text or mono for labels.
- **Whitespace over density**: cards have generous padding (20px), rows breathe (10px vertical padding). Nothing is crammed.
- **Subtle shadows**: no hard borders on cards — use soft multi-layer box-shadows instead.
- **0.15s transitions**: all interactive state changes (hover, active, open) transition at 150ms.

---

## Fonts

| Variable | Font | Usage |
|---|---|---|
| `--serif` | Instrument Serif (italic 400) | Hero amounts, display headings, empty state illustrations, logo |
| `--font-inter` | Inter | All body text, labels, nav, buttons |
| `--mono-fern` | JetBrains Mono | Dates, amounts in rows, kicker labels (mono uppercase), currency values |

**Kicker pattern** (section labels above titles):
```css
font-size: 11px;
font-family: var(--mono-fern);
text-transform: uppercase;
letter-spacing: 0.1em;
color: var(--ink-faint);
```

**Page title pattern**:
```css
font-size: 28px;
font-weight: 700;
line-height: 1.1;
```
Titles can embed an `<em>` that switches to italic serif: `Hello, <em>Hermine</em>.`

**Hero amounts** (large balance display):
```css
font-family: var(--serif);
font-size: 52px;
line-height: 1;
/* currency symbol: 28px, cents: 26px — both in var(--ink-soft) */
```

---

## Design tokens

### Surface & text (light / dark)

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--bg` | oklch(97.5% 0.012 70) | oklch(18% 0.012 60) | Page background |
| `--bg-elevated` | oklch(99% 0.008 70) | oklch(22% 0.014 60) | Cards, inputs, sidebar |
| `--bg-sunken` | oklch(94% 0.015 70) | oklch(14% 0.01 60) | Segmented controls, ghost buttons, hover states |
| `--ink` | oklch(22% 0.02 60) | oklch(95% 0.008 70) | Primary text |
| `--ink-soft` | oklch(42% 0.015 60) | oklch(75% 0.012 70) | Secondary text, labels |
| `--ink-faint` | oklch(62% 0.012 60) | oklch(55% 0.012 70) | Placeholders, kickers, captions |
| `--line` | oklch(88% 0.012 70) | oklch(30% 0.012 60) | Dividers |
| `--line-soft` | oklch(92% 0.01 70) | oklch(25% 0.012 60) | Row separators |

### Semantic colour palette

Each colour has three variants: `--{name}` (solid), `--{name}-bg` (tinted background), `--{name}-ink` (readable text on that bg).

| Name | Hue | Semantic meaning |
|---|---|---|
| `terracotta` | 40 | Primary action, active nav, focus |
| `sage` | 150 | Income, positive values |
| `rose` | 20 | Expense, negative values, danger |
| `teal` | 200 | Recurring transactions |
| `butter` | 85 | Scheduled / pending |
| `lilac` | 290 | Supplementary tagging |

### Shadows

```css
--fern-shadow-sm: 0 1px 2px oklch(20% 0.02 60 / 0.04), 0 1px 3px oklch(20% 0.02 60 / 0.05);
--fern-shadow:    0 1px 2px oklch(20% 0.02 60 / 0.04), 0 8px 24px oklch(20% 0.02 60 / 0.06);
--fern-shadow-lg: 0 2px 4px oklch(20% 0.02 60 / 0.05), 0 24px 60px oklch(20% 0.02 60 / 0.1);
```

Dark mode doubles the opacity values.

---

## Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  Sidebar (220px fixed)  │  Main content (flex: 1, max 1200px)    │
│  ┌────────────────────┐ │  padding: 32px 40px                    │
│  │ Logo (serif italic)│ │                                         │
│  ├────────────────────┤ │  <PageHeader>                           │
│  │ Nav items          │ │    kicker / title / actions             │
│  │                    │ │                                         │
│  │ (flex: 1)          │ │  Content grid / cards                   │
│  ├────────────────────┤ │                                         │
│  │ User footer        │ │                                         │
│  └────────────────────┘ │                                         │
└──────────────────────────────────────────────────────────────────┘
```

**Sidebar**:
- `background: var(--bg-elevated)`, `border-right: 1px solid var(--line-soft)`
- Logo: 32×32 rounded square (radius 10) in terracotta with italic serif "f"; app name in 18px italic serif beside it.
- Nav items: `padding: 9px 12px`, `border-radius: 10px`, `font-size: 14px`.
  - Default: `color: var(--ink-soft)`, `background: transparent`
  - Active: `color: var(--terracotta-ink)`, `background: var(--terracotta-bg)`, `font-weight: 600`
- User footer: 32×32 avatar tile (terracotta-bg, terracotta-ink, first initial, font-weight 600), name + currency label beside it, theme toggle icon on right.

---

## Core components

### Card (`.fern-card`)

```css
background: var(--bg-elevated);
border-radius: 14px;
box-shadow: var(--fern-shadow);
padding: 20px;
```

Card headings follow the kicker + h3 pattern inside the card. "See all" links inside cards: `font-size: 12px; padding: 4px 8px; border-radius: 8px; background: var(--bg-sunken)`.

---

### Buttons (`.fern-btn`)

```css
display: flex; align-items: center; justify-content: center; gap: 6px;
padding: 10px 16px;
border-radius: 12px;
font-size: 14px; font-weight: 600;
transition: transform 0.1s;
```

| Tone class | Background | Text |
|---|---|---|
| `primary` | `var(--terracotta)` | white |
| `teal` | `var(--teal)` | white |
| `outline` | `var(--bg-elevated)` | `var(--ink-soft)`, border `1.5px solid var(--line)` |
| `ghost` | `var(--bg-sunken)` | `var(--ink-soft)` |
| `danger` | `var(--rose-bg)` | `var(--rose-ink)` |

Sheet footer buttons use smaller variants: `sheet-primary` (flex: 2, radius 10, 13px), `sheet-secondary` (flex: 1), `sheet-delete` (rose tones, left-aligned).

**FAB** (Floating Action Button, `.fern-fab`):
- Fixed bottom-right: `bottom: 28px; right: 28px`
- 52×52, `border-radius: 16px`, terracotta background, white `+` icon (26px)
- Hover: `translateY(-2px)` + larger shadow

---

### Chips (`.fern-chip`)

Small pill badges: `padding: 2px 7px; border-radius: 20px; font-size: 11px; font-weight: 500`.

| Tone | Background | Text |
|---|---|---|
| `income` | `var(--sage-bg)` | `var(--sage-ink)` |
| `expense` | `var(--rose-bg)` | `var(--rose-ink)` |
| `recurring` | `var(--teal-bg)` | `var(--teal-ink)` |
| `scheduled` | `var(--butter-bg)` | `var(--butter-ink)` |

---

### Segmented control (`.fern-segmented`)

Pill group for tab-style filtering.

```css
background: var(--bg-sunken);
border-radius: 10px;
padding: 3px;
```

Button: `padding: 5px 12px; border-radius: 8px; font-size: 13px; font-weight: 500; color: var(--ink-soft)`.
Active button: `background: var(--bg-elevated); color: var(--ink); box-shadow: var(--fern-shadow-sm)`.

---

### Transaction row (`.fern-txn-row`)

```css
display: flex; align-items: center; gap: 12px;
padding: 10px 4px;
border-bottom: 1px solid var(--line-soft);
border-radius: 8px;
cursor: pointer;
transition: background 0.1s;
```
Hover: `background: var(--bg-sunken)`. Last child: no border.

Row anatomy (left to right):
1. **Category swatch** (`CatSwatch`): square with rounded corners (radius ≈ 30% of size), coloured bg + icon
2. **Name + merchant** (flex: 1, overflow ellipsis): name at 13–14px/500, secondary at 12px/ink-faint/mono
3. **Amount** (right): mono font, sage-ink for income, rose-ink for expense, 13–14px/600
4. **Chips** (optional): recurring/scheduled tag

---

### Category swatch (`CatSwatch`)

Coloured icon tile used throughout the app.

```tsx
width: size, height: size,
border-radius: Math.round(size * 0.3),
background: COLOR_VARS[color].bg,
color: COLOR_VARS[color].ink,
```

Default size: 34px. Small variant (row contexts): 28px.

---

### Sheet (slide-over panel)

Slides from the right. Max width 460px (compact: 420px). Background `var(--bg-elevated)`.

Structure:
```
SheetHeader (title)
  └── fern-sheet-body (flex col, gap 18px, padding 0 24px 24px, overflow-y auto)
        ├── form fields
        └── fern-sheet-footer
              ├── [optional delete button]
              ├── Cancel (sheet-secondary)
              └── Save (sheet-primary)
```

Footer: `border-top: 1px solid var(--line); padding-top: 16px; gap: 8px`.

---

### Inputs

```css
.fern-input {
  width: 100%; padding: 10px 14px;
  border-radius: 10px;
  border: 1.5px solid var(--line);
  background: var(--bg-elevated);
  color: var(--ink); font-size: 14px;
  transition: border-color 0.15s;
}
.fern-input:focus { border-color: var(--terracotta); }
```

**Big amount input** (`.fern-input.big`): serif 36px, transparent background, only a bottom border (1.5px). Focus turns bottom border terracotta. Used for primary amount entry in forms.

Field labels (`.fern-field-label`): `font-size: 12px; font-weight: 600; color: var(--ink-soft); margin-bottom: 6px`.

---

### Empty state (`.fern-empty`)

```css
display: flex; flex-direction: column; align-items: center; text-align: center;
padding: 60px 20px; color: var(--ink-soft); gap: 8px;
```

Illustration (`.illu`): large serif italic character or symbol, 48px, `var(--ink-faint)`. Examples: `◇`, `∅`, `◎`, `—`.
Title: 18px.
Description: paragraph in ink-soft.
Action: a button or link below.

---

### Budget bar (`.fern-budget-bar`)

```css
height: 6px;
background: var(--bg-sunken);
border-radius: 99px;
```

Fill (`.fern-budget-fill`): height 100%, radius 99px, `transition: width 0.5s ease`.
Colours by state: `ok` → sage, `warn` → butter, `over` → rose.

---

### Goal card (`.fern-goal-card`)

Grid layout: `auto-fill, minmax(220px, 1fr)`, gap 16px.
Card: elevated bg, radius 18px, padding 20px, centred flex column with ring chart + text.

---

### Type toggle (expense/income selector, `.fern-type-toggle`)

Two equal buttons side by side, gap 8px:
```css
flex: 1; padding: 10px; border-radius: 12px;
border: 1.5px solid var(--line);
background: var(--bg-elevated); color: var(--ink-soft);
font-size: 14px; font-weight: 500;
```
Active expense: rose border, rose-bg, rose-ink.
Active income: sage border, sage-bg, sage-ink.

---

### Category tile grid (`.fern-cat-grid`)

Used for icon/colour pickers: `auto-fill, minmax(80px, 1fr)`, gap 8px.

Tile (`.fern-cat-tile`): 10px padding, radius 12px, border 1.5px, centred flex column, icon + name, 12px text.
Selected: `border-color: var(--terracotta); background: var(--terracotta-bg); color: var(--terracotta-ink)`.

---

## Page structure pattern

Every page follows this structure:

```tsx
<div>
  <PageHeader
    kicker="MONO UPPERCASE LABEL"
    title={<>Page <em>title</em></>}
    actions={<FernButton>Primary action</FernButton>}
  />

  {/* Content: cards, grids, lists */}
  <div className="fern-card">...</div>

  <Fab onClick={openSheet} label="Add something" />

  <SomeSheet open={open} onClose={close} ... />
</div>
```

The `PageHeader` is `display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 24px`.

---

## Dark mode

Toggled by setting `data-theme="dark"` on `<html>`. Theme is persisted to `localStorage` as `fern-theme`. All colour tokens redefine under `[data-theme="dark"]`. No Tailwind dark mode class — use the CSS tokens exclusively.

---

## Dashboard layout

Two-column grid (`1fr 1fr`, gap 16px) for hero cards, then another two-column grid below:

- **Balance card**: `Money` component (serif hero amount) + income/expense chips + net
- **Cash flow card**: area chart (CashflowRiver) + legend
- **"Where it went" card**: horizontal category bars with colour swatches
- **Recurring card**: list of upcoming items with swatch + name + date + amount
