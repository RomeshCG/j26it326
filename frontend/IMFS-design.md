# IMFS — Design system

**Project:** IMFS  
**Scope:** Product / app UI only (auth, dashboard, forms, research workflows).

> **Not in scope for now:** There is **no marketing / landing site** in this phase. Do not scaffold public marketing pages, glass headers, pill CTAs, Fraunces headlines, or a separate marketing palette. If a marketing surface is added later, that work should extend this file — not invent a parallel system.

Use this document as the source of truth when building IMFS UI. Do not invent a third palette or typeface unless this file is updated first.

**Last updated:** 2026-08-19

---

## Product surface

| Surface | Feel                                                       | Audience                          |
| ------- | ---------------------------------------------------------- | --------------------------------- |
| **App** | Neutral shadcn system, compact controls, Inter, light/dark | Signed-in researchers / operators |

Rules:

- Light and dark modes via a `.dark` class on `<html>`
- Semantic tokens only (`bg-background`, `text-foreground`, `bg-primary`) — no one-off hex in components
- Near-black primary actions in **light**; near-white primary actions in **dark**
- Lucide icons
- Tailwind CSS v4 with `@theme inline`

Theme persistence: `localStorage` key `imfs-theme` (`light` | `dark`), with `prefers-color-scheme` as fallback. Flash-prevent with an inline script before paint.

---

## Stack

| Layer      | Choice                                          |
| ---------- | ----------------------------------------------- |
| Framework  | React + Vite                                    |
| Styling    | Tailwind v4                                     |
| Components | shadcn/ui **base-nova**, base color **neutral** |
| Icons      | Lucide                                          |
| Theme      | `.dark` class + `ThemeProvider`                 |
| Fonts      | Inter (variable)                                |

---

## Color tokens (OKLCH)

Light (`:root`):

| Token                                  | Value                       | Purpose                  |
| -------------------------------------- | --------------------------- | ------------------------ |
| `--background`                         | `oklch(1 0 0)`              | Page                     |
| `--foreground`                         | `oklch(0.145 0 0)`          | Text                     |
| `--card`                               | `oklch(1 0 0)`              | Cards / dialogs          |
| `--primary`                            | `oklch(0.205 0 0)`          | Buttons, selected chrome |
| `--primary-foreground`                 | `oklch(0.985 0 0)`          | Text on primary          |
| `--secondary` / `--muted` / `--accent` | `oklch(0.97 0 0)`           | Subtle fills             |
| `--muted-foreground`                   | `oklch(0.556 0 0)`          | Helper text              |
| `--destructive`                        | `oklch(0.577 0.245 27.325)` | Errors                   |
| `--border` / `--input`                 | `oklch(0.922 0 0)`          | Borders                  |
| `--ring`                               | `oklch(0.708 0 0)`          | Focus                    |
| `--radius`                             | `0.625rem` (10px)           | Base radius              |
| `--sidebar`                            | `oklch(0.985 0 0)`          | Sidebar                  |

Dark (`.dark`) inverts to dark gray surfaces and **light primary**:

| Token                  | Value                                                   |
| ---------------------- | ------------------------------------------------------- |
| `--background`         | `oklch(0.145 0 0)`                                      |
| `--foreground`         | `oklch(0.985 0 0)`                                      |
| `--card`               | `oklch(0.205 0 0)`                                      |
| `--primary`            | `oklch(0.922 0 0)`                                      |
| `--primary-foreground` | `oklch(0.205 0 0)`                                      |
| `--muted`              | `oklch(0.269 0 0)`                                      |
| `--muted-foreground`   | `oklch(0.708 0 0)`                                      |
| `--border`             | `oklch(1 0 0 / 10%)`                                    |
| `--input`              | `oklch(1 0 0 / 15%)`                                    |
| `--sidebar-primary`    | `oklch(0.488 0.243 264.376)` (~indigo, brand mark only) |

**Light-mode primary is near-black, not indigo.** Indigo is reserved for auth dot-grid and dark sidebar mark (`hue 264–277`).

Use classes: `bg-primary`, `text-primary-foreground`, `text-muted-foreground`, `border-border`, `ring-ring`.

Map tokens into Tailwind with `@theme inline` (`--color-background`, `--color-foreground`, `--color-primary`, …).

---

## Typography

**Inter** variable (Google Fonts, `opsz` + `wght`). Body: `font-sans antialiased`.

Default body / labels: **`text-sm`**. Do not mix `text-xs` / `text-base` / `text-lg` on the same card without hierarchy.

| Role               | Classes                                                             |
| ------------------ | ------------------------------------------------------------------- |
| Page title         | `text-2xl font-semibold tracking-tight`                             |
| Stat value         | `text-3xl font-semibold`                                            |
| Card / modal title | `text-base font-semibold`                                           |
| Body / helper      | `text-sm text-muted-foreground`                                     |
| Labels             | `text-sm font-medium`                                               |
| Eyebrow            | `text-xs font-medium uppercase tracking-wide text-muted-foreground` |
| Button text        | `text-sm font-medium`                                               |
| Numbers            | `tabular-nums` for counters and timers                              |

---

## Radius

| Token          | Formula        | Use                                     |
| -------------- | -------------- | --------------------------------------- |
| `--radius`     | `0.625rem`     | Base                                    |
| `rounded-lg`   | `--radius`     | **Buttons, inputs, chips, cards**       |
| `rounded-xl`   | `1.4 × radius` | Modal shell, dashboard stat cards       |
| `rounded-full` | —              | Status badges only, not primary buttons |

---

## Focus

`focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50`

Invalid: `aria-invalid:border-destructive` + destructive ring.

Selected chips: `border-primary`, `bg-primary/5` (light) / `bg-primary/10` (dark).

---

## Buttons

Shared chrome: `rounded-lg`, `text-sm font-medium`, `inline-flex items-center justify-center`, SVG `size-4`, `disabled:opacity-50`, `active:translate-y-px` (except menus).

**Variants**

| Variant       | Fill                                                               |
| ------------- | ------------------------------------------------------------------ |
| `default`     | `bg-primary text-primary-foreground hover:bg-primary/80`           |
| `outline`     | `border-border bg-background hover:bg-muted` (dark: `bg-input/30`) |
| `secondary`   | `bg-secondary`                                                     |
| `ghost`       | hover `bg-muted`                                                   |
| `destructive` | `bg-destructive/10 text-destructive`                               |
| `link`        | underline offset 4                                                 |

**Sizes**

| Size      | Height / box | Extra                                  |
| --------- | ------------ | -------------------------------------- |
| `default` | **h-8**      | `px-2.5`, `gap-1.5`                    |
| `xs`      | h-6          | `text-xs`, tighter radius              |
| `sm`      | h-7          | `text-[0.8rem]`                        |
| `lg`      | **h-9**      | forms, onboarding footer, choice chips |
| `icon`    | size-8       |                                        |
| `icon-xs` | size-6       |                                        |
| `icon-sm` | size-7       |                                        |
| `icon-lg` | size-9       |                                        |

Convention: default toolbar actions = `default` (h-8). Primary form / modal actions = **`lg` (h-9)**.

---

## Inputs

Default: `h-8`, `rounded-lg`, `border-input`, `px-2.5`, `text-base` / `md:text-sm`, transparent bg, dark `bg-input/30`.

Auth / onboarding fields often override to **`h-9`**.

Placeholders: `text-muted-foreground`.

---

## Layout patterns

| Area            | Spec                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------- |
| Auth shell      | Centered `max-w-2xl` card; indigo **dot grid** (`28px`) + line grid + `bg-primary/8` glow |
| Auth icon badge | `size-10 rounded-lg bg-primary/10 text-primary`                                           |
| Dashboard       | Sidebar layout; content `rounded-xl border bg-card p-5` for KPI cards                     |
| Modal           | `rounded-xl`, header/footer `px-6 py-4`, body `px-6 py-5`                                 |
| Form gaps       | `gap-4` or `gap-5`                                                                        |
| Footer actions  | Back / ghost skip left; primary right                                                     |
| Toasts          | Sonner, `top-right`, `richColors`, close button                                           |

Auth dots (keep hue 277 if you want the same accent):

```css
--auth-dot: oklch(0.58 0.22 277); /* light */
/* dark: oklch(0.72 0.16 277) */
background-size: 28px 28px;
```

---

## Icons

Lucide. Default in buttons: `size-4`. Loading: `Loader2` + `animate-spin`.

---

## Shared rules

1. **Invert, don’t recolor.** Light = black-on-white actions; dark = white-on-black. No brand-colored primary buttons.
2. **Muted text** for secondary copy; never light-gray-on-white below ~4.5:1 contrast.
3. **One radius family:** app = `rounded-lg` controls; `rounded-full` only for status badges.
4. **Disabled** = `opacity-50` or `opacity-60` + `cursor-not-allowed` + no hover.
5. **Do not** add marketing-only fonts (e.g. Fraunces) or pill hero CTAs while marketing is out of scope.

---

## Implementation checklist for IMFS

- [x] shadcn **base-nova** + **neutral**
- [x] Copy OKLCH `:root` / `.dark` tokens into app CSS
- [x] Inter; Button sizes `h-8` default / `h-9` lg
- [x] Input `h-8` (`h-9` on auth/onboarding)
- [x] `.dark` class + `imfs-theme` in localStorage
- [ ] Sidebar + card dashboard
- [ ] Auth shell with dot grid (optional indigo)
- [x] Skip marketing / landing scaffolding for this phase

---
