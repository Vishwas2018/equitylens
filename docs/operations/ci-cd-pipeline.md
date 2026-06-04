# CI/CD Pipeline

> Continuous integration and delivery pipeline for EquityLens. Every commit is linted, type-checked, unit-tested against the deterministic calculation engine, end-to-end tested against a staging Supabase project, and only promoted to production after explicit migration gates and human approval. Tax rule changes follow a separate, stricter promotion path documented in `/engine/tax-rule-versioning.md`.

---

## 1. Branch Strategy

We use trunk-based development with short-lived feature branches. `main` is always deployable.

| Branch                 | Purpose                                  | Auto-Deploys To         | Protection               |
| ---------------------- | ---------------------------------------- | ----------------------- | ------------------------ |
| `main`                 | Production source of truth               | Vercel Production       | 2 reviewers + all checks |
| `staging`              | Pre-prod integration                     | Vercel Staging          | 1 reviewer + all checks  |
| `feat/*`, `fix/*`      | Short-lived work branches                | Vercel Preview          | All checks must pass     |
| `release/YYYY-MM-DD`   | Release candidates for scheduled deploys | Vercel Staging (pinned) | 2 reviewers              |
| `hotfix/*`             | Emergency production patches             | Vercel Preview          | 1 reviewer + on-call     |
| `tax-rules/FY-YYYY-XX` | Tax ruleset proposals (see below)        | Isolated tax sandbox    | Legal + tax sign-off     |

**Naming rules**

- Lowercase, kebab-case after the prefix.
- Branches longer than 5 days require a rebase against `main` daily.
- `tax-rules/*` branches **never** merge directly to `main`; they flow through the ruleset lifecycle in `/engine/tax-rule-versioning.md`.

---

## 2. Environment Topology

```mermaid
flowchart LR
  Dev[Developer Laptop] -->|push| GH[GitHub]
  GH -->|PR opened| Preview[Vercel Preview + Supabase Branch DB]
  GH -->|merge to staging| Stg[Vercel Staging + Supabase Staging]
  GH -->|merge to main| Prod[Vercel Production + Supabase Production]
  Stg -.->|smoke tests pass| Approval{Manual Approval}
  Approval -->|approve| Prod
  Prod --> Synthetic[Synthetic Probes]
  Synthetic --> Sentry
  Synthetic --> Grafana
```

| Environment | URL                            | DB                             | Region         | Data                              |
| ----------- | ------------------------------ | ------------------------------ | -------------- | --------------------------------- |
| Local       | `localhost:3000`               | Supabase CLI local             | n/a            | Seed fixtures                     |
| Preview     | `pr-<n>-equitylens.vercel.app` | Supabase branch DB (ephemeral) | ap-southeast-2 | Anonymised seed                   |
| Staging     | `staging.equitylens.com.au`    | Supabase staging project       | ap-southeast-2 | Anonymised prod snapshot (weekly) |
| Production  | `app.equitylens.com.au`        | Supabase production project    | ap-southeast-2 | Live                              |

> **AU data residency**: All Supabase projects must be created in `ap-southeast-2` (Sydney). The CI workflow fails if a misconfigured region is detected via the management API check in step 9 below.

---

## 3. Pipeline Stages

```mermaid
flowchart TD
  A[Push / PR] --> B[install + cache]
  B --> C[lint]
  B --> D[typecheck]
  B --> E[unit: engine]
  B --> F[unit: app]
  C --> G{All pass?}
  D --> G
  E --> G
  F --> G
  G -->|no| FAIL[Fail PR]
  G -->|yes| H[build]
  H --> I[migration dry-run]
  I --> J[e2e: Playwright]
  J --> K[security scan]
  K --> L[bundle budget]
  L --> M[deploy preview]
  M --> N[lighthouse + a11y]
  N --> O[await review]
```

All stages run in GitHub Actions on `ubuntu-24.04` runners. The matrix is parallelised; total wall-clock target is **&lt; 8 minutes** for the PR pipeline.

---

## 4. GitHub Actions Workflow

`.github/workflows/ci.yml`:

```yaml
name: ci
on:
  pull_request:
    branches: [main, staging]
  push:
    branches: [main, staging]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: '20.14'
  PNPM_VERSION: '9.4.0'
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: propertywealth

jobs:
  install:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: '${{ env.PNPM_VERSION }}' }
      - uses: actions/setup-node@v4
        with:
          node-version: '${{ env.NODE_VERSION }}'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - uses: actions/cache/save@v4
        with:
          path: |
            node_modules
            **/node_modules
          key: deps-${{ hashFiles('pnpm-lock.yaml') }}

  lint:
    needs: install
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/restore-deps
      - run: pnpm lint
      - run: pnpm format:check

  typecheck:
    needs: install
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/restore-deps
      - run: pnpm typecheck

  unit-engine:
    needs: install
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/restore-deps
      - name: Run deterministic engine tests (must be 100% pass)
        run: pnpm --filter @equitylens/engine test -- --coverage --reporter=verbose
      - name: Enforce engine coverage threshold (>= 95%)
        run: pnpm --filter @equitylens/engine coverage:check
      - uses: actions/upload-artifact@v4
        with: { name: engine-coverage, path: packages/engine/coverage }

  unit-app:
    needs: install
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/restore-deps
      - run: pnpm --filter @equitylens/web test -- --coverage

  build:
    needs: [lint, typecheck, unit-engine, unit-app]
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/restore-deps
      - run: pnpm build
      - name: Bundle budget check
        run: pnpm bundle:check  # fails if any route > 250 KB gzipped
      - uses: actions/upload-artifact@v4
        with: { name: next-build, path: apps/web/.next }

  migration-dryrun:
    needs: install
    runs-on: ubuntu-24.04
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_PASSWORD: postgres }
        ports: ['5432:5432']
        options: --health-cmd pg_isready --health-interval 5s --health-retries 10
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/restore-deps
      - name: Apply baseline schema
        run: psql postgresql://postgres:postgres@localhost:5432/postgres -f docs/database/schema.sql
      - name: Apply RLS policies
        run: psql postgresql://postgres:postgres@localhost:5432/postgres -f docs/database/rls-policies.sql
      - name: Apply pending migrations
        run: pnpm db:migrate:dryrun
      - name: Verify migrations are reversible
        run: pnpm db:migrate:down && pnpm db:migrate:up
      - name: Detect destructive operations
        run: pnpm db:migrate:lint  # fails on DROP, ALTER TYPE, NOT NULL without default

  e2e:
    needs: build
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/restore-deps
      - uses: actions/download-artifact@v4
        with: { name: next-build, path: apps/web/.next }
      - name: Install Playwright
        run: pnpm exec playwright install --with-deps chromium
      - name: Start app
        run: pnpm start &
      - name: Wait for ready
        run: pnpm wait-on http://localhost:3000/api/health
      - name: Run Playwright suite
        run: pnpm test:e2e
        env:
          E2E_SUPABASE_URL: ${{ secrets.E2E_SUPABASE_URL }}
          E2E_SUPABASE_ANON_KEY: ${{ secrets.E2E_SUPABASE_ANON_KEY }}
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: playwright-trace, path: playwright-report }

  security:
    needs: install
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/restore-deps
      - name: Audit dependencies
        run: pnpm audit --audit-level=high
      - name: SAST (semgrep)
        uses: returntocorp/semgrep-action@v1
        with: { config: 'p/owasp-top-ten p/typescript p/react p/nextjs' }
      - name: Secret scan
        uses: gitleaks/gitleaks-action@v2
      - name: License compliance
        run: pnpm licenses:check  # blocks GPL, AGPL, SSPL

  a11y-perf:
    needs: build
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/restore-deps
      - uses: actions/download-artifact@v4
        with: { name: next-build, path: apps/web/.next }
      - run: pnpm start &
      - run: pnpm wait-on http://localhost:3000
      - name: Lighthouse CI
        run: pnpm lhci autorun --config=lighthouserc.json
      - name: axe accessibility
        run: pnpm test:a11y

  region-check:
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/staging'
    needs: install
    runs-on: ubuntu-24.04
    steps:
      - name: Verify Supabase region is ap-southeast-2
        run: |
          REGION=$(curl -s -H "Authorization: Bearer ${{ secrets.SUPABASE_MGMT_TOKEN }}" \
            https://api.supabase.com/v1/projects/${{ secrets.SUPABASE_PROJECT_REF }} \
            | jq -r '.region')
          if [ "$REGION" != "ap-southeast-2" ]; then
            echo "::error::Supabase region is $REGION, expected ap-southeast-2"; exit 1
          fi

  deploy-preview:
    if: github.event_name == 'pull_request'
    needs: [e2e, security, a11y-perf, migration-dryrun]
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - name: Deploy preview to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          scope: propertywealth

  deploy-staging:
    if: github.ref == 'refs/heads/staging' && github.event_name == 'push'
    needs: [e2e, security, a11y-perf, migration-dryrun, region-check]
    runs-on: ubuntu-24.04
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - name: Apply migrations to staging
        run: pnpm db:migrate:up
        env: { DATABASE_URL: ${{ secrets.STAGING_DATABASE_URL }} }
      - name: Deploy to Vercel staging
        run: pnpm vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}

  deploy-production:
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    needs: [e2e, security, a11y-perf, migration-dryrun, region-check]
    runs-on: ubuntu-24.04
    environment: production  # GitHub environment with required reviewers
    steps:
      - uses: actions/checkout@v4
      - name: Snapshot DB before migrate
        run: pnpm db:snapshot --label="pre-deploy-$(git rev-parse --short HEAD)"
        env: { DATABASE_URL: ${{ secrets.PROD_DATABASE_URL }} }
      - name: Apply migrations
        run: pnpm db:migrate:up
        env: { DATABASE_URL: ${{ secrets.PROD_DATABASE_URL }} }
      - name: Deploy to Vercel production
        run: pnpm vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
      - name: Post-deploy smoke
        run: pnpm test:smoke -- --base-url=https://app.equitylens.com.au
      - name: Notify Slack
        if: always()
        uses: slackapi/slack-github-action@v1.27.0
        with:
          payload: |
            { "text": "Production deploy ${{ job.status }} for ${{ github.sha }}" }
```

---

## 5. Required Checks (Branch Protection)

The following checks are mandatory on `main` and `staging`:

- `lint`
- `typecheck`
- `unit-engine` (with coverage ≥ 95%)
- `unit-app` (with coverage ≥ 80%)
- `migration-dryrun`
- `e2e`
- `security`
- `a11y-perf`
- `region-check` (main/staging only)
- `CODEOWNERS` review on changed paths
- Signed commits (DCO sign-off)

The **engine package** (`packages/engine`) has a dedicated CODEOWNER group `@equitylens/eng-finance`. Any PR touching files under `packages/engine/src/**` requires review from this group, regardless of other reviewers.

---

## 6. Database Migration Safety

All migrations live under `supabase/migrations/<timestamp>_<slug>.sql` and follow the **expand → migrate → contract** pattern.

### 6.1 Migration Rules

1. **No destructive operations in a single deploy.** Dropping a column requires two releases: stop reading in release N, drop in release N+1.
2. **Every new column with `NOT NULL` must have a `DEFAULT`** or a backfill migration that runs before the `NOT NULL` constraint.
3. **No `ALTER TYPE` on enums in use**; add a new enum, dual-write, then retire the old one.
4. **No long-running locks**: use `CREATE INDEX CONCURRENTLY`, batched `UPDATE` via `pg_cron`, and `SET lock_timeout = '5s'` at the top of every migration.
5. **RLS policies must be re-validated** on every schema change. The migration linter runs `policy_coverage.sql` (see `/database/rls-policies.sql`) and fails CI if any table lacks a policy.

### 6.2 Migration Linter

The `db:migrate:lint` step enforces:

```ts
// scripts/migrate-lint.ts (excerpt)
const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /\bDROP\s+TABLE\b/i,
    reason: 'Drop tables in a follow-up release after read paths removed',
  },
  {
    pattern: /\bDROP\s+COLUMN\b/i,
    reason: 'Drop columns in a follow-up release after read paths removed',
  },
  { pattern: /\bALTER\s+TYPE\b/i, reason: 'Use new enum + dual-write pattern' },
  { pattern: /\bTRUNCATE\b/i, reason: 'TRUNCATE forbidden in migrations' },
  { pattern: /NOT\s+NULL(?!\s+DEFAULT)/i, reason: 'NOT NULL requires DEFAULT or prior backfill' },
  { pattern: /CREATE\s+INDEX\s+(?!CONCURRENTLY)/i, reason: 'Use CREATE INDEX CONCURRENTLY' },
];
```

### 6.3 Rollback Procedure

Every migration ships with a `_down.sql` counterpart. The pipeline runs `up → down → up` against an ephemeral Postgres in CI to prove reversibility. In production, rollback is triggered by:

```bash
pnpm db:migrate:down --to=<timestamp> --confirm-prod
```

This is gated behind the `db-rollback-prod` GitHub environment (requires two approvers from `@equitylens/eng-platform`).

---

## 7. Tax Ruleset Deployment

Tax ruleset changes are **not** routed through this pipeline. They follow the workflow in `/engine/tax-rule-versioning.md`:

```
draft → legal_review → staged → published → retired
```

A ruleset proposal is opened on a `tax-rules/FY-YYYY-XX` branch. The branch runs an extended CI matrix:

- All standard checks above
- `engine:regression` — replays the historical scenario corpus (>10k scenarios) and reports diff
- `engine:atosro-fixtures` — re-runs the 40 ATO/SRO cross-validation fixtures from `/engine/test-matrix.md`
- Legal sign-off via a required reviewer from `@equitylens/legal`
- Tax review sign-off from `@equitylens/tax-advisor`

Only after the ruleset reaches the `published` state in the DB (which is gated by a DB trigger) does it become live for new scenarios. Existing scenarios remain pinned to the ruleset version they were computed under.

---

## 8. Secret Management

| Secret                      | Stored In                        | Rotation     | Used By                  |
| --------------------------- | -------------------------------- | ------------ | ------------------------ |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel env (encrypted) + GH OIDC | Quarterly    | Edge Functions only      |
| `STRIPE_SECRET_KEY`         | Vercel env                       | On suspicion | Server actions, webhooks |
| `OPENAI_API_KEY`            | Vercel env                       | Quarterly    | AI gateway (server only) |
| `ANTHROPIC_API_KEY`         | Vercel env                       | Quarterly    | AI gateway (server only) |
| `UPSTASH_REDIS_REST_TOKEN`  | Vercel env                       | Quarterly    | Rate limiter, jobs       |
| `RESEND_API_KEY`            | Vercel env                       | Quarterly    | Transactional email      |
| `SENTRY_AUTH_TOKEN`         | GH Actions secret                | Quarterly    | Sourcemap upload         |
| `SUPABASE_MGMT_TOKEN`       | GH Actions secret                | Quarterly    | Region check, snapshots  |

Secrets are **never** referenced from preview/PR environments belonging to forked PRs. The pipeline uses `pull_request_target` only for trusted contributors and gates secret-dependent jobs behind `if: github.event.pull_request.head.repo.full_name == github.repository`.

---

## 9. Versioning & Tagging

- Application releases use **CalVer** (`YYYY.MM.DD-N`) tagged by the production deploy job.
- The `@equitylens/engine` package is **independently SemVer-versioned**. Every change to the engine bumps:
  - `patch` for bug fixes that preserve historical scenario outputs
  - `minor` for new calculation features that do not change outputs of existing scenarios
  - `major` for any change that would alter outputs of pre-existing scenarios (these require a new published tax ruleset and a regression report attached to the PR)
- The engine version is stamped on every `scenario_results` row (`engine_version` column), so audit trails are reproducible.

---

## 10. Performance Budgets

CI fails if any of the following regress beyond 5% versus the previous `main` commit:

| Metric                              | Budget      |
| ----------------------------------- | ----------- |
| `/portfolio` route bundle (gz)      | ≤ 180 KB    |
| `/scenarios/[id]` route bundle (gz) | ≤ 220 KB    |
| Engine: portfolio of 10 properties  | ≤ 50 ms p95 |
| Engine: 30-year forecast (single)   | ≤ 35 ms p95 |
| Lighthouse Performance (mobile)     | ≥ 92        |
| Lighthouse Accessibility            | ≥ 98        |
| axe critical violations             | 0           |

---

## Cross-References

- `/architecture/system-architecture.md` — runtime topology this pipeline deploys
- `/architecture/security-and-compliance.md` — OWASP gates enforced in the `security` job
- `/database/schema.sql`, `/database/rls-policies.sql` — applied during `migration-dryrun`
- `/engine/tax-rule-versioning.md` — separate promotion path for tax rulesets
- `/engine/test-matrix.md` — coverage targets and fixtures the engine job enforces
- `/operations/deployment-checklist.md` — manual gates surrounding each promotion
- `/operations/monitoring-and-observability.md` — what to watch after deploy
