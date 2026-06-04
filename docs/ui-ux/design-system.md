# Design System

> The visual and interaction foundation for EquityLens. Tokens, components, accessibility standards, and dark-mode architecture. The system is built on shadcn/ui customised heavily for fintech-trustworthy density and motion restraint. Aesthetic targets: Stripe-grade polish, Linear-grade precision, calm-and-confident colour palette, zero gimmick.

---

## 1. Design Principles

1. **Clarity over decoration.** Numbers are the hero of every screen. Decoration that competes with numerical data is removed.
2. **Calm by default.** No bright reds, no urgency animations, no badges shouting. Financial software must feel like a private bank, not a casino.
3. **Trust through restraint.** A single accent colour; muted palette; sober typography. Visual richness comes from data, not chrome.
4. **Density that breathes.** Bloomberg-terminal information density on dense screens (Scenario Lab), Apple-Wallet whitespace on summary screens (Dashboard).
5. **One source of truth.** Every value (colour, spacing, radius, motion duration) is a token. No raw hex in components. ESLint enforces this.
6. **Accessibility is non-negotiable.** WCAG 2.2 AA minimum; AAA where text-on-data conflict is high-stakes (e.g. red/green for negative/positive cash flow).

---

## 2. Token Architecture

Tokens live in `tokens.css` as CSS custom properties, exported as a TypeScript module for Tailwind config and Recharts theming.

### 2.1 Colour Tokens

We use the OKLCH colour space for predictable perceptual lightness — particularly important when reusing the palette in chart series.

```css
:root {
  /* Neutral ramp — backgrounds, surfaces, borders, text */
  --color-neutral-0: oklch(100% 0 0); /* pure white */
  --color-neutral-50: oklch(98.5% 0.002 247);
  --color-neutral-100: oklch(96.5% 0.004 247);
  --color-neutral-200: oklch(92% 0.006 247);
  --color-neutral-300: oklch(86% 0.008 247);
  --color-neutral-400: oklch(72% 0.012 247);
  --color-neutral-500: oklch(58% 0.016 247);
  --color-neutral-600: oklch(44% 0.018 247);
  --color-neutral-700: oklch(33% 0.018 247);
  --color-neutral-800: oklch(22% 0.014 247);
  --color-neutral-900: oklch(13% 0.01 247);
  --color-neutral-950: oklch(8% 0.008 247);

  /* Accent — a single brand blue, used sparingly */
  --color-accent-500: oklch(58% 0.16 248);
  --color-accent-600: oklch(50% 0.18 250);
  --color-accent-700: oklch(42% 0.18 252);

  /* Semantic colours — calibrated for AA contrast on neutral-0 and neutral-950 */
  --color-positive-500: oklch(56% 0.13 158); /* gain / refund / equity green */
  --color-positive-100: oklch(96% 0.04 158);
  --color-negative-500: oklch(56% 0.18 25); /* loss / payable / risk amber-red */
  --color-negative-100: oklch(96% 0.04 25);
  --color-warning-500: oklch(72% 0.15 80); /* attention / unverified data */
  --color-info-500: oklch(60% 0.1 230);

  /* Surface tokens — what UI consumes */
  --bg-page: var(--color-neutral-50);
  --bg-surface: var(--color-neutral-0);
  --bg-elevated: var(--color-neutral-0);
  --bg-muted: var(--color-neutral-100);
  --bg-overlay: oklch(0% 0 0 / 0.4);

  --fg-default: var(--color-neutral-900);
  --fg-muted: var(--color-neutral-600);
  --fg-subtle: var(--color-neutral-500);
  --fg-on-accent: var(--color-neutral-0);
  --fg-positive: var(--color-positive-500);
  --fg-negative: var(--color-negative-500);

  --border-default: var(--color-neutral-200);
  --border-strong: var(--color-neutral-300);
  --border-focus: var(--color-accent-600);
}

[data-theme='dark'] {
  --bg-page: var(--color-neutral-950);
  --bg-surface: var(--color-neutral-900);
  --bg-elevated: oklch(16% 0.012 247);
  --bg-muted: var(--color-neutral-800);

  --fg-default: var(--color-neutral-50);
  --fg-muted: var(--color-neutral-300);
  --fg-subtle: var(--color-neutral-400);

  --border-default: var(--color-neutral-800);
  --border-strong: var(--color-neutral-700);

  /* Semantic colours retuned for dark BG */
  --color-positive-500: oklch(70% 0.16 158);
  --color-negative-500: oklch(70% 0.16 25);
}
```

### 2.2 Why Single-Accent

The dashboard has up to 8 chart series visible at once. A multi-brand-colour palette competes with chart series. We use neutral grays for chrome, the accent only for interactive affordances (primary buttons, links, focus rings, selected tabs), and a calibrated chart palette (see § 2.4) for data series. This separation prevents users from misreading "blue brand button" as "this data series is blue."

### 2.3 Typography Tokens

```css
:root {
  /* Display: numbers. Tabular figures matter. */
  --font-numeric: 'Inter Variable', system-ui, sans-serif;
  --font-numeric-feature: 'tnum' 1, 'ss01' 1, 'cv11' 1;

  /* UI: text */
  --font-sans: 'Inter Variable', system-ui, sans-serif;

  /* Code/mono for IDs, hashes, JSON */
  --font-mono: 'JetBrains Mono Variable', ui-monospace, monospace;

  /* Sizes follow a 1.125 modular scale, anchored at 16px body */
  --text-2xs: 0.6875rem; /* 11px — secondary labels */
  --text-xs: 0.75rem; /* 12px — caption */
  --text-sm: 0.8125rem; /* 13px — table cell */
  --text-md: 0.9375rem; /* 15px — body */
  --text-lg: 1.0625rem; /* 17px — emphasized body */
  --text-xl: 1.3125rem; /* 21px — card title */
  --text-2xl: 1.625rem; /* 26px — section title */
  --text-3xl: 2.0625rem; /* 33px — page title */
  --text-4xl: 2.625rem; /* 42px — hero number */
  --text-5xl: 3.375rem; /* 54px — primary KPI */

  /* Weights */
  --weight-regular: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;

  /* Line heights */
  --leading-tight: 1.15;
  --leading-snug: 1.3;
  --leading-normal: 1.5;
  --leading-relaxed: 1.65;

  /* Letter spacing — slightly tightened for numerical display */
  --tracking-numeric: -0.012em;
}
```

`tnum` (tabular numerals) is enabled on every number. Misaligned digits across a table are a credibility cost we don't pay.

### 2.4 Chart Palette

8 calibrated colours chosen for: equiluminance in OKLCH (≈ 60 % L), AA contrast on both light and dark surfaces, and distinguishability for protanopia/deuteranopia (verified with `colorblindly`).

```css
:root {
  --chart-1: oklch(60% 0.14 248); /* primary blue */
  --chart-2: oklch(60% 0.14 158); /* green */
  --chart-3: oklch(60% 0.14 56); /* amber */
  --chart-4: oklch(60% 0.14 350); /* magenta */
  --chart-5: oklch(60% 0.14 200); /* teal */
  --chart-6: oklch(60% 0.14 30); /* orange-red */
  --chart-7: oklch(60% 0.14 290); /* purple */
  --chart-8: oklch(60% 0.14 120); /* lime */
}
```

Charts always use the palette in order; consistent series-to-colour mapping across a session is enforced by the chart wrapper (see `/ui-ux/data-viz-guidelines.md` § 3).

### 2.5 Spacing & Radii

```css
:root {
  /* 4px base, 8-step ramp */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
  --space-8: 64px;
  --space-9: 96px;

  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-pill: 9999px;
}
```

### 2.6 Elevation

Shadows are minimal. We never use box-shadows for chrome decoration; they exist only when a surface truly floats above another (popovers, sheets, command palette).

```css
:root {
  --shadow-1: 0 1px 2px oklch(0% 0 0 / 0.04); /* card */
  --shadow-2: 0 4px 12px oklch(0% 0 0 / 0.06), 0 1px 2px oklch(0% 0 0 / 0.04); /* popover */
  --shadow-3: 0 16px 32px oklch(0% 0 0 / 0.08), 0 2px 4px oklch(0% 0 0 / 0.05); /* dialog */
  --shadow-ring-focus: 0 0 0 3px var(--border-focus);
}
```

### 2.7 Motion

```css
:root {
  --motion-duration-instant: 80ms;
  --motion-duration-quick: 140ms;
  --motion-duration-default: 200ms;
  --motion-duration-slow: 320ms;

  --motion-ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --motion-ease-emphasized: cubic-bezier(0.2, 0, 0.1, 1);
  --motion-ease-spring: cubic-bezier(0.4, 0, 0.2, 1.4);
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --motion-duration-instant: 0ms;
    --motion-duration-quick: 0ms;
    --motion-duration-default: 0ms;
    --motion-duration-slow: 0ms;
  }
}
```

Motion is functional, never decorative. Tab switches don't animate. Numbers don't "count up." Charts don't bounce. The two animations we allow: page-level fade (200ms), inline opacity for state transition (140ms).

### 2.8 Breakpoints

```css
:root {
  --bp-sm: 640px; /* mobile landscape */
  --bp-md: 768px; /* tablet */
  --bp-lg: 1024px; /* small laptop */
  --bp-xl: 1280px; /* desktop */
  --bp-2xl: 1536px; /* large desktop */
  --bp-3xl: 1920px; /* studio */
}
```

The application's primary experience is desktop (the user is reading dense financial tables). The mobile experience is read-mostly with scenario authoring deferred to desktop (see `/ui-ux/dashboard-layouts.md` § 7).

---

## 3. Component Library

We extend `shadcn/ui` rather than build from scratch. Every customised component lives in `/components/ui/*` and follows the shadcn pattern (component source in the repo, no external runtime dependency). Customisations:

### 3.1 Button

```tsx
// /components/ui/button.tsx

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md font-medium ' +
    'transition-colors focus-visible:outline-none focus-visible:ring-2 ' +
    'focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2 ' +
    'disabled:pointer-events-none disabled:opacity-50 ' +
    'select-none whitespace-nowrap',
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--color-accent-600)] text-[var(--fg-on-accent)] hover:bg-[var(--color-accent-700)]',
        secondary:
          'bg-[var(--bg-muted)] text-[var(--fg-default)] hover:bg-[var(--color-neutral-200)]',
        ghost: 'hover:bg-[var(--bg-muted)] text-[var(--fg-default)]',
        link: 'underline-offset-4 hover:underline text-[var(--color-accent-600)]',
        danger: 'bg-[var(--color-negative-500)] text-[var(--fg-on-accent)] hover:opacity-90',
      },
      size: {
        sm: 'h-8  px-3 text-sm gap-1.5',
        md: 'h-9  px-4 text-md gap-2',
        lg: 'h-11 px-6 text-lg gap-2',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);
```

No "destructive" variant outside literal destruction (delete property, delete account). Side-effect buttons (Run Scenario, Generate Report) are primary.

### 3.2 Money Display

```tsx
// /components/finance/money.tsx
// Centralised so every monetary value formats identically.

interface MoneyProps {
  cents: bigint;
  currency?: 'AUD';
  signMode?: 'cashflow' | 'accounting' | 'none';
  compact?: boolean; // $1.2M instead of $1,200,000
  precision?: 0 | 2; // hide cents on aggregates
  className?: string;
}

export function Money({ cents, signMode = 'none', compact, precision = 2, className }: MoneyProps) {
  const fmt = formatAUD(cents, { compact, precision });
  const negative = cents < 0n;

  const tone =
    signMode === 'cashflow'
      ? negative
        ? 'text-[var(--fg-negative)]'
        : 'text-[var(--fg-positive)]'
      : 'text-[var(--fg-default)]';

  return (
    <span
      className={cn('font-numeric tabular-nums tracking-numeric', tone, className)}
      aria-label={negative ? `${fmt} negative` : fmt}
    >
      {fmt}
    </span>
  );
}
```

`signMode = 'cashflow'` uses red/green; `signMode = 'accounting'` uses parentheses for negatives (CGT reports). The defaults match the report template (`/reports-exports/export-templates.md`).

### 3.3 Data Table

Built on TanStack Table v9. Defaults:

- Right-aligned numeric columns.
- Sticky header.
- Sortable on all numeric columns.
- Row hover at `var(--bg-muted)`.
- Cell padding `--space-3`/`--space-4`.
- Zebra striping disabled by default (re-enables for tables > 12 rows).
- No drop shadows on rows.

### 3.4 Card

Surfaces are `var(--bg-surface)`, border `var(--border-default)`, radius `--radius-md`. Cards never have shadows in flat layouts; shadows only when a card overlays another surface (e.g. property detail sheet on dashboard).

### 3.5 Form Inputs

Heights match button sizes (h-8/h-9/h-11). Money inputs use a dedicated `MoneyInput` that accepts dollars-and-cents string, stores `bigint` cents, and rejects locale-sensitive characters that could mask injection.

### 3.6 Tooltips

Tooltips appear after `300ms` hover delay (200ms on already-active siblings). They never contain interactive content. For interactive surfaces, use `Popover`.

### 3.7 Toasts / Notifications

Bottom-right, `var(--bg-elevated)` surface, `--shadow-2`. Auto-dismiss at 5s except for `error` and `destructive` confirmations.

---

## 4. Accessibility (WCAG 2.2 AA+)

### 4.1 Contrast Ratios

| Token pair                       | Ratio  | WCAG level |
| -------------------------------- | ------ | ---------- |
| `--fg-default` on `--bg-surface` | 15.2:1 | AAA        |
| `--fg-muted` on `--bg-surface`   | 6.4:1  | AA Large+  |
| `--fg-subtle` on `--bg-surface`  | 4.6:1  | AA         |
| Accent button text               | 5.8:1  | AA         |
| Positive text on surface         | 4.7:1  | AA         |
| Negative text on surface         | 4.9:1  | AA         |

Verified automatically with `axe-core` and a custom Storybook test runner. Build fails on any new component below AA.

### 4.2 Focus Management

Every interactive element has a visible focus ring (`--shadow-ring-focus`). Focus order matches DOM order. Modals trap focus and restore on close. Skip-link present at every page top.

### 4.3 Reduced Motion

Honoured at the token level. No motion happens via JS that bypasses the CSS prefer-reduced-motion guard.

### 4.4 Screen Readers

Money values include `aria-label` with explicit "negative" when applicable (NVDA reads `−$1,200` as "minus dollar twelve hundred" otherwise). Tables have `role="grid"`, captions, and column headers. Charts are accompanied by data tables in `<details>` or off-screen `aria-describedby`.

### 4.5 Keyboard

Every workflow is keyboard-completable. `Cmd/Ctrl+K` opens the command palette (search property, jump to scenario, run report). Tab order tested in CI via Playwright traversal.

### 4.6 Touch Targets

Minimum 44×44 px touch targets on mobile breakpoints, including secondary buttons.

### 4.7 Language Attributes

`<html lang="en-AU">`. Number, currency, and date inputs declare AU locale; "FY2026" is read by screen readers as "financial year twenty twenty-six" via `aria-label` overrides.

---

## 5. Dark Mode

Dark mode is not a tinted-light theme; it is a separately-calibrated palette. Both modes ship at parity; the theme toggle persists in `org_user_settings.theme_preference`. System preference detected via `prefers-color-scheme`; user preference overrides.

Chart palettes recalibrate for dark surface: lightness shifts from 60 % to 70 % to maintain contrast.

```tsx
// /components/theme-provider.tsx
function applyTheme(preference: 'light' | 'dark' | 'system') {
  const resolved =
    preference === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : preference;
  document.documentElement.dataset.theme = resolved;
}
```

---

## 6. Responsive Strategy

| Viewport     | Strategy                                                                    |
| ------------ | --------------------------------------------------------------------------- |
| < 640 px     | Read-mostly. Property cards stack. Scenario authoring redirects to desktop. |
| 640–1023 px  | Two-column dashboard. Tables become accordion lists.                        |
| 1024–1279 px | Full app. Three-column layouts on detail pages.                             |
| ≥ 1280 px    | Full app + side-rail navigation always visible.                             |
| ≥ 1920 px    | Optional 4-column dashboard (toggle in settings).                           |

Layout uses CSS Grid with `grid-template-areas`. Container queries are used for cards whose contents adapt to their host width independent of viewport (e.g. the KPI tile shrinks its label at < 240 px width).

---

## 7. Component Inventory (MVP)

| Component          | Variants                                | Notes                                |
| ------------------ | --------------------------------------- | ------------------------------------ |
| Button             | primary, secondary, ghost, link, danger | Sizes sm/md/lg/icon                  |
| Input              | text, money, percent, date              | All money via `MoneyInput`           |
| Select / Combobox  | single, multi                           | shadcn defaults                      |
| Switch / Checkbox  |                                         |                                      |
| Card               | flat, elevated                          | Flat is default                      |
| Table              | basic, sortable, paginated, virtualised | Virtualisation kicks in at 200+ rows |
| Tabs               | underline, segmented                    | Underline default                    |
| Dialog             |                                         |                                      |
| Sheet (side panel) | right, bottom                           | Right for property detail            |
| Popover            |                                         |                                      |
| Command palette    |                                         | `Cmd+K`                              |
| Tooltip            |                                         |                                      |
| Toast              | info, success, warning, error           |                                      |
| Empty state        |                                         | Illustrated, single CTA              |
| Skeleton           |                                         | Shown for > 200 ms loads only        |
| Money (display)    |                                         | See § 3.2                            |
| KPI tile           | sm, md, lg                              | Big number + label + delta           |
| Sparkline          |                                         | 60-period rolling                    |
| Disclaimer banner  | persistent, dismissible                 | Footer of every report screen        |
| Status badge       | draft, active, sold, archived           | Property statuses                    |
| Tier badge         | free, pro, professional                 |                                      |

---

## 8. Disclaimer & Trust Affordances

Trust is a UI concern, not just a footer concern. Every page that shows a calculated number includes:

- A small "How this is calculated" link that opens a sheet explaining the inputs.
- The engine version and ruleset version footer: `Engine 1.4.2 · Ruleset FY2026.1`.
- On AI-generated text: an "AI explanation" badge (small `var(--color-info-500)` chip) and a "How AI explanations work" link to the disclosure.

The persistent footer disclaimer text is centrally managed in `/lib/disclaimers.ts` to avoid drift across screens. See `/architecture/security-and-compliance.md` § 7 for the legal wording.

---

## 9. Linting & Enforcement

- `stylelint-no-unknown-css-properties` blocks raw hex/rgb in components.
- Custom ESLint rule `no-hardcoded-money-format` blocks `.toFixed()`, `.toLocaleString()`, and `Intl.NumberFormat` outside `/lib/money/*`.
- `eslint-plugin-jsx-a11y` enforces baseline accessibility on JSX.
- `chromatic` (or equivalent) runs visual regression on Storybook stories per PR.

---

## 10. Cross-References

- `/ui-ux/dashboard-layouts.md` — page layouts that compose these components.
- `/ui-ux/data-viz-guidelines.md` — Recharts theming using these tokens.
- `/architecture/security-and-compliance.md` § 7 — disclaimer text source.
- `/architecture/ai-integration.md` § 8 — AI explanation badge contract.
