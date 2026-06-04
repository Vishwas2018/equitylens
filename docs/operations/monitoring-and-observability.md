# Monitoring & Observability

> Observability strategy for EquityLens. We instrument three pillars — traces, metrics, logs — plus a fourth domain-specific layer for **calculation correctness** (engine output hashes, ruleset version distribution, AI grounding rate). Every signal is tied back to a user-visible outcome: did the right number reach the right user, on time, with the right disclaimer?

---

## 1. Goals

1. **Detect** financial-calculation regressions before users notice (output hash deltas, tax-fixture canaries).
2. **Diagnose** any incident within 15 minutes using distributed traces + structured logs joined on `trace_id`.
3. **Defend** the business SLOs (availability, latency, correctness, freshness).
4. **Demonstrate** compliance (audit trail completeness, PII handling, data residency).
5. **Discipline** cost: log volume, span sampling, retention all bounded and reviewed monthly.

---

## 2. Stack

| Layer           | Tool                                            | Region / Notes                                 |
| --------------- | ----------------------------------------------- | ---------------------------------------------- |
| Traces          | OpenTelemetry SDK → Honeycomb (EU/AU)           | OTLP HTTP, head-based sampling                 |
| Metrics         | OpenTelemetry → Prometheus → Grafana Cloud      | AU stack                                       |
| Logs (app)      | Pino → Vector → Grafana Loki                    | Structured JSON, hash-chained for audit subset |
| Logs (DB)       | Supabase Logflare                               | Long-running query alerts                      |
| Errors          | Sentry                                          | Sourcemap uploads in CI, release-tagged        |
| Synthetics      | Checkly                                         | Region: Sydney + Melbourne                     |
| RUM             | Vercel Speed Insights + custom OTel browser SDK | Core Web Vitals + business events              |
| Uptime / Status | Statuspage                                      | Public; auto-updated from probes               |
| Alerting        | Grafana OnCall + PagerDuty                      | Tiered escalation                              |

All telemetry endpoints are in `ap-southeast-2` or contracted EU/AU regions; PII fields are stripped at the collector via the Vector pipeline (§7) to satisfy APP 8 (cross-border disclosure).

---

## 3. Trace Instrumentation

Every request opens a root span with the following attributes:

```ts
// apps/web/server/observability/tracing.ts
import { trace, SpanKind } from '@opentelemetry/api';

export function startRootSpan(req: Request, route: string) {
  const tracer = trace.getTracer('pwi-web', APP_VERSION);
  return tracer.startSpan(`http.${req.method.toLowerCase()} ${route}`, {
    kind: SpanKind.SERVER,
    attributes: {
      'http.method': req.method,
      'http.route': route,
      'equitylens.route': route,
      'equitylens.tenant_id_hash': hashTenant(getTenantId(req)), // never raw
      'equitylens.user_id_hash': hashUser(getUserId(req)), // never raw
      'equitylens.tier': getTier(req),
      'equitylens.engine_version': ENGINE_VERSION,
      'equitylens.build_sha': BUILD_SHA,
    },
  });
}
```

### 3.1 Required Child Spans

| Span name                                 | Where                   | Attributes                                                                                                  |
| ----------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| `db.query`                                | Supabase / Postgres     | `db.statement` (parameterised), `db.rows`, `db.duration_ms`                                                 |
| `cache.get` / `cache.set`                 | Upstash Redis           | `cache.key_prefix`, `cache.hit`                                                                             |
| `engine.run`                              | `@equitylens/engine`    | `equitylens.scenario_id`, `equitylens.ruleset_version`, `equitylens.input_hash`, `equitylens.output_hash`   |
| `engine.module.cashflow`                  | inside engine           | `equitylens.years`, `equitylens.properties_count`                                                           |
| `engine.module.tax`                       | inside engine           | `equitylens.ruleset_version`, `equitylens.fy`                                                               |
| `engine.module.cgt`                       | inside engine           | `equitylens.ruleset_version`, `equitylens.hold_years`                                                       |
| `ai.gateway.mask`                         | PII masking gateway     | `equitylens.tokens_masked`                                                                                  |
| `ai.provider.complete`                    | Anthropic / OpenAI call | `equitylens.ai.model`, `equitylens.ai.input_tokens`, `equitylens.ai.output_tokens`, `equitylens.ai.refused` |
| `report.render.pdf` / `report.render.csv` | Export workers          | `equitylens.report_id`, `equitylens.template_version`                                                       |
| `stripe.webhook.process`                  | Webhook handler         | `stripe.event_type`, `stripe.event_id`                                                                      |
| `auth.session.verify`                     | Middleware              | `equitylens.session_valid`                                                                                  |

### 3.2 Sampling

- **Head-based**: 100% of `/api/scenarios/run`, `/api/reports/export`, `stripe.webhook.*`, `auth.*`, errors, and any request with `?debug_trace=1` from an internal IP.
- **Tail-based at collector**: keep 100% of traces with `error=true` or `duration_ms > 1000`; sample the rest at 10%.
- **Synthetic probes**: always 100%.

### 3.3 Trace Hygiene Rules

- Never put raw email, name, address, TFN, mobile, or card data in span attributes. Use hashed IDs.
- Never put SQL parameter values in `db.statement`. The Supabase wrapper redacts at source.
- Span names use lowercase dot.notation; no high-cardinality strings (e.g., property addresses) as span names.

---

## 4. Metrics

Metrics are split into **infrastructure**, **business**, and **correctness**.

### 4.1 Infrastructure (RED + USE)

| Metric (Prometheus name)        | Type      | Labels                               | Notes                       |
| ------------------------------- | --------- | ------------------------------------ | --------------------------- |
| `http_requests_total`           | counter   | `route`, `method`, `status_class`    | RED — Rate                  |
| `http_request_duration_seconds` | histogram | `route`, `method`                    | RED — Duration; p50/p95/p99 |
| `http_requests_errors_total`    | counter   | `route`, `error_class`               | RED — Errors                |
| `db_pool_connections`           | gauge     | `state` (idle/active/waiting)        | USE — Utilisation           |
| `db_query_duration_seconds`     | histogram | `query_kind`                         | USE — Saturation            |
| `cache_hit_ratio`               | gauge     | `key_prefix`                         |                             |
| `queue_depth`                   | gauge     | `queue` (exports/webhooks/recompute) |                             |
| `bg_job_duration_seconds`       | histogram | `job_name`, `outcome`                |                             |

### 4.2 Business Metrics

| Metric                         | Type    | Labels                        | Owner        |
| ------------------------------ | ------- | ----------------------------- | ------------ |
| `signups_total`                | counter | `tier`, `source`              | Growth       |
| `subscriptions_active`         | gauge   | `tier`                        | Finance      |
| `mrr_cents`                    | gauge   | `currency`                    | Finance      |
| `scenarios_run_total`          | counter | `tier`, `template`            | Product      |
| `properties_imported_total`    | counter | `source` (manual / csv / api) | Product      |
| `reports_exported_total`       | counter | `format`, `tier`              | Product      |
| `ai_interactions_total`        | counter | `model`, `purpose`, `refused` | Eng-platform |
| `ai_grounding_failures_total`  | counter | `reason`                      | Eng-finance  |
| `support_tickets_opened_total` | counter | `category`                    | Support      |

### 4.3 Correctness Metrics (Domain-Specific)

These exist because financial software cannot rely solely on "no 5xx" as a success signal — wrong-but-200 is worse.

| Metric                                    | Type      | Labels                      | Alert threshold                                     |
| ----------------------------------------- | --------- | --------------------------- | --------------------------------------------------- |
| `engine_runs_total`                       | counter   | `engine_version`, `outcome` | —                                                   |
| `engine_run_duration_seconds`             | histogram | `engine_version`            | p95 > 50 ms (portfolio of 10)                       |
| `engine_determinism_violations_total`     | counter   | `module`                    | > 0 ever → page on-call                             |
| `engine_output_hash_distribution`         | histogram | `ruleset_version`           | > 3σ shift in 1h vs prior day                       |
| `tax_ruleset_in_use`                      | gauge     | `ruleset_version`, `state`  | Any row with `state='retired'` and count > 0 → warn |
| `ato_fixture_canary_pass_total`           | counter   | `fixture_id`                | Any failure → page                                  |
| `ai_explanation_diff_versus_engine_total` | counter   | `severity`                  | `severity=high` > 0 → page                          |
| `disclaimer_render_missing_total`         | counter   | `surface`                   | > 0 → page on-call                                  |
| `audit_log_chain_breaks_total`            | counter   | —                           | > 0 → page security                                 |

**Output hash distribution** is computed by tagging each `scenario_results` row's `output_hash` into 256 buckets (first byte) and emitting a Prometheus histogram. A statistically significant shift signals an upstream calculation drift, even when no error was thrown.

**AI explanation diff** runs a background sanity check: a sample of AI explanations is parsed for stated numbers (regex over `$N`, `N%`, year ranges) and compared against the engine output JSON. Any mismatch greater than 1% increments the counter.

---

## 5. Logging

### 5.1 Structure

All logs are JSON, one event per line, with a fixed envelope:

```json
{
  "ts": "2026-05-19T03:14:22.881Z",
  "level": "info",
  "service": "web",
  "env": "production",
  "build_sha": "9a3b1c2",
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
  "span_id": "00f067aa0ba902b7",
  "tenant_id_hash": "a1b2…",
  "user_id_hash": "c3d4…",
  "route": "/api/scenarios/run",
  "msg": "scenario.run.complete",
  "pwi": {
    "scenario_id": "01HZ…",
    "ruleset_version": "FY2026-VIC-3",
    "engine_version": "2.4.1",
    "input_hash": "sha256:…",
    "output_hash": "sha256:…",
    "duration_ms": 37
  }
}
```

### 5.2 Levels & Volume

| Level | When                                           | Volume budget (per million requests) |
| ----- | ---------------------------------------------- | ------------------------------------ |
| trace | Local only                                     | n/a                                  |
| debug | Preview only, off in staging/prod              | n/a                                  |
| info  | Lifecycle events (request start/end, job done) | ≤ 5 lines                            |
| warn  | Recoverable issues                             | ≤ 1 line                             |
| error | Unhandled errors                               | ≤ 0.1 line                           |
| fatal | Process-fatal (Sentry + PagerDuty page)        | ≤ 0.001 line                         |

Volume is reviewed monthly. Exceeding budget without justification triggers a logging audit.

### 5.3 Sensitive Field Stripping (Vector Pipeline)

Logs pass through a Vector collector that enforces:

```toml
# vector.toml (excerpt)
[transforms.strip_pii]
type = "remap"
inputs = ["pino_source"]
source = '''
.message     = redact(.message,     filters: ["email", "us_phone", "credit_card"])
.error.stack = redact(.error.stack, filters: ["email", "credit_card"])
# Custom AU patterns
.message = replace(.message, r'\b\d{9}\b', "<TFN_REDACTED>")
.message = replace(.message, r'\b04\d{2}\s?\d{3}\s?\d{3}\b', "<AU_MOBILE_REDACTED>")
# Drop forbidden top-level fields if accidentally set
del(.email); del(.address); del(.tfn); del(.dob); del(.card)
'''
```

Any log line that contains a field name in the forbidden set is dropped (not redacted) and a `logging_violations_total{field=...}` counter is incremented for visibility without leaking content.

### 5.4 Audit Logs (Separate Channel)

The `audit_logs` table is **not** part of the general log stream. It is hash-chained (each row stores `prev_hash` + `row_hash`), partitioned monthly, and written via a SECURITY DEFINER function so the application role cannot bypass it. A nightly job verifies the chain end-to-end and emits `audit_log_chain_breaks_total`.

Audit log events:

- `auth.signin`, `auth.signout`, `auth.session.revoked`
- `tenant.member.invited`, `tenant.member.removed`, `tenant.member.role_changed`
- `property.created`, `property.updated`, `property.deleted`
- `scenario.created`, `scenario.recomputed`
- `report.exported`, `report.shared`
- `tax_ruleset.staged`, `tax_ruleset.published`, `tax_ruleset.retired`
- `subscription.changed`
- `data.export_requested`, `data.deletion_requested`, `data.deletion_completed` (APP-aligned)

---

## 6. SLOs

| SLO                                               | Target   | Window  | Error budget burn alert  |
| ------------------------------------------------- | -------- | ------- | ------------------------ |
| App availability (`/api/*` success)               | 99.9%    | 30 days | 2% in 1h, 5% in 6h       |
| `/api/scenarios/run` latency p95                  | < 800 ms | 7 days  | 14× burn over 1 h        |
| Engine calc p95 (portfolio of 10)                 | < 50 ms  | 7 days  | 14× burn over 1 h        |
| Report export p95 (PDF, single scenario)          | < 8 s    | 7 days  | 14× burn over 1 h        |
| AI explanation p95 round-trip                     | < 6 s    | 7 days  | 14× burn over 1 h        |
| AI grounding rate (no numeric mismatch vs engine) | ≥ 99.5%  | 30 days | Any high-severity diff   |
| ATO/SRO fixture canary pass rate                  | 100%     | rolling | Any failure pages        |
| Audit log chain integrity                         | 100%     | rolling | Any break pages security |
| Stripe webhook processing lag p95                 | < 60 s   | 7 days  | > 5 min for 10 min       |

Error budgets are tracked in Grafana SLO dashboards; sustained breach freezes feature deploys until budget recovers.

---

## 7. PII & Compliance Guardrails

- Telemetry collectors live in `ap-southeast-2`; Honeycomb / Grafana Cloud accounts are pinned to AU-resident regions where available, with DPAs on file.
- Browser RUM beacons strip query strings and exclude `/auth/*` routes entirely.
- No raw addresses, names, or TFNs in any span or log; only hashed IDs.
- Sentry user context is the hashed `user_id` plus `tier`; the Sentry SDK is configured with `beforeSend` to drop any PII fields that slip through.
- Retention: traces 7 days, metrics 13 months, app logs 30 days, audit logs 7 years (offline beyond 1 year).
- Data subject access requests are answered by joining the hashed `user_id` against the user's lookup, then exporting matching rows from each store; the runbook lives in `/architecture/security-and-compliance.md`.

---

## 8. Alerts

Alerts are tiered by severity, routed via Grafana OnCall to PagerDuty.

| Severity | Examples                                                                                                                  | Response                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **SEV1** | App availability < 99% for 5 min; ATO fixture canary fail; engine determinism violation; audit chain break; data exposure | Page on-call immediately; CTO informed; Statuspage updated |
| **SEV2** | API p95 > 2× SLO for 10 min; AI grounding diff high; Stripe webhook lag > 5 min; DB pool > 90% for 5 min                  | Page on-call; incident channel opened                      |
| **SEV3** | Bundle size regression; Lighthouse score drop; queue depth growing                                                        | Slack alert; addressed next business day                   |
| **SEV4** | Informational (deploy completed, ruleset published)                                                                       | Slack info only                                            |

### 8.1 Alert Hygiene

- Every alert has a **runbook link** in the description; an alert without a runbook is a bug.
- Every page is reviewed weekly for noise; > 3 false positives per week triggers a tuning task.
- On-call schedule is published in PagerDuty; primary + secondary rotate weekly.

---

## 9. Dashboards (Grafana)

Canonical dashboards:

1. **Deploy Watch** — live post-deploy view (see `/operations/deployment-checklist.md` §7).
2. **API Health** — RED metrics per route, error breakdown, top slow endpoints.
3. **Engine** — calc duration histograms, output hash distribution, ruleset version mix, determinism violations.
4. **AI Gateway** — provider latency, model mix, refusal rate, grounding failures, token spend.
5. **Database** — pool, slow queries, lock waits, partition sizes, RLS denials.
6. **Business** — signups, MRR, tier distribution, scenarios run, exports, churn.
7. **Compliance** — audit chain status, data deletion queue, retention job status, PII redaction violations.
8. **Cost** — Supabase, Vercel, Upstash, AI providers, observability stack — daily spend with budget bands.

Each dashboard is version-controlled under `ops/grafana/`. Changes flow through PR review.

---

## 10. Synthetic Probes (Checkly)

Probes run every 60 seconds from Sydney and Melbourne PoPs:

| Probe                         | Asserts                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| `liveness`                    | `/api/health` returns 200 in < 500 ms                                                            |
| `readiness`                   | `/api/readiness` returns 200; all deps healthy                                                   |
| `signin-portfolio`            | Test user signs in, portfolio renders 200 ms median                                              |
| `property-scenario-roundtrip` | Create property → run scenario → results visible                                                 |
| `report-export-pdf`           | Export PDF; file downloaded; disclaimer footer present in PDF text                               |
| `ai-explanation-roundtrip`    | AI explanation returns non-empty, includes the "not financial advice" badge text                 |
| `stripe-checkout-testmode`    | Stripe Checkout session creates and returns URL                                                  |
| `disclaimer-headless`         | Headless browser checks `<FinancialDisclaimer />` text is present on each public dashboard route |

Probes use a dedicated `synthetics@equitylens.com.au` tenant with bounded data; results never mix with real user metrics.

---

## 11. Cost Controls

Observability cost is reviewed monthly. Hard caps:

| Stream        | Monthly cap (AUD) | Action on breach                      |
| ------------- | ----------------- | ------------------------------------- |
| Honeycomb     | $1,500            | Increase sampling, alert eng-platform |
| Grafana Cloud | $1,200            | Reduce metric cardinality             |
| Sentry        | $500              | Adjust `sampleRate`                   |
| Checkly       | $300              | Reduce probe frequency                |

A weekly cost report is posted to `#observability`. Cardinality offenders (labels with > 10k unique values) are blocked by a Grafana relabel rule.

---

## Cross-References

- `/architecture/system-architecture.md` — services under observation
- `/architecture/security-and-compliance.md` — PII handling, retention, incident response
- `/architecture/ai-integration.md` — AI gateway spans and grounding checks
- `/engine/financial-calc-engine.md` — output hash and determinism semantics
- `/engine/tax-rule-versioning.md` — ruleset state model used in `tax_ruleset_in_use`
- `/database/indexing-and-partitioning.md` — slow-query baselines
- `/operations/ci-cd-pipeline.md` — release tagging that drives Sentry / dashboards
- `/operations/deployment-checklist.md` — post-deploy verification thresholds
