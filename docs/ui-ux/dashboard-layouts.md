# Dashboard Layouts

> Concrete page-by-page wireframe specifications for every primary surface in EquityLens: Portfolio Overview, Property Detail, Scenario Lab, AI Panel, Reports, and Settings. Grid systems, progressive disclosure rules, and mobile adaptation. Every dimension here is in design-token units (see `/ui-ux/design-system.md`); raw pixels appear only where token constraints don't apply.

---

## 1. Layout Foundation

### 1.1 Shell

Every authenticated screen lives inside the application shell:

```
┌──────────────────────────────────────────────────────────────────┐
│  TopBar (h-14)                                                   │
│  ┌─────┬──────────────────────────────────────────────┬────────┐ │
│  │ Logo│ Workspace switcher · Search · Cmd+K          │ Avatar │ │
│  └─────┴──────────────────────────────────────────────┴────────┘ │
├────────────┬─────────────────────────────────────────────────────┤
│            │                                                     │
│  SideNav   │  Page content (max-w 1440, centered ≥ 1600)        │
│  (w-60)    │                                                     │
│            │                                                     │
│  Dashboard │                                                     │
│  Properties│                                                     │
│  Scenarios │                                                     │
│  Reports   │                                                     │
│  Settings  │                                                     │
│  ─────     │                                                     │
│  AI Panel  │                                                     │
│  (toggle)  │                                                     │
│            │                                                     │
└────────────┴─────────────────────────────────────────────────────┘
```

* **TopBar** height: `--space-7` (56 px). Sticky.
* **SideNav** width: 240 px on `≥ lg`, collapses to icon-only (`w-14`) on `md`, replaced by a bottom tab bar on `< md`.
* **Page content** has a maximum width of 1440 px until the viewport exceeds 1600 px, where it centers; on ≥ 1920 px the right rail expands to a 4-column option.
* **AI Panel** is a right-edge sheet (collapsible), 420 px when open, see § 5.

### 1.2 Grid System

A 12-column grid with `--space-5` (24 px) gutters and 32 px outer padding. Column widths use CSS Grid `grid-template-columns: repeat(12, minmax(0, 1fr))`.

```css
.page-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: var(--space-5);
  padding: var(--space-6);
}
```

### 1.3 Progressive Disclosure Rules

1. **First fold = answers, not inputs.** The user sees their numbers immediately; configuration affordances live below the fold or in side sheets.
2. **Defaults visible, edits in sheets.** Editing a property's assumptions opens a right sheet, not a modal in the centre.
3. **One primary CTA per screen.** Other actions are secondary or live in overflow menus.
4. **No more than 2 levels of tabbing.** Property Detail uses one tab layer (Cash Flow / Tax / Equity / CGT); Scenario Lab uses none — modes are full-page.
5. **Empty states show the path forward**, not "no data." See § 8.

---

## 2. Portfolio Overview

The landing surface after authentication. Goal: in one glance, the investor knows whether their portfolio is gaining, holding, or losing this period.

```
┌─ Page header ──────────────────────────────────────────────────────┐
│ Portfolio (workspace name)        FY2026 ▾  · As at 19 May 2026   │
└────────────────────────────────────────────────────────────────────┘

┌─ KPI strip (4 tiles, equal width, h-32) ─────────────────────────┐
│ Total equity      │ Annual cash flow │ YTD tax pos.    │ Total return │
│  $1,287,400       │  −$8,420         │  +$24,180       │  +9.4%      │
│  ▲ $84k YoY       │  ↓ vs FY25       │  refund est.    │  Index 102.4 │
└──────────────────────────────────────────────────────────────────────┘

┌─ Equity over time (8 cols) ─────────┬─ Composition (4 cols) ─────┐
│  Line: gross equity vs loan balance │ Stacked bar:               │
│  Range: 60 months back              │  Equity by property        │
│                                      │                            │
│                                      │                            │
└─────────────────────────────────────┴────────────────────────────┘

┌─ Properties (12 cols, table) ────────────────────────────────────┐
│ Address                    State  Equity  CashFlow  TaxImpact  ⋮ │
│ 12 Smith St, Carlton VIC   VIC    $420k   −$3,200    +$8,400   ⋯ │
│ 7 Park Rd, Brunswick VIC   VIC    $290k   +$1,800    −$1,200   ⋯ │
│ ...                                                              │
└──────────────────────────────────────────────────────────────────┘

┌─ Insights (8 cols, AI strip)  ──────┬─ Quick actions (4 cols) ───┐
│ [AI badge] "Your portfolio's cash   │ + Add property             │
│ flow has improved by $4,200 since   │ ▷ Run a scenario           │
│ FY25 due to rent increases on the   │ ↓ Export FY26 summary      │
│ Brunswick property. The recent..."  │                            │
│ [How is this generated?]            │                            │
└─────────────────────────────────────┴────────────────────────────┘
```

### 2.1 Data Hierarchy

* Hero numbers in `--text-5xl` weight medium (not bold — bold is reserved for editorial emphasis).
* Delta indicators (▲ / ▼) use semantic colour but at 70 % saturation to avoid drama.
* Sparklines beneath each KPI show 12-month trend.

### 2.2 Loading

Skeleton tiles render at the same dimensions as final content. Stagger-load is forbidden; we wait for the slowest call and reveal all at once to prevent "numbers shifting" — a credibility cost.

### 2.3 Empty State

If no properties: a single centred card occupies the property table area with an illustrated empty state and "Add your first property" primary button.

---

## 3. Property Detail

Per-property deep dive. URL: `/properties/[propertyId]`.

```
┌─ Property header (with status badge, address, primary actions) ──┐
│ 12 Smith St, Carlton VIC 3053 · [active]          Run scenario ▾│
│ Purchased Mar 2019 · House · Mixed-use 100% investment           │
└──────────────────────────────────────────────────────────────────┘

┌─ Tabs ───────────────────────────────────────────────────────────┐
│ Overview · Cash Flow · Tax · Equity · CGT · Loans · History     │
└──────────────────────────────────────────────────────────────────┘

┌─ Tab: Overview ──────────────────────────────────────────────────┐
│                                                                  │
│ ┌─ KPI row (4 tiles) ────────────────────────────────────────┐   │
│ │ Current value · Loan balance · Equity · Yield (gross)      │   │
│ └────────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ┌─ Cash flow (8 cols) ─────┬─ Quick facts (4 cols) ──────────┐   │
│ │ Monthly stacked bar       │ Council: City of Yarra         │   │
│ │ rent vs expenses          │ Land area: 401 m²              │   │
│ │ over 12 months            │ Site value: $920,000           │   │
│ │                           │ Last valued: Apr 2026          │   │
│ │                           │ Ownership: 50/50 (Smith / Lim) │   │
│ └───────────────────────────┴────────────────────────────────┘   │
│                                                                  │
│ ┌─ Recent activity (8 cols) ──────┬─ AI summary (4 cols) ─────┐  │
│ │ Income / expense feed (15 rows) │ [AI badge] "This property │  │
│ │ chronological                    │ has shifted positive..." │  │
│ └─────────────────────────────────┴───────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 3.1 Cash Flow Tab

A 24-month cash flow grid with the same row structure as the export CSV (`/reports-exports/export-templates.md` § 3): income, vacancy, management, council, water, insurance, repairs, depreciation (informational, non-cash), interest, principal, net cash, after-tax cash. Right-aligned tabular numerals. Subtotals at FY boundaries. A toggle switches to a chart view (stacked area).

### 3.2 Tax Tab

Annualised tax position with breakdown:

* Assessable rent
* Less: deductible interest
* Less: deductible expenses (categorised)
* Less: Div 40 depreciation
* Less: Div 43 depreciation
* Net property impact
* Marginal rate applied (with note: "Based on declared taxable income of …")
* Estimated refund / payable

Below: ownership split table for joint owners showing each owner's share.

A persistent inline disclaimer at the bottom of the Tax tab: "Estimates only. Confirm with your tax adviser. See full disclaimer."

### 3.3 Equity Tab

Stacked area chart of loan balance vs property value over the holding period and projected horizon. Cross-reference loan amortisation table below.

### 3.4 CGT Tab

Only visible if user models a sale (via Scenario). Otherwise shows: "Model a sale in Scenario Lab to see CGT estimates."

When populated:

* Sale year input
* Sale price input
* Cost base breakdown
* Capital gain
* Discount applied
* Per-owner CGT estimate
* Net proceeds after tax

### 3.5 Loans Tab

Each loan as an expandable row. On expansion: amortisation table (interest, principal, balance, offset) by year.

### 3.6 History Tab

Timeline of every input change: purchase, refinances, valuations, capital improvements, ownership changes. Audit-source breadcrumb on each entry.

---

## 4. Scenario Lab

The most interaction-dense page. Goal: model a what-if without leaving the screen.

```
┌─ Scenario header ───────────────────────────────────────────────┐
│ "Refinance + rent +5% · 12 Smith St"     Save  Duplicate  Share │
│ Based on: 12 Smith St Carlton · FY2026 ruleset · Engine 1.4.2   │
└─────────────────────────────────────────────────────────────────┘

┌─ Left rail (4 cols) ───┬─ Right canvas (8 cols) ────────────────┐
│ INPUTS                  │  RESULTS (live, < 200 ms recompute)    │
│                         │                                        │
│ Horizon       [30 yrs]  │  ┌─ Summary KPIs ──────────────────┐  │
│                         │  │ After-tax cash · Total return    │  │
│ Capital growth          │  │ Total tax · Net wealth impact    │  │
│   ●─────●─── [5.0%]     │  └──────────────────────────────────┘  │
│                         │                                        │
│ Rent growth             │  ┌─ Cash flow over horizon ─────────┐  │
│   ●───●───── [3.0%]     │  │ Stacked area, period-by-period   │  │
│                         │  └──────────────────────────────────┘  │
│ CPI           [3.0%]    │                                        │
│                         │  ┌─ Equity & loan balance ──────────┐  │
│ Vacancy       [2 wk/yr] │  │ Dual-line chart                  │  │
│                         │  └──────────────────────────────────┘  │
│ Rate shock              │                                        │
│   month [24]            │  ┌─ Tax position by FY ─────────────┐  │
│   bps    [+100]         │  │ Bar chart, refund vs payable      │  │
│                         │  └──────────────────────────────────┘  │
│ Sell in year [—]        │                                        │
│                         │  ┌─ Compare against ────────────────┐  │
│ ─────                   │  │ + Baseline · + Hold              │  │
│ Reset to baseline       │  └──────────────────────────────────┘  │
└─────────────────────────┴────────────────────────────────────────┘

┌─ AI rationale (full width) ─────────────────────────────────────┐
│ [AI badge] "Under these assumptions, this scenario yields a    │
│ net wealth gain of $X over 30 years versus baseline. The       │
│ critical drivers are: (1) rent growth above CPI, (2) rate      │
│ exposure on the variable portion. If rates rose above 7.5%..." │
│ [How is this generated?]   [Copy to notes]                     │
└─────────────────────────────────────────────────────────────────┘
```

### 4.1 Inputs Behaviour

Every input is two-way bound to the URL hash and debounced 200 ms. Recompute fires after debounce; cache hits return < 30 ms (input hash match in `scenario_results`). The "Engine recomputing…" indicator only appears if a recompute exceeds 250 ms.

### 4.2 Compare Mode

"Add comparison" appends a second column in the result canvas with deltas highlighted. A scenario can compare against:

* Baseline (current state)
* Prior scenario in the same property
* A user-saved scenario

### 4.3 Saving

Scenarios are saved (Pro+) or unsaved (Free, ephemeral on refresh). Saved scenarios are immutable post-save; editing creates a new scenario referencing the prior as `parent_scenario_id`.

### 4.4 Hold vs Sell

A special scenario type with a constrained UX: pick a sale month, see the trade-off chart comparing "sell now + invest proceeds in ASX200 at 7 % p.a." vs "hold to horizon end." A clear disclaimer above the chart: "ASX comparator is illustrative; investment returns are not guaranteed."

---

## 5. AI Panel

A right-edge sheet (420 px wide on `≥ lg`, full-width drawer on `< md`). Triggered by `Cmd+J` or the side-nav icon.

```
┌──────────────────────────────────────────┐
│  Ask about this view                    × │
├──────────────────────────────────────────┤
│  Context: 12 Smith St · Scenario "..."   │
│  [✓] Use my portfolio data               │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ "Why did my refund drop in FY27?"  │  │
│  └────────────────────────────────────┘  │
│                                          │
│  [AI badge] Looking at FY27 vs FY26,    │
│  three things changed: (1) your IO       │
│  period ended in Sep 2026, so principal  │
│  repayments started — that's not a tax   │
│  deduction. (2) The variable rate shock  │
│  you modelled increased interest by...   │
│                                          │
│  Sources: cash-flow FY27, loan IO end    │
│  [Copy] [Pin to scenario] [Bad answer]   │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ Suggested follow-ups:              │  │
│  │  · How does this compare to my...   │  │
│  │  · What if rates fall instead?     │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

### 5.1 Constraints

* The AI Panel reads engine-computed values; it cannot compute or override numbers. See `/architecture/ai-integration.md` § 2.
* Every response shows the "Sources" footer linking back to specific engine outputs that informed the answer.
* "Bad answer" button records to `ai_interactions.feedback` for retraining/prompt-improvement reviews.
* The panel never auto-opens.

### 5.2 Suggestions

The panel surfaces 3 suggested questions derived from the current view (e.g. on Tax tab: "Why is my refund smaller this year?"; on Scenario: "What's the break-even rent?"). Suggestions come from a deterministic template registry, not the LLM.

---

## 6. Reports

`/reports` lists generated reports, status, and a "New report" CTA.

```
┌─ Reports ────────────────────────────────────────────────────────┐
│ + New report                            FY2026 ▾  All status ▾  │
├──────────────────────────────────────────────────────────────────┤
│ Title                       Type   FY     Status      Generated  │
│ FY2026 Annual Summary       PDF    2026   ✓ Ready    19 May 26  │
│ FY2026 CGT estimate (sold)  PDF    2026   ⏳ Running  19 May 26  │
│ FY2025 Accountant pack      ZIP    2025   ✓ Ready    01 Jul 25  │
│ FY2025 Schedule of income   CSV    2025   ✓ Ready    01 Jul 25  │
└──────────────────────────────────────────────────────────────────┘
```

New report dialog: select report type, scope (one property / portfolio), FY, format (PDF / CSV / ZIP), optional schedule. Schedule UX inline; no separate page.

---

## 7. Settings

Tabbed: Profile · Organisation · Tax preferences · Subscription · Integrations · Security · Notifications · Data export.

* **Profile**: name, email, theme preference, locale.
* **Organisation**: name, ABN, members (invite + role assignment).
* **Tax preferences**: declared taxable income for the FY, residency status, marginal rate override, tax adviser contact (optional).
* **Subscription**: tier, billing details, invoice history.
* **Integrations**: bank-feed connect (Phase 2), accountant-share links.
* **Security**: password, MFA enrolment, active sessions, account deletion (with 30-day grace, see `/architecture/security-and-compliance.md` § 8).
* **Notifications**: report-ready, scenario-shared, dunning, weekly digest.
* **Data export**: APP-mandated "export everything" zip generator.

---

## 8. Empty States

| Screen              | Empty trigger                       | Treatment                                                                                                |
| ------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Portfolio overview  | No properties                       | Centred card; "Add your first property"; supporting copy explains data flow.                             |
| Property cash flow  | No income/expense records           | Inline prompt; "Connect bank feed (Phase 2)" or "Import CSV"; example data preview.                      |
| Scenario Lab        | No baseline exists                  | Disabled state with copy: "Add a property to build scenarios."                                            |
| AI Panel            | No question asked yet               | Suggested 3 starter prompts based on current view.                                                       |
| Reports             | No reports generated                | "Generate FY{current} summary" primary CTA.                                                              |
| Audit log (admin)   | No actions yet                      | "Activity will appear here."                                                                              |

Empty states never use generic "No data" copy. Every empty state names what's missing and provides exactly one next action.

---

## 9. Mobile Adaptations

| Screen              | Mobile (< 640 px)                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| Portfolio overview  | KPI strip → 2 × 2 grid. Equity chart full width. Property table → card list.                     |
| Property detail     | Tabs become a horizontal scrollable tab strip. Cards stack.                                       |
| Scenario Lab        | Inputs and results stack vertically. Recompute indicator more prominent. "Save" pinned to header.|
| AI Panel            | Full-screen drawer with back chevron.                                                            |
| Reports             | Table → card list; status pill prominent.                                                        |
| Settings            | Tabs → accordion sections.                                                                       |

Charts smaller than 320 px wide collapse to sparkline + key-number presentation; the full chart is reachable via "View detail" overlay.

---

## 10. Performance Targets

| Metric                              | Target                       |
| ----------------------------------- | ---------------------------- |
| First contentful paint (FCP)        | < 1.2 s on 3G fast           |
| Largest contentful paint (LCP)      | < 2.0 s                      |
| Cumulative layout shift (CLS)       | < 0.02 (zero shift on numbers) |
| Interaction to next paint (INP)     | < 200 ms                     |
| Time to interactive on dashboard    | < 2.5 s                      |
| Scenario recompute (cache hit)      | < 50 ms                      |
| Scenario recompute (cache miss)     | < 250 ms                     |

Achieved via:

* Server components on read-heavy pages.
* Streaming SSR.
* Tabular layout reservation (no late-arriving numbers shift the page).
* Recharts with `isAnimationActive=false` on every chart.

---

## 11. Cross-References

* `/ui-ux/design-system.md` — tokens used throughout.
* `/ui-ux/data-viz-guidelines.md` — chart specifications referenced from § 2, § 3, § 4.
* `/architecture/api-contracts.md` § 5 — APIs feeding each screen.
* `/architecture/ai-integration.md` — AI Panel constraints.
* `/reports-exports/export-templates.md` — Report types from § 6.
