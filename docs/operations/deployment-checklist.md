# Deployment Checklist

> Operational gates for promoting EquityLens to staging and production. The deterministic engine, RLS isolation, tax rulesets, financial disclaimers, and AI guardrails each have mandatory pre-deploy verifications and post-deploy probes. This document is the canonical runbook surface; the CI pipeline in `/operations/ci-cd-pipeline.md` enforces the machine-checkable subset, and humans tick the remainder.

---

## 1. Release Types

| Type             | Cadence               | Approvers                               | Maintenance Window     |
| ---------------- | --------------------- | --------------------------------------- | ---------------------- |
| Standard         | Daily (business)      | 1 engineer + 1 code owner               | None required          |
| Schema migration | Weekly Tue 10:00 AEST | 2 engineers + DBA                       | None (expand/contract) |
| Engine release   | As needed             | 2 engineers + `@equitylens/eng-finance` | None                   |
| Tax ruleset      | Quarterly + ad-hoc    | Legal + tax advisor + 2 engineers       | None (versioned)       |
| Hotfix           | On demand             | 1 engineer + on-call                    | None                   |

---

## 2. Pre-Production Checklist

The deployer is responsible for ticking each item before merging the release PR. Items marked **🟢 auto** are enforced by CI; **🟠 manual** require explicit confirmation in the PR description.

### 2.1 Code Quality

- 🟢 `lint`, `format:check`, `typecheck` green on the release SHA.
- 🟢 Engine unit coverage ≥ 95%; app coverage ≥ 80%.
- 🟢 No new `eslint-disable` or `@ts-expect-error` without an inline `// TODO(ticket)` comment.
- 🟠 PR description includes a one-line user-visible change summary for the changelog.

### 2.2 Database & RLS

- 🟢 Migrations pass `up → down → up` reversibility test.
- 🟢 Migration linter reports no destructive operations.
- 🟢 `policy_coverage.sql` confirms every table has at least one RLS policy.
- 🟠 If new tables: cross-tenant probe added to `tests/rls/<table>.test.ts`.
- 🟠 If new columns expose PII: classification updated in `/architecture/security-and-compliance.md` and PII masking rules updated in the AI gateway.
- 🟠 Indexes for new query patterns reviewed against `/database/indexing-and-partitioning.md`.

### 2.3 Engine & Tax Rulesets

- 🟢 ATO/SRO cross-validation fixtures (XV-01..XV-40 in `/engine/test-matrix.md`) all pass.
- 🟢 Property-based test families pass (5,000 iterations each).
- 🟢 Regression corpus replay: zero unexpected diffs.
- 🟠 If engine version bumps **major**: regression diff report attached to PR and reviewed by `@equitylens/eng-finance` and `@equitylens/tax-advisor`.
- 🟠 If a new tax ruleset is being published: ruleset has reached `staged` state in the DB, legal sign-off comment present, and a dry-run scenario report attached.
- 🟠 Determinism check: identical inputs produce identical `output_hash` across two consecutive runs in CI.

### 2.4 AI Guardrails

- 🟠 Any change under `apps/web/server/ai/**` reviewed by `@equitylens/eng-platform` and `@equitylens/eng-finance`.
- 🟠 New AI prompts include the standard system preamble (no calculations, structured output schema, refusal patterns).
- 🟠 PII masking gateway test suite passes for new prompt shapes (emails, TFN, mobile numbers, addresses, card patterns).
- 🟠 Prompt injection canary set runs green: the 24 canary inputs in `/architecture/ai-integration.md` produce a refusal or sanitised response.
- 🟠 Audit logging asserts that every AI interaction writes a row to `ai_interactions` with the masked prompt, response, model, ruleset version, and engine version.

### 2.5 Security

- 🟢 `pnpm audit --audit-level=high` clean.
- 🟢 Semgrep OWASP profile clean.
- 🟢 Gitleaks secret scan clean.
- 🟢 License compliance clean (no GPL/AGPL/SSPL in production deps).
- 🟠 CSP, HSTS, COOP/COEP headers verified via `curl -I` against the preview URL.
- 🟠 New external domains added to CSP `connect-src` and reviewed.
- 🟠 If new third-party JS: SRI hashes pinned and the integration is reviewed for data egress.

### 2.6 Compliance & Disclaimers

- 🟠 Every financial number on a new screen has the standard disclaimer (`<FinancialDisclaimer />`) above the fold or in the report footer.
- 🟠 Any new export template includes the `disclaimer_footer` block (see `/reports-exports/export-templates.md`).
- 🟠 AI explanation surfaces include the "AI-generated explanation — not financial advice" badge.
- 🟠 If new PII fields are stored: APP-aware retention timer is configured (`pg_cron` retention job updated) and the privacy policy diff is queued for the legal team.
- 🟠 Data deletion workflow (Right to Erasure) covers the new fields end-to-end (DB, audit logs, AI logs, exports, backups marker).

### 2.7 Performance & Accessibility

- 🟢 Bundle budgets per route within limits (`/operations/ci-cd-pipeline.md` §10).
- 🟢 Lighthouse mobile Performance ≥ 92, Accessibility ≥ 98.
- 🟢 axe critical violations = 0.
- 🟠 Long-running queries (>250 ms p95) profiled and indexed.

### 2.8 Observability

- 🟠 New routes emit OpenTelemetry spans with the `equitylens.route`, `equitylens.tenant_id` (hashed), and `equitylens.scenario_id` attributes where relevant.
- 🟠 New error classes registered in Sentry with severity tags.
- 🟠 New business events (`scenario.run`, `report.export`, `subscription.upgrade`) wired into the analytics sink.
- 🟠 Dashboards updated if a new SLO is introduced.

### 2.9 Subscription & Billing

- 🟠 If pricing or gating changes: `ENTITLEMENTS` table updated and Stripe products/prices reconciled via `pnpm stripe:reconcile --dry-run`.
- 🟠 Webhook replay test against the staging Stripe account passes for all relevant events (`checkout.session.completed`, `customer.subscription.updated`, `invoice.payment_failed`, `customer.subscription.deleted`).

### 2.10 Communication

- 🟠 If user-visible UI changes: changelog entry drafted.
- 🟠 If breaking API change: deprecation notice pushed at least one release earlier.
- 🟠 On-call engineer named in PR description; out-of-hours deploys require explicit on-call ack.

---

## 3. Staging Soak

Every release ships to staging at least **30 minutes** before production. During the soak window:

1. Synthetic probes run every 60 seconds against the seven critical paths:
   - `/api/health` (liveness)
   - `/api/readiness` (DB + Redis + Stripe + AI providers)
   - Sign-in → portfolio
   - Property create → scenario run → result render
   - Report export (PDF + CSV)
   - Subscription checkout (test mode)
   - AI explanation round-trip
2. Sentry shows no new error issue with `severity ≥ error` originating from the release SHA.
3. Logs show no spike in 4xx or 5xx rates beyond 2× baseline.
4. Engine `output_hash` distribution unchanged versus the previous 24 hours (sanity check that calculation outputs have not drifted unexpectedly).

If any of the above fail, the release is held and the deployer files a `release-hold` issue.

---

## 4. Production Deploy Procedure

### 4.1 Standard Deploy

1. Confirm staging soak passed (Slack `#deploys` post-link).
2. Approve the `deploy-production` GitHub environment.
3. CI takes a DB snapshot (`pre-deploy-<sha>` label) and applies migrations.
4. Vercel deploys; new traffic shifts to the new build (instant, no rolling needed for stateless app).
5. Smoke tests run against `https://app.equitylens.com.au`.
6. Watch the [Deploy Watch](#7-deploy-watch-dashboard) dashboard for 15 minutes.
7. Mark the release as **stable** in `releases` Slack channel.

### 4.2 Migration Deploy

Same as standard, plus:

- Announce the migration window in `#deploys` 24 hours ahead.
- Verify `pg_stat_activity` shows no long-running queries on the affected tables before applying.
- Apply migration with `SET lock_timeout = '5s';` at the top of every statement.
- If the migration uses `CREATE INDEX CONCURRENTLY`, do not deploy app code that depends on the index until the index is `VALID = true` in `pg_index`.

### 4.3 Engine / Tax Ruleset Deploy

1. Confirm the ruleset row in `tax_rule_sets` has reached `published` state in production. The DB trigger refuses subsequent mutations.
2. Confirm the regression report has zero red diffs.
3. Deploy the app code that wires the new ruleset version into `RulesetAdapter.resolveDefaultForFY(...)`.
4. Run a controlled forward replay: pick 20 representative scenarios, recompute under the new ruleset (without persisting), and verify outputs align with the regression report.
5. Announce in `#tax-rules` with the ruleset version, effective FY, and a link to the diff.

### 4.4 Hotfix Deploy

1. Branch from `main` as `hotfix/<slug>`.
2. CI must still be green; **no** check is skipped.
3. On-call engineer is the second approver.
4. After deploy, cherry-pick into `staging` immediately to avoid drift.
5. Open a follow-up PR within 24 hours documenting the root cause and adding a regression test.

---

## 5. Post-Deploy Verification

Within 15 minutes of production deploy, verify:

| Signal                                 | Source                        | Threshold                              |
| -------------------------------------- | ----------------------------- | -------------------------------------- |
| HTTP 5xx rate                          | Vercel + OTel                 | < 0.1% over 5 min                      |
| HTTP 4xx rate                          | Vercel + OTel                 | < 2× baseline                          |
| API p95 latency (`/api/scenarios/run`) | OTel                          | < 800 ms                               |
| Engine calc p95                        | Engine internal histogram     | < 50 ms (portfolio of 10)              |
| DB connection pool utilisation         | Supabase metrics              | < 70%                                  |
| DB slow queries (>500 ms)              | `pg_stat_statements`          | No new top-10 entrants                 |
| Cache hit ratio (Upstash)              | Upstash dashboard             | > 80%                                  |
| AI provider error rate                 | OTel `equitylens.ai.error`    | < 1%                                   |
| AI provider p95 latency                | OTel `equitylens.ai.duration` | < 6 s                                  |
| Sentry new issues                      | Sentry release filter         | 0 with `severity ≥ error`              |
| Stripe webhook lag                     | Upstash queue depth           | < 60 s                                 |
| Subscription state drift               | `subscriptions` audit query   | 0 mismatches                           |
| Output hash distribution               | `scenario_results` histogram  | No > 3σ deviation in last 1 h vs prior |

If any threshold is breached for more than 5 consecutive minutes, the on-call engineer initiates the rollback runbook in section 6.

---

## 6. Rollback Procedure

Rollback steps are tiered by impact level.

### 6.1 App Rollback (no schema impact)

```bash
# Re-promote the previous Vercel deployment
pnpm vercel promote <previous-deployment-url> --scope=propertywealth
```

- Time to recovery: < 2 minutes.
- Verify smoke tests on the rolled-back build.
- File an incident report (`incident/<date>-<slug>.md`).

### 6.2 App Rollback + Migration Reversal

- Only safe if the migration is reversible (single-step expand). Contract migrations are never rolled back; instead, roll forward with a corrective migration.

```bash
pnpm db:migrate:down --to=<timestamp> --confirm-prod
pnpm vercel promote <previous-deployment-url>
```

- Two approvers from `@equitylens/eng-platform` required.
- Verify foreign-key consistency post-rollback: `pnpm db:check:fk`.

### 6.3 Engine Rollback

- The engine is versioned per package. Rollback re-pins the engine version in `apps/web/package.json` and redeploys the app. The previously persisted scenario results remain bound to the engine version they were computed under (`scenario_results.engine_version`).
- If the issue is a tax ruleset, **do not delete or modify the ruleset row**. Instead, publish a corrective ruleset version. Scenarios run between the bad publish and the fix are flagged in `audit_logs` and recomputed offline; users are notified per the comms plan in section 8.

### 6.4 Data Corruption Rollback

- Restore from the `pre-deploy-<sha>` snapshot to a new database, validate, then promote via Supabase's read-replica swap.
- Requires DBA + 2 senior engineers + CTO approval. RTO target: 60 minutes. RPO target: 5 minutes (point-in-time recovery enabled in Supabase production).

---

## 7. Deploy Watch Dashboard

The deployer keeps the [Deploy Watch](https://grafana.internal.equitylens.com.au/d/deploy-watch) dashboard open for at least 15 minutes after promotion. It surfaces:

- Real-time HTTP status code distribution
- p50/p95/p99 latency by route
- DB connection pool, slow query count
- Engine `output_hash` histogram delta
- AI provider error/latency
- Sentry release-tagged issue feed
- Vercel deployment status

A dedicated browser tab is also kept on the Sentry release page.

---

## 8. Communication Plan

| Event                                  | Channel                               | Lead             | SLA            |
| -------------------------------------- | ------------------------------------- | ---------------- | -------------- |
| Standard deploy                        | `#deploys` Slack                      | Deployer         | At deploy time |
| Migration deploy                       | `#deploys` + email to eng             | Deployer         | 24 h ahead     |
| Engine major version                   | `#tax-rules` + email                  | Eng-finance lead | 48 h ahead     |
| Tax ruleset publish                    | `#tax-rules` + customer in-app banner | Product          | At publish     |
| Production incident                    | Statuspage + email                    | On-call          | < 15 min       |
| Data correction affecting user numbers | Per-user in-app banner + email        | Product + Legal  | < 24 h         |

The in-app banner component is `<DataCorrectionBanner scenarioIds={[...]} />` and is wired into the layout.

---

## 9. Tax Rule Update Runbook

This is the most sensitive deploy class. It is the only one where wrong numbers shipped to customers can become a legal and financial issue.

### Pre-flight

1. Open a `tax-rules/FY-YYYY-XX` branch with the new ruleset JSON in `supabase/seed/tax_rule_sets/`.
2. Add the ruleset to the migration as a row insert with `state = 'draft'`.
3. Update `RulesetAdapter.resolveDefaultForFY(...)` if this is the new default for a future FY.
4. Run regression: `pnpm engine:regression -- --against=published --ruleset=<id>`. Attach the report to the PR.

### Review

5. `@equitylens/tax-advisor` reviews the JSON line-by-line against the legislation reference cited in the PR description.
6. `@equitylens/legal` confirms the disclaimer text on any user-facing surface that mentions the new rules.
7. `@equitylens/eng-finance` reviews the regression diff; any non-zero delta must be justified in the PR description.

### Stage

8. Merge the PR. CI applies the migration to staging. The ruleset row is now `staged`.
9. QA runs the staging fixture suite (`/engine/test-matrix.md` §ATO/SRO fixtures) against the staged ruleset.
10. A senior eng-finance member transitions the ruleset to `published` via:

```sql
SELECT equitylens.publish_tax_ruleset(
  ruleset_id := '<uuid>',
  approved_by := auth.uid(),
  legal_review_ref := '<link>',
  approved_at := now()
);
```

11. The DB trigger validates the approver is in the `tax_admin` role and locks the row.

### Production

12. Repeat steps 8–11 in production during the next deploy window.
13. Smoke test: run the 40 ATO/SRO fixtures against the live published ruleset (read-only).
14. Announce in `#tax-rules` and the in-app `What's New` panel.

### Post-publish

15. Existing scenarios remain pinned to their original ruleset. The platform does **not** retroactively recompute user scenarios; users may opt-in to recompute per-scenario from the UI.
16. A scheduled job emails users with active scenarios whose pinned ruleset is now `retired`, prompting them to recompute.

---

## 10. Emergency Patch Procedure

Used only when production is materially broken (incorrect financial numbers shown to users, data exposure, total outage).

1. The on-call engineer declares the incident in `#incident-room` and opens an incident document from the template.
2. If the issue is a calculation regression: pin the engine to the last-known-good version (`apps/web/package.json`) and redeploy via the hotfix path.
3. If the issue is a data exposure: invoke the security runbook (`/architecture/security-and-compliance.md` §incident response), rotate keys, revoke sessions for affected tenants.
4. Customer comms are drafted by Product + Legal within 4 hours, sent within 24 hours for material issues.
5. A post-mortem is published within 5 business days. It must include: timeline, root cause, customer impact, remediation, and prevention items with owners and due dates.

---

## Cross-References

- `/operations/ci-cd-pipeline.md` — machine-checkable subset of these gates
- `/operations/monitoring-and-observability.md` — dashboards and alerts cited above
- `/architecture/security-and-compliance.md` — incident response, data deletion workflow
- `/architecture/ai-integration.md` — AI guardrail requirements
- `/engine/tax-rule-versioning.md` — ruleset lifecycle in depth
- `/engine/test-matrix.md` — fixtures and coverage targets
- `/database/rls-policies.sql` — policy coverage checks
- `/reports-exports/export-templates.md` — disclaimer footer required on exports
