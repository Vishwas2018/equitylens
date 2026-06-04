# Product Requirements Document — EquityLens

> **Document owner:** Product / Founding Engineer
> **Status:** Source of truth — all downstream specs must remain consistent with this PRD.
> **Last reviewed:** FY2026 baseline.

---

## 1. Mission

To become the **operating system for Australian property investors** by giving households and their advisers a single, trusted, deterministic view of _real_ portfolio profitability, tax position, equity trajectory, and hold-versus-sell economics — explained in plain language by AI, but **never calculated** by AI.

## 2. Vision (3-year horizon)

A platform where 100,000+ Australian investors and 5,000+ accountants/brokers collaborate around a versioned, auditable financial truth for every property, replacing the patchwork of spreadsheets, PDFs, and EOFY scrambles that defines current practice.

## 3. Core Value Proposition

| For the investor                 | We deliver                                                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| "Am I actually making money?"    | Deterministic per-property and portfolio cash flow, tax position, and total return — separated, not blended.                         |
| "Should I hold or sell?"         | A versioned scenario engine that compares hold vs. sell vs. refinance vs. ETF-alternative outcomes net of CGT, stamp duty, and fees. |
| "What changed and why?"          | Immutable scenario snapshots locked against the tax rule version they ran under.                                                     |
| "Will my accountant trust this?" | ATO-aligned CSV exports, full audit trail, signed PDF reports with disclaimer footers.                                               |

## 4. Competitive Moat

1. **Deterministic financial engine** — pure TypeScript, versioned per financial year, reproducible byte-for-byte. Competitors using LLMs for tax math will fail audit; we will not.
2. **Australian / Victorian specificity** — land tax brackets, absentee surcharge, vacancy levy, PPOR-to-IP rules, Division 43 vs. 40 depreciation, CGT 50% discount, marginal rate stack. Built in from day one rather than retrofitted.
3. **AI as explainer, not calculator** — RAG-grounded narration over already-computed numbers. Removes hallucination risk while keeping the "feels intelligent" UX.
4. **Audit-grade architecture** — immutable `scenario_results`, locked `tax_rule_set_id` per run, hashable inputs. Required to win accountant trust, which is the channel that compounds.
5. **Hold/sell intelligence** — no Australian competitor models the _opportunity cost net of CGT and re-entry stamp duty_ cleanly. This is the killer feature.

## 5. Target Personas

### P1 — "The Confused Optimiser" (primary, ~70% of MVP TAM)

- PAYG income $150k–$400k, 1–4 investment properties, often Victorian.
- Uses spreadsheets, distrusts agent reports, dreads EOFY.
- Pain: cannot tell if a property is genuinely profitable after tax, depreciation, and land tax.
- Willingness to pay: $25–$50 AUD/month for clarity.

### P2 — "The Portfolio Builder" (secondary, high LTV)

- 5–10 properties, often via trust or company.
- Actively considers refinance, debt recycling, sell-and-redeploy.
- Pain: scenario modelling in Excel is brittle and unsharable with adviser.
- Willingness to pay: $80–$150 AUD/month, sticky once portfolio is loaded.

### P3 — "The Accountant / Broker" (channel persona)

- Manages 20–500 client portfolios.
- Pain: client data arrives as shoeboxes; needs structured, ATO-ready exports.
- Willingness to pay: per-seat $50–$120 AUD/month + per-client overage.
- Strategic value: distribution channel; one accountant = 50+ investor accounts.

### Anti-persona (explicitly not served)

- First-home buyers looking for a mortgage calculator.
- Day-trading-style "property flippers".
- Commercial property funds (different tax regime; out of scope until Phase 3).

## 6. Feature Matrix

Legend — **P** = priority (1 = must, 2 = should, 3 = could), **C** = complexity (S/M/L/XL), **M** = monetisation impact (low/med/high/anchor).

### 6.1 MVP (months 0–6)

| Feature                                                                   | P   | C   | M      | Notes                                                               |
| ------------------------------------------------------------------------- | --- | --- | ------ | ------------------------------------------------------------------- |
| Email/password auth + MFA (TOTP)                                          | 1   | M   | low    | Supabase Auth. AU region pinned.                                    |
| Property CRUD (purchase price, date, ownership %, address, type)          | 1   | M   | low    | One row = one property; multi-owner via `property_ownership` table. |
| Loan CRUD (principal, rate, IO/P&I, offset balance, split loans)          | 1   | M   | high   | Foundational for cash flow.                                         |
| Income records (rent, periods, vacancy)                                   | 1   | S   | med    | No bank-feed integration in MVP.                                    |
| Expense records (council, water, insurance, PM fees, maintenance, strata) | 1   | M   | med    | Manual entry; bulk CSV import.                                      |
| Depreciation schedule import (QS report → structured)                     | 1   | L   | high   | Critical for tax accuracy. Manual entry fallback.                   |
| Cash Flow Service (per property, per FY)                                  | 1   | L   | anchor | Deterministic engine.                                               |
| Tax Service (marginal stack, neg gearing, deductions)                     | 1   | XL  | anchor | Versioned rule set.                                                 |
| Land Tax (VIC) including absentee surcharge                               | 1   | M   | high   | First jurisdiction.                                                 |
| Portfolio dashboard (equity, cash flow, yield, total return)              | 1   | L   | anchor | The "wow" surface.                                                  |
| Scenario Lab — rate shock, rent change, vacancy                           | 1   | XL  | anchor | The killer feature.                                                 |
| Hold vs Sell engine (basic — CGT, agent fees, re-entry cost)              | 1   | XL  | anchor |                                                                     |
| AI explanation panel (read-only narration of numbers)                     | 2   | M   | med    | Strict explain-only boundary.                                       |
| PDF portfolio report export                                               | 2   | M   | med    | Watermarked with disclaimer.                                        |
| CSV export (ATO-aligned)                                                  | 2   | S   | high   | Channel hook for accountants.                                       |
| Stripe billing — Free / Pro / Professional                                | 1   | M   | anchor |                                                                     |

### 6.2 Phase 2 (months 6–12)

| Feature                                               | P   | C   | M      | Notes                     |
| ----------------------------------------------------- | --- | --- | ------ | ------------------------- |
| Multi-organisation / accountant workspaces            | 1   | L   | anchor | P3 persona unlock.        |
| Granular roles (owner, viewer, accountant, admin)     | 1   | M   | high   | Required for orgs.        |
| Refinance simulator (LMI, break costs, new rate path) | 1   | L   | high   |                           |
| Offset account tiering simulation                     | 2   | M   | med    |                           |
| Scheduled reports (monthly/quarterly email PDFs)      | 2   | M   | med    |                           |
| Hold vs Sell vs ETF alternative (opportunity cost)    | 1   | L   | high   | Differentiator.           |
| Bank statement CSV ingestion (categorisation)         | 2   | L   | med    | Not a feed — file upload. |
| Trust / company ownership modelling                   | 1   | XL  | high   | Tax pass-through logic.   |

### 6.3 Phase 3 (months 12–24)

| Feature                                                              | P   | C   | M    | Notes                             |
| -------------------------------------------------------------------- | --- | --- | ---- | --------------------------------- |
| CoreLogic / suburb analytics integration                             | 2   | L   | med  | Licence cost dependent.           |
| NSW / QLD land tax + duty rules                                      | 1   | L   | high | Jurisdiction expansion.           |
| Predictive maintenance forecasting                                   | 3   | L   | low  | Nice-to-have.                     |
| AI portfolio strategist (still explain-only, ranked recommendations) | 2   | L   | high |                                   |
| Debt recycling simulation                                            | 2   | L   | med  |                                   |
| SMSF property modelling                                              | 2   | XL  | high | Specialist niche, high price tag. |

### 6.4 Enterprise (24+ months)

| Feature                                       | P   | C   | M      | Notes             |
| --------------------------------------------- | --- | --- | ------ | ----------------- |
| SSO (SAML / OIDC)                             | 1   | M   | high   | Accounting firms. |
| White-label firm portal                       | 2   | L   | anchor |                   |
| Bulk client onboarding API                    | 1   | L   | high   |                   |
| SOC 2 Type II attestation                     | 1   | XL  | anchor |                   |
| Custom rule packs (firm-specific assumptions) | 2   | L   | high   |                   |

## 7. User Journey Maps

### 7.1 First-Time Investor (P1)

1. Lands on marketing site → "How profitable is _your_ IP, really?" hook.
2. Signs up (email + password), verifies, enrols TOTP.
3. Onboarding wizard: 5 steps — purchase details → loan → rent → expenses → depreciation (optional).
4. Sees first dashboard within 6 minutes. Free tier shows 1 property, redacted scenarios.
5. Trigger: tries to run a rate-shock scenario → paywall → 14-day Pro trial.
6. Activation win: exports first PDF, shares with partner / accountant.

### 7.2 Portfolio Builder (P2)

1. Imports 4–8 properties via CSV (Pro feature).
2. Configures trust ownership splits.
3. Runs portfolio-wide scenario: "What if RBA hikes 100bps over 18 months?"
4. Uses Hold vs Sell on weakest performer; compares to ETF alternative.
5. Schedules quarterly PDF to themselves and broker.

### 7.3 Accountant / Broker (P3)

1. Creates organisation, invites clients via magic-link.
2. Client populates data; accountant has `viewer + comment` role.
3. At EOFY, accountant exports ATO-aligned CSV per client.
4. Uses comparison report to justify advice; PDF includes audit trail of which `tax_rule_set` version ran.

## 8. Explicit Anti-Goals

The platform will **not** do the following. These are guardrails, not roadmap items.

- **No general expense tracking / bookkeeping.** We model investment properties, not everyday spending.
- **No AI-generated tax calculations.** AI explains numbers the engine produced; it never produces them.
- **No tax filing or lodgement.** We export to ATO-compatible formats; we do not lodge.
- **No financial advice (regulated definition).** All output is informational; PDFs and UI carry standardised disclaimers.
- **No real-time bank feeds in MVP.** Open Banking integration deferred to Phase 2+.
- **No real estate listings, leads, or referral marketplace.** Keeps trust positioning clean.
- **No commercial property regime (in MVP).** Different depreciation, GST, and lease structures.
- **No full double-entry accounting.** We are decision intelligence, not Xero.
- **No on-prem deployment.** Multi-tenant SaaS only, AU region.

## 9. Success Metrics (North Star + Inputs)

- **North Star:** Activated portfolios × scenario-runs-per-month.
- **Activation:** ≥1 property fully configured (loan + ≥1 income + ≥1 expense) + ≥1 scenario run within 7 days.
- **Retention:** D30 ≥ 55%, D90 ≥ 40% on Pro.
- **Trust signal:** ≥30% of activated accounts export a PDF or CSV in their first 30 days.
- **Channel KPI:** Accountant-invited clients have D90 retention ≥ 65% (proxy for stickiness).

## 10. Cross-references

- Engine specifics → `/engine/financial-calc-engine.md`
- AI boundary enforcement → `/architecture/ai-integration.md`
- Tier gating → `/product/pricing-and-gating.md`
- Compliance disclaimers → `/architecture/security-and-compliance.md`
