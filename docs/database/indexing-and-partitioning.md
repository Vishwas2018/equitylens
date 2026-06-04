# Indexing & Partitioning Strategy

> Authoritative reference for Postgres index design, partitioning topology, and query-pattern optimisation for the EquityLens platform. Indexes are workload-driven: every index documented here exists because of a real query in `/architecture/api-contracts.md` or a hot path in `/engine/financial-calc-engine.md`. Indexes without a documented consumer are removed during quarterly index audits.

---

## 1. Design Principles

1. **Workload-driven, not speculative.** New indexes require an attached EXPLAIN ANALYZE showing a sequential scan on a query > 50 ms or > 1 % of execution share in `pg_stat_statements`.
2. **Composite over single-column** when the leading column is always present and selective. Single-column indexes on `org_id` alone are never created — they collapse multi-tenant scans into useless heap fetches.
3. **Partial indexes for sparse predicates.** `WHERE status = 'active'` indexes dominate dashboard queries; sold/archived rows live in cold tail.
4. **BRIN for append-mostly time-series.** `audit_logs.created_at` and `scenario_results.created_at` use BRIN; rows are inserted in monotonic order so range scans are near-free.
5. **No CONCURRENTLY in migrations**, always. `CREATE INDEX CONCURRENTLY` runs outside the transaction, surviving rollback orphans; the deploy pipeline (`/operations/ci-cd-pipeline.md`) wraps every index migration in a guarded out-of-band step.
6. **Partition pruning before index lookup.** Hot tables (`audit_logs`, `scenario_results`, `ai_interactions`) are range-partitioned monthly; queries must include the partition key (`created_at`) to benefit.

---

## 2. Query-Pattern Inventory

The following access patterns drive every index decision. Each is tagged with a frequency band: **HOT** (≥ 100/s), **WARM** (1–100/s), **COLD** (< 1/s).

| ID   | Pattern                                                            | Table(s)                           | Band |
| ---- | ------------------------------------------------------------------ | ---------------------------------- | ---- |
| Q-01 | Load portfolio dashboard: all active properties for org            | `properties`                       | HOT  |
| Q-02 | Property detail: property + active loans + latest scenario         | `properties`,`loans`,`scenarios`   | HOT  |
| Q-03 | Cash flow timeline: income + expenses for property over date range | `income_records`,`expense_records` | HOT  |
| Q-04 | Run scenario: lookup tax_rule_set by FY + jurisdiction (locked)    | `tax_rule_sets`                    | HOT  |
| Q-05 | Scenario history: list user's scenarios for a property, paginated  | `scenarios`                        | WARM |
| Q-06 | Replay scenario by input hash: cache hit before recompute          | `scenario_results`                 | HOT  |
| Q-07 | Audit log read: list actions for org over date range (admin only)  | `audit_logs`                       | COLD |
| Q-08 | Audit log write: append-only insert                                | `audit_logs`                       | HOT  |
| Q-09 | Subscription lookup by Stripe customer id (webhook)                | `subscriptions`                    | WARM |
| Q-10 | Depreciation schedule lookup by property + FY                      | `depreciation_schedules`           | WARM |
| Q-11 | Org membership check (RLS hot path)                                | `org_members`                      | HOT  |
| Q-12 | Property search by suburb/postcode (autocomplete)                  | `properties`                       | WARM |
| Q-13 | Report status polling                                              | `report_jobs`                      | WARM |
| Q-14 | AI interaction audit by user/session                               | `ai_interactions`                  | COLD |
| Q-15 | Stripe event idempotency check                                     | `stripe_events`                    | HOT  |

---

## 3. Index Catalogue

### 3.1 `org_members` — RLS Hot Path

Every RLS policy (`/database/rls-policies.sql`) consults `org_members` to resolve role. This is the single most-executed lookup in the database.

```sql
-- Primary key already covers (org_id, user_id)
-- Reverse direction needed for: "list orgs a user belongs to"
CREATE INDEX idx_org_members_user
  ON org_members (user_id, org_id)
  INCLUDE (role);

COMMENT ON INDEX idx_org_members_user IS
  'RLS hot path Q-11. INCLUDE(role) makes this an index-only scan; do not drop.';
```

Index-only scan is critical: without `INCLUDE(role)` the planner does a heap fetch for every RLS check, multiplying P95 latency on dashboard queries 3–4×.

### 3.2 `properties` — Dashboard & Search

```sql
-- Q-01: dashboard load (active properties per org)
CREATE INDEX idx_properties_org_active
  ON properties (org_id, created_at DESC)
  WHERE status = 'active';

-- Q-12: suburb autocomplete (trigram, case-insensitive)
CREATE INDEX idx_properties_suburb_trgm
  ON properties USING gin (lower(suburb) gin_trgm_ops);

-- Q-02: lookup by id (PK already exists, but RLS forces org_id check)
CREATE INDEX idx_properties_id_org
  ON properties (id, org_id);
```

The partial index `idx_properties_org_active` is 60–80 % smaller than a full index because `sold` and `archived` properties dominate the long tail (typically 85 % of rows after 5 years of org tenure). Sold properties are queried only from the CGT report and historical scenarios, both COLD.

### 3.3 `loans`

```sql
CREATE INDEX idx_loans_property_active
  ON loans (property_id, start_date DESC)
  WHERE status = 'active';

-- For refinance scenarios that walk historical loan chain
CREATE INDEX idx_loans_property_all
  ON loans (property_id, start_date DESC, end_date DESC NULLS FIRST);
```

### 3.4 `income_records` & `expense_records`

Cash flow timeline (Q-03) is the most expensive read in the application. We use a covering composite that aligns with the canonical ORDER BY clause.

```sql
CREATE INDEX idx_income_property_date
  ON income_records (property_id, received_on DESC)
  INCLUDE (amount_cents, kind);

CREATE INDEX idx_expense_property_date
  ON expense_records (property_id, incurred_on DESC)
  INCLUDE (amount_cents, category, is_capital);
```

`is_capital` is included because capital expenses must be excluded from the operating-cash-flow chart but retained for depreciation; the engine filters in TS rather than rewriting the query per chart.

### 3.5 `scenarios` & `scenario_results`

```sql
-- Q-05: scenario history per property
CREATE INDEX idx_scenarios_property_created
  ON scenarios (property_id, created_at DESC);

-- Q-06: input hash lookup for cache replay (CRITICAL — determinism guarantee)
CREATE UNIQUE INDEX uq_scenario_results_input_hash
  ON scenario_results (input_hash);

-- Compound for "latest result for scenario"
CREATE INDEX idx_scenario_results_scenario_created
  ON scenario_results (scenario_id, created_at DESC);
```

The `uq_scenario_results_input_hash` index enforces the determinism contract from `/engine/financial-calc-engine.md` § 4: identical input + ruleset + engine version ⇒ exactly one result row, ever. Duplicate inserts raise a unique violation that the runner catches and converts into a cache hit.

### 3.6 `tax_rule_sets`

```sql
-- Q-04: scenario lookup. Only one published ruleset per (fy, jurisdiction).
CREATE UNIQUE INDEX uq_tax_rule_sets_fy_jurisdiction_published
  ON tax_rule_sets (financial_year, jurisdiction)
  WHERE status = 'published';

-- Draft rulesets during legal review may co-exist
CREATE INDEX idx_tax_rule_sets_status_updated
  ON tax_rule_sets (status, updated_at DESC);
```

### 3.7 `depreciation_schedules`

```sql
CREATE INDEX idx_depreciation_property_fy
  ON depreciation_schedules (property_id, financial_year, division);
```

### 3.8 `subscriptions` & `stripe_events`

```sql
-- Q-09: webhook lookup
CREATE UNIQUE INDEX uq_subscriptions_stripe_customer
  ON subscriptions (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX idx_subscriptions_org_status
  ON subscriptions (org_id, status);

-- Q-15: idempotency
CREATE UNIQUE INDEX uq_stripe_events_event_id
  ON stripe_events (stripe_event_id);
```

### 3.9 `report_jobs`

```sql
CREATE INDEX idx_report_jobs_org_status
  ON report_jobs (org_id, status, requested_at DESC)
  WHERE status IN ('pending','running');

CREATE INDEX idx_report_jobs_completed
  ON report_jobs (org_id, completed_at DESC)
  WHERE status = 'completed';
```

Splitting the index by status keeps the "polling" hot path (Q-13) tiny — typically < 1 % of total rows are pending/running at any moment.

---

## 4. Partitioning Topology

Three tables grow unboundedly and exhibit append-only access patterns: `audit_logs`, `scenario_results`, `ai_interactions`. All three are **monthly RANGE-partitioned on `created_at`** using `pg_partman`.

```mermaid
flowchart TB
  subgraph parent["audit_logs (parent, no rows)"]
    P[Declarative RANGE partitioned on created_at]
  end
  P --> M1[audit_logs_2026_01]
  P --> M2[audit_logs_2026_02]
  P --> M3[audit_logs_2026_03]
  P --> M4[...]
  P --> Mfuture[audit_logs_default<br/>(safety net, alerts on insert)]

  style Mfuture fill:#fee,stroke:#c00
```

### 4.1 Setup

```sql
-- One-time: install pg_partman in its own schema
CREATE SCHEMA IF NOT EXISTS partman;
CREATE EXTENSION IF NOT EXISTS pg_partman WITH SCHEMA partman;

-- Parent table declaration (excerpt; see /database/schema.sql for full DDL)
CREATE TABLE audit_logs (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  org_id          uuid        NOT NULL,
  actor_user_id   uuid,
  action          audit_action NOT NULL,
  entity_type     text        NOT NULL,
  entity_id       uuid,
  payload         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  prev_hash       bytea,
  row_hash        bytea       NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)             -- partition key MUST be in PK
) PARTITION BY RANGE (created_at);

-- Register with partman: 1 month per partition, premake 4 months ahead
SELECT partman.create_parent(
  p_parent_table    => 'public.audit_logs',
  p_control         => 'created_at',
  p_type            => 'range',
  p_interval        => '1 month',
  p_premake         => 4,
  p_start_partition => date_trunc('month', now())::text
);

-- Default partition catches stray inserts (e.g. clock skew); monitored.
CREATE TABLE audit_logs_default PARTITION OF audit_logs DEFAULT;
```

### 4.2 Maintenance

A nightly cron in Supabase runs `partman.run_maintenance()`:

```sql
SELECT partman.run_maintenance(
  p_parent_table => 'public.audit_logs',
  p_analyze      => true,
  p_jobmon       => true
);
```

This:

1. Creates the next month's partition if missing.
2. Runs `ANALYZE` on partitions touched this period.
3. Logs to `partman.job_log` for observability (Sentry breadcrumb on failure).

### 4.3 Retention

| Table              | Hot retention    | Cold retention                        | Action after cold              |
| ------------------ | ---------------- | ------------------------------------- | ------------------------------ |
| `audit_logs`       | 13 months online | 7 years (APP, ATO record-keeping)     | Detach + archive to S3 Glacier |
| `scenario_results` | 24 months online | 7 years for paid orgs, 12 months free | Detach + archive               |
| `ai_interactions`  | 6 months online  | 24 months                             | Detach + permanently drop      |

```sql
-- Cold-tier example: detach partitions older than 13 months for audit_logs
DO $$
DECLARE
  part text;
BEGIN
  FOR part IN
    SELECT inhrelid::regclass::text
    FROM pg_inherits
    WHERE inhparent = 'public.audit_logs'::regclass
      AND inhrelid::regclass::text < 'audit_logs_' ||
          to_char(now() - interval '13 months', 'YYYY_MM')
  LOOP
    EXECUTE format('ALTER TABLE audit_logs DETACH PARTITION %s', part);
    -- Then: pg_dump partition → s3://pwi-archive/audit/ → DROP TABLE
  END LOOP;
END$$;
```

### 4.4 Indexes on Partitions

Indexes declared on the parent automatically propagate to children:

```sql
-- BRIN: cheap, append-friendly range scans
CREATE INDEX idx_audit_logs_created_brin
  ON audit_logs USING brin (created_at)
  WITH (pages_per_range = 32);

-- Lookup by entity (e.g. "all audits touching property X")
CREATE INDEX idx_audit_logs_entity
  ON audit_logs (entity_type, entity_id, created_at DESC);

-- Org filter for RLS-bounded reads
CREATE INDEX idx_audit_logs_org_created
  ON audit_logs (org_id, created_at DESC);
```

BRIN over BTREE on `created_at` cuts index size by ~100× for this access pattern. BTREE on `org_id` is retained because audit reads are always org-scoped (RLS demands it).

### 4.5 Query Discipline

Any query against a partitioned table **must** include `created_at` in the WHERE clause to enable pruning. The CI step `pnpm db:explain-check` runs `EXPLAIN (ANALYZE, BUFFERS)` on the queries in `/db/explain-suite/*.sql` and fails if a partitioned scan touches more than 3 partitions for a query expected to hit one.

```sql
-- GOOD: prunes to single partition
SELECT * FROM audit_logs
WHERE org_id = $1
  AND created_at >= now() - interval '7 days'
  AND created_at <  now()
ORDER BY created_at DESC
LIMIT 100;

-- BAD: scans all partitions
SELECT * FROM audit_logs
WHERE org_id = $1
ORDER BY created_at DESC
LIMIT 100;
```

The TypeScript audit reader in `/server/audit/reader.ts` enforces this by requiring a `range: { from: Date, to: Date }` argument; there is no overload without it.

---

## 5. Index Bloat & Maintenance

```sql
-- Weekly job: detect bloated indexes
SELECT schemaname, indexrelname, pg_size_pretty(pg_relation_size(indexrelid)) AS size,
       idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND pg_relation_size(indexrelid) > 100 * 1024 * 1024  -- > 100 MB
ORDER BY pg_relation_size(indexrelid) DESC;

-- Unused index detection (alert if zero scans over 30 days, excluding new indexes)
SELECT indexrelname FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexrelid NOT IN (SELECT indexrelid FROM new_indexes_30d);
```

`REINDEX CONCURRENTLY` is used during low-traffic windows (Sunday 02:00 AEST) for any index whose bloat ratio exceeds 30 %, as detected by `pgstattuple`.

---

## 6. Statistics Targets

For columns that drive selective predicates, raise the statistics target so the planner picks the right plan under skew:

```sql
ALTER TABLE properties ALTER COLUMN org_id      SET STATISTICS 1000;
ALTER TABLE properties ALTER COLUMN status      SET STATISTICS 500;
ALTER TABLE scenarios  ALTER COLUMN property_id SET STATISTICS 1000;
ALTER TABLE audit_logs ALTER COLUMN org_id      SET STATISTICS 1000;
```

`org_id` cardinality is wide (one value per tenant) but distribution is heavily Pareto: top 5 % of orgs hold 60 % of rows. The higher statistics target prevents nested-loop plans on large tenants.

---

## 7. Observability

Every query in `pg_stat_statements` with mean execution time > 200 ms or P95 > 1 s is auto-reported to the team's `#db-slow` Slack channel by a daily cron. See `/operations/monitoring-and-observability.md` § 4 for the alerting policy.

---

## 8. Cross-References

- `/database/schema.sql` — table DDL referenced by every index above.
- `/database/rls-policies.sql` — RLS predicates that determine which indexes are actually usable.
- `/engine/financial-calc-engine.md` § 4 — input-hash determinism contract enforced by `uq_scenario_results_input_hash`.
- `/operations/ci-cd-pipeline.md` § 5 — migration safety rules; index creation gates.
- `/operations/monitoring-and-observability.md` § 4 — slow query alerting.
