# API Contracts

> tRPC + REST route handlers. Zod is the single source of truth for runtime validation; types are inferred. All error responses follow `application/problem+json` (RFC 7807) shape.

---

## 1. Conventions

### 1.1 Base URLs

| Env     | Base                                 |
| ------- | ------------------------------------ |
| Prod    | `https://app.equitylens.com.au/api`  |
| Staging | `https://staging.equitylens.app/api` |

### 1.2 Authentication

- `Authorization: Bearer <supabase_jwt>` — required on every authenticated endpoint.
- AAL2 (MFA) required on financial mutations and exports; enforced via middleware claim check.

### 1.3 Standard headers

| Header            | Required                     | Purpose                             |
| ----------------- | ---------------------------- | ----------------------------------- |
| `Idempotency-Key` | On all POST mutations        | UUID v4; replay-safe (24 h window). |
| `X-Request-ID`    | Auto-generated if absent     | Traced through OpenTelemetry.       |
| `Accept-Version`  | Optional, defaults to latest | API version pin (`2026-02-01`).     |

### 1.4 Error shape

```json
{
  "type": "https://docs.equitylens.com.au/errors/validation",
  "title": "Validation failed",
  "status": 422,
  "detail": "Loan principal must be positive.",
  "instance": "/api/loans",
  "trace_id": "01HZ...",
  "errors": [{ "path": "principal", "message": "Must be > 0" }]
}
```

### 1.5 Rate limits

| Tier         | Reads       | Writes    | AI            |
| ------------ | ----------- | --------- | ------------- |
| Free         | 60 / min    | 30 / min  | 5 / month     |
| Pro          | 300 / min   | 120 / min | 200 / month   |
| Professional | 1,000 / min | 300 / min | 1,000 / month |

Headers returned on every response:

- `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

Exceeded: `429 Too Many Requests` with `Retry-After` seconds.

### 1.6 Pagination

Cursor-based:

```
GET /api/properties?cursor=<opaque>&limit=25
```

Response:

```json
{
  "data": [...],
  "pagination": { "next_cursor": "...", "has_more": true }
}
```

Limit max = 100. Cursors are opaque base64-encoded `(updated_at, id)` tuples; clients must not parse.

---

## 2. Shared Zod Primitives

```ts
// /lib/api/schemas/primitives.ts
import { z } from 'zod';

export const UUID = z.string().uuid();

export const ISODate = z.string().datetime({ offset: true });

export const FYString = z.string().regex(/^FY\d{4}$/, 'Expected FYYYYY e.g. FY2026');

// Money stored as integer cents to avoid float drift
export const Cents = z.number().int().min(-1e15).max(1e15);

export const Percent = z.number().min(-1).max(1); // 0.0625 = 6.25%

export const PositiveCents = Cents.refine((n) => n >= 0, 'Must be non-negative');

export const Jurisdiction = z.enum(['VIC', 'NSW', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT']);

export const LoanType = z.enum(['principal_and_interest', 'interest_only']);

export const OwnershipKind = z.enum([
  'individual',
  'joint',
  'tenants_in_common',
  'trust',
  'company',
]);
```

---

## 3. Property CRUD

### 3.1 Create

`POST /api/properties`

```ts
export const PropertyCreateInput = z.object({
  address_line1: z.string().min(1).max(200),
  suburb: z.string().min(1).max(100),
  state: Jurisdiction,
  postcode: z.string().regex(/^\d{4}$/),
  property_type: z.enum(['house', 'apartment', 'townhouse', 'land', 'commercial']),
  purchase_date: ISODate,
  purchase_price_cents: PositiveCents,
  stamp_duty_paid_cents: PositiveCents,
  ownership: z.object({
    kind: OwnershipKind,
    splits: z
      .array(
        z.object({
          owner_id: UUID,
          percentage: z.number().min(0).max(100),
        }),
      )
      .refine(
        (s) => Math.abs(s.reduce((a, b) => a + b.percentage, 0) - 100) < 0.001,
        'Ownership splits must total exactly 100%',
      ),
  }),
  ppor_history: z
    .array(
      z.object({
        from: ISODate,
        to: ISODate.nullable(),
      }),
    )
    .optional(),
});

export type PropertyCreateInput = z.infer<typeof PropertyCreateInput>;
```

**Response 201:**

```json
{
  "id": "5b6d...",
  "created_at": "2026-02-14T03:12:00+00:00",
  "calc_status": "pending"
}
```

**Error cases:**

- `422` validation (any field).
- `403 ENTITLEMENT_EXCEEDED` if property quota exhausted (`code = property.create`).

### 3.2 List

`GET /api/properties?cursor=&limit=`

Returns:

```ts
export const PropertyListItem = z.object({
  id: UUID,
  address_line1: z.string(),
  state: Jurisdiction,
  purchase_price_cents: PositiveCents,
  current_estimated_value_cents: PositiveCents.nullable(),
  ytd_cash_flow_cents: Cents,
  ytd_after_tax_position_cents: Cents,
});
```

### 3.3 Get one

`GET /api/properties/:id` — returns full nested property + loans + active scenario summary.

### 3.4 Update / Delete

- `PATCH /api/properties/:id` — accepts a partial of `PropertyCreateInput`. Any change to financial fields triggers a recalculation job.
- `DELETE /api/properties/:id` — soft delete; row marked `deleted_at`. Scenarios referencing it remain readable but flagged.

---

## 4. Scenario Run

`POST /api/scenarios/run`

```ts
export const ScenarioInput = z
  .object({
    scope: z.discriminatedUnion('type', [
      z.object({ type: z.literal('property'), property_id: UUID }),
      z.object({ type: z.literal('portfolio') }),
    ]),
    horizon_years: z.number().int().min(1).max(30),
    financial_year: FYString,
    jurisdiction: Jurisdiction,
    assumptions: z.object({
      rate_shock_bps: z.number().int().min(-1000).max(1000).default(0),
      rent_growth_pct: Percent.default(0),
      vacancy_weeks_pa: z.number().min(0).max(52).default(0),
      cpi_pct: Percent.default(0.025),
      capital_growth_pct: Percent.default(0.04),
      sell_at_year: z.number().int().min(1).max(30).optional(),
      refinance_year: z.number().int().min(1).max(30).optional(),
      refinance_new_rate: Percent.optional(),
      etf_alternative_return_pct: Percent.optional(),
    }),
    label: z.string().min(1).max(120).optional(),
  })
  .refine((d) => !(d.assumptions.refinance_year && !d.assumptions.refinance_new_rate), {
    message: 'refinance_new_rate required when refinance_year set',
  });

export type ScenarioInput = z.infer<typeof ScenarioInput>;
```

**Response 200:**

```json
{
  "scenario_result_id": "9f...",
  "input_hash": "blake3:8d2c...",
  "tax_rule_set_id": "trs_FY2026_VIC_v3",
  "summary": {
    "after_tax_cash_flow_cents_pa": -812300,
    "projected_equity_cents_y10": 482000000,
    "irr_pct": 0.072,
    "hold_recommendation_score": 0.61
  }
}
```

**Notes:**

- Computation is server-side, deterministic, and synchronous when `horizon_years ≤ 10`; otherwise queued (returns `202` with `job_id`).
- Identical `input_hash` returns cached result without re-running engine.

---

## 5. Calc Trigger (recompute)

`POST /api/calc/recompute`

For internal admin and tax-rule-update batch jobs. Not exposed to standard users.

```ts
export const RecomputeInput = z.object({
  scope: z.enum(['user', 'property', 'portfolio', 'all_subscriptions_on_tier']),
  target_id: UUID.optional(),
  reason: z.enum(['tax_rule_update', 'data_correction', 'manual_admin']),
  notify_user: z.boolean().default(false),
});
```

Returns `202 { job_id }`. Audit-logged with admin actor.

---

## 6. AI Explanation

`GET /api/scenarios/:id/explain`

```ts
export const ExplainQuery = z.object({
  template: z.enum(['cashflow', 'tax', 'holdsell', 'refinance']),
  language: z.enum(['en-AU']).default('en-AU'),
});
```

**Response 200:**

```json
{
  "narrative": {
    "tldr": "This property is costing $812 per year after tax...",
    "detail": [
      { "heading": "Cash flow", "body": "..." },
      { "heading": "Tax impact", "body": "..." }
    ],
    "caveats": ["Estimates assume FY2026 rates as published 1 July 2025."]
  },
  "schema_version": "explain.v1",
  "ai_generation_id": "ai_gen_01HZ...",
  "fallback_used": false
}
```

Validation: server-side JSON schema enforcement (`explain.v1`). Failures → templated fallback (`fallback_used: true`). See `/architecture/ai-integration.md`.

---

## 7. Report Generation

`POST /api/reports`

```ts
export const ReportRequest = z.object({
  template_id: z.enum([
    'portfolio_summary',
    'property_snapshot',
    'scenario_comparison',
    'eofy_pack',
    'cgt_estimate',
  ]),
  format: z.enum(['pdf', 'csv']),
  scope: z.discriminatedUnion('type', [
    z.object({ type: z.literal('property'), property_id: UUID }),
    z.object({ type: z.literal('portfolio') }),
    z.object({ type: z.literal('scenario'), scenario_result_id: UUID }),
  ]),
  financial_year: FYString.optional(),
});
```

**Response 202:**

```json
{ "job_id": "rpt_01HZ...", "poll_url": "/api/reports/rpt_01HZ.../status" }
```

`GET /api/reports/:job_id/status`:

```json
{
  "status": "completed",
  "signed_url": "https://...",
  "expires_at": "2026-02-14T04:00:00+00:00",
  "sha256": "..."
}
```

`signed_url` TTL = 15 minutes; user can request fresh URL while artefact is retained.

---

## 8. Subscription Management

`GET /api/me/subscription` → current tier + status + period end.

`POST /api/me/subscription/checkout`:

```ts
export const CheckoutInput = z.object({
  price_id: z.enum(['price_pro_m', 'price_pro_y', 'price_pro_plus_m', 'price_pro_plus_y']),
  return_url: z.string().url(),
});
```

→ returns Stripe Checkout session URL.

`POST /api/me/subscription/portal` → Stripe Billing Portal session.

Webhook receiver: `POST /api/webhooks/stripe` — signature-verified, idempotent on `event_id`.

---

## 9. Error Catalogue

| Code                           | HTTP | Meaning                                            |
| ------------------------------ | ---- | -------------------------------------------------- |
| `VALIDATION_FAILED`            | 422  | Zod parse error. `errors[]` populated.             |
| `AUTH_REQUIRED`                | 401  | Missing/expired JWT.                               |
| `MFA_REQUIRED`                 | 401  | AAL2 needed; client must re-authenticate.          |
| `ENTITLEMENT_TIER_LOCKED`      | 403  | Feature unavailable on current tier.               |
| `ENTITLEMENT_QUOTA_EXCEEDED`   | 403  | Quota hit.                                         |
| `RESOURCE_NOT_FOUND`           | 404  | RLS-safe — leaks no existence info across tenants. |
| `IDEMPOTENCY_CONFLICT`         | 409  | Same key used with different body.                 |
| `RATE_LIMITED`                 | 429  | Limit exceeded.                                    |
| `ENGINE_DETERMINISM_VIOLATION` | 500  | Internal — Sentry-paged.                           |
| `TAX_RULE_NOT_PUBLISHED`       | 422  | Requested FY rules unavailable.                    |
| `AI_OUTPUT_INVALID`            | 200  | Returned alongside `fallback_used: true`.          |

---

## 10. Cross-references

- Auth claims and AAL semantics → `/architecture/system-architecture.md` §4
- Schema and constraints → `/database/schema.sql`
- AI boundary and prompts → `/architecture/ai-integration.md`
