# User Flows

> Step-by-step flows, decision trees, error states, and empty-state handling for the core product surfaces. Mermaid diagrams are the source of truth — UI implementations must match these.

---

## 1. Onboarding

### 1.1 Happy path

```mermaid
sequenceDiagram
    actor U as User
    participant W as Marketing Site
    participant A as Auth (Supabase)
    participant O as Onboarding Wizard
    participant E as Engine
    participant D as Dashboard

    U->>W: Clicks "Get started"
    W->>A: /signup
    A->>U: Email verification link
    U->>A: Verifies, enrols TOTP
    A->>O: Redirect to wizard step 1
    U->>O: Property basics (address, type, purchase date/price)
    U->>O: Ownership %, principal-place flag
    U->>O: Loan (principal, rate, IO/P&I, offset)
    U->>O: Rental income (weekly, lease start, vacancy)
    U->>O: Expenses (council, water, insurance, PM%)
    U->>O: Depreciation (optional QS report or skip)
    O->>E: POST /api/properties (single transaction)
    E->>E: Run first cash-flow + tax computation
    E->>D: Redirect to /portfolio
    D->>U: First-light dashboard with empty-state coaching
```

### 1.2 Onboarding decision tree

```mermaid
flowchart TD
    Start([User signs up]) --> V{Email verified?}
    V -- No --> Resend[Resend verification CTA]
    V -- Yes --> M{MFA enrolled?}
    M -- No --> EnrolMFA[TOTP enrolment screen]
    EnrolMFA --> Step1
    M -- Yes --> Step1[Step 1 - Property basics]
    Step1 --> Step1V{Required fields valid?}
    Step1V -- No --> Step1E[Inline field errors]
    Step1V -- Yes --> Step2[Step 2 - Loan]
    Step2 --> LoanType{Loan type?}
    LoanType -- IO --> IOEnd[Capture IO expiry date]
    LoanType -- P&I --> PIAmort[Capture amort schedule]
    LoanType -- Split --> SplitFlow[Capture each split separately]
    IOEnd --> Step3
    PIAmort --> Step3
    SplitFlow --> Step3
    Step3[Step 3 - Income] --> Step4[Step 4 - Expenses]
    Step4 --> Step5{Has QS report?}
    Step5 -- Yes --> Upload[Upload PDF or enter line items]
    Step5 -- No --> Skip[Skip - flag in tax accuracy]
    Upload --> Submit
    Skip --> Submit
    Submit[Submit to engine] --> EngOK{Calc succeeded?}
    EngOK -- No --> EngErr[Error - Sentry trace ID surfaced]
    EngOK -- Yes --> Dashboard([Portfolio dashboard])
```

### 1.3 Empty / error states

| State                             | Trigger                               | UX response                                                                                                |
| --------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| No properties                     | Account created, wizard not completed | Full-page "Add your first property" CTA with 6-minute estimate badge.                                      |
| Wizard abandoned mid-flow         | User leaves before submit             | Draft persisted in `properties.status='draft'`; banner on next visit "Resume onboarding".                  |
| Engine calc failure               | Deterministic engine throws           | Display Sentry-issued trace ID, block dashboard, offer "Contact support" with prefilled context.           |
| Missing depreciation              | User skipped QS                       | Tax accuracy banner: amber. Tooltip: "Depreciation missing — your tax estimate may understate deductions." |
| Invalid loan rate (>20% or <0.1%) | Validation                            | Inline error with link to "Why this matters".                                                              |

---

## 2. Property Import

```mermaid
sequenceDiagram
    actor U as User (Pro)
    participant UI as Portfolio UI
    participant API as /api/properties/import
    participant V as Zod Validator
    participant E as Engine
    participant DB as Postgres

    U->>UI: Selects CSV (template downloaded)
    UI->>API: multipart/form-data, idempotency-key
    API->>V: Parse rows -> ImportRowSchema[]
    V-->>API: row-level errors (if any)
    alt all rows valid
        API->>DB: BEGIN
        API->>DB: insert properties, loans, income, expenses
        API->>E: enqueue first calc per property
        API->>DB: COMMIT
        API-->>UI: { imported: N, calc_pending: N }
    else partial validation failure
        API-->>UI: 422 with per-row error map; nothing written
    end
    E->>DB: write scenario_results (baseline)
    UI->>U: Toast "Calcs ready" after polling
```

**Rules**

- Imports are atomic: 1 invalid row → entire file rejected with row-by-row diagnostics. We do **not** partially import.
- Idempotency key required; reusing the key returns the previous result, never duplicates.
- File limits: ≤2 MB, ≤500 rows per request. Larger imports queue via Edge Function.

---

## 3. Scenario Simulation

### 3.1 Flow

```mermaid
sequenceDiagram
    actor U as User
    participant UI as Scenario Lab
    participant API as /api/scenarios/run
    participant TR as Tax Rule Loader
    participant E as ScenarioRunner
    participant DB as Postgres
    participant AI as AI Explainer

    U->>UI: Builds scenario (rate +1%, vacancy 4 wks, FY2026)
    UI->>API: POST /scenarios/run (scenario_input + scope)
    API->>TR: Load tax_rule_set for FY + jurisdiction
    TR-->>API: tax_rule_set_id (locked)
    API->>E: run({ inputs, tax_rule_set_id, input_hash })
    E->>E: Pure deterministic compute
    E->>DB: INSERT scenario_results (immutable)
    API-->>UI: scenario_result_id + summary
    UI->>API: GET /scenarios/{id}/explain
    API->>AI: prompt(template=cashflow_explain, payload=numbers_only)
    AI-->>API: structured JSON narrative
    API-->>UI: Narrative rendered alongside numbers
```

### 3.2 Decision tree

```mermaid
flowchart TD
    Run([User clicks Run scenario]) --> Q{Tier?}
    Q -- Free --> P[Paywall - upgrade to Pro]
    Q -- Pro / Pro+ --> H{Input hash already computed?}
    H -- Yes --> Cache[Serve cached scenario_result]
    H -- No --> R[Compute fresh]
    R --> S{Computation succeeded?}
    S -- No --> Err[Error w/ trace - keep inputs intact]
    S -- Yes --> Store[Persist immutable result + input_hash]
    Store --> AI{User opens Explain panel?}
    AI -- No --> Done([Show numbers])
    AI -- Yes --> NarrCheck{Narrative cached?}
    NarrCheck -- Yes --> Render
    NarrCheck -- No --> Call[Call LLM with numbers-only prompt]
    Call --> Validate{Output passes JSON schema?}
    Validate -- No --> Fallback[Static templated explanation]
    Validate -- Yes --> Render([Render narrative + numbers])
```

### 3.3 Empty / error states

| State                             | UX                                                                |
| --------------------------------- | ----------------------------------------------------------------- |
| No baseline yet                   | Scenario Lab disabled with CTA "Complete a property first".       |
| Engine fails on edge input        | Show inputs, do not store partial result, expose trace ID.        |
| AI down or timeout (>4s)          | Render templated fallback narrative. No retries surfaced to user. |
| Tax rule for requested FY missing | Block run; show "Coming soon for FY2027" message.                 |

---

## 4. Hold vs Sell Decision

```mermaid
flowchart TD
    Open([Open property -> Hold vs Sell]) --> Inputs[User confirms agent fees, expected sale price, hold horizon]
    Inputs --> Run[Run engine: hold path AND sell path]
    Run --> Hold[Compute hold: 5y cash flow + projected equity + tax]
    Run --> Sell[Compute sell: CGT, agent fees, settlement, redeploy net]
    Run --> ETF[Compute ETF alternative: net proceeds * assumed return]
    Hold --> Compare[Side-by-side compare]
    Sell --> Compare
    ETF --> Compare
    Compare --> AI[AI rationale narrative - explain only]
    AI --> Action{User action}
    Action -- Save scenario --> Save[Persist + share link]
    Action -- Export PDF --> PDF[Generate PDF with disclaimer]
    Action -- Discard --> Discard([Return to property page])
```

**Edge cases**

- Property held <12 months → CGT 50% discount not applied; UI highlights this.
- Joint ownership → tax computed per owner share, presented per-owner and aggregated.
- Trust ownership → distribution scenario configurable; default = equal distribution.

---

## 5. Report Export

```mermaid
sequenceDiagram
    actor U as User
    participant UI as Reports
    participant API as /api/reports
    participant Q as Job Queue (Upstash)
    participant W as Worker (Edge Fn)
    participant S as Supabase Storage
    participant M as Mailer

    U->>UI: Selects template + date range
    UI->>API: POST /reports (template_id, params)
    API->>Q: enqueue job_id
    API-->>UI: 202 + job_id
    Q->>W: deliver job
    W->>W: render PDF / CSV from immutable scenario_results
    W->>S: upload to private bucket
    W->>API: callback: completed + signed URL
    UI->>API: poll /reports/{job_id}
    API-->>UI: signed URL (15 min TTL)
    U->>S: GET signed URL (browser download)
    opt scheduled
        W->>M: send email with secure link
    end
```

### 5.1 Empty states

- No properties → Reports page shows lock state with onboarding CTA.
- No scenarios yet → Only "Portfolio Summary" and "Per-Property Snapshot" templates available; scenario-based templates greyed out.

### 5.2 Failure handling

- PDF render failure → retry x2 with exponential backoff; on final failure, alert user via in-app notification + email; never silent.
- Email delivery bounce → mark notification as failed; user can re-trigger from in-app job history.

---

## 6. Cross-references

- API contracts for each call → `/architecture/api-contracts.md`
- Engine determinism guarantees → `/engine/financial-calc-engine.md`
- AI prompt templates → `/architecture/ai-integration.md`
