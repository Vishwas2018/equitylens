# Day 0 + Day 1 Bootstrap — EquityLens (Autonomous)

You are operating under the EquityLens daily ritual. Read these first:

1. `docs/process/README.md`
2. `docs/process/execution-system.md`
3. `docs/process/daily-ritual.md`
4. `docs/process/15-day-plan.md` § Day 1
5. `docs/process/templates/{cctv-audit-report,daily-execution-prompt,end-of-day-report}.md`
6. `docs/operations/ci-cd-pipeline.md` §4, §5, §6

## Operating Mode

- **Autonomous**: you create all process artifacts (prompts, audits, reports, register entries) in the repo without asking. Do not ask the human to create files.
- **Approval gates**: the human is still required to (a) approve every commit, (b) supply secrets/URLs you cannot see, (c) drive third-party UIs (GitHub branch protection, Vercel link). For everything else, act.
- **Commit format** (enforced): `<type>(<scope>): <subject> [DNN-TM]` with body containing `Refs: DNN-TM` and `Evidence: docs/process/prompts/day-NN/checkpoints/DNN-TM.txt`.
- **No `--no-verify`. No force-push. No silent fixes outside scope.**

## Pre-Flight (do these immediately, no approval needed — they are housekeeping)

1. Save this entire prompt verbatim to `docs/process/prompts/day-01/02-daily-execution-prompt.md`.
2. Create directories: `docs/process/prompts/day-00/` and `docs/process/prompts/day-01/checkpoints/`.
3. Write `docs/process/prompts/day-00/README.md` containing one paragraph: "Day 0 is the bootstrap day; artefacts are the initial repo commit, remote wiring, and the `day-0-end` tag. No CCTV report exists for Day 0 (no prior state to audit). The Day 0 End-of-Day Report below records what was done."
4. Confirm `docs/` has 37 files (36 specs + the `docs/README.md` from migration). If not, halt and report.

After pre-flight, print "Pre-flight complete" and proceed to Day 0.

## Day 0 — Bootstrap

### D00-T1 — Repo init + .gitignore + top README + LICENSE

- `git init -b main` if not yet a repo
- Create `.gitignore`: `node_modules/`, `.next/`, `dist/`, `.turbo/`, `coverage/`, `.env*` (allow `.env.example`), `*.log`, `.DS_Store`, `.vercel/`, `playwright-report/`, `test-results/`
- `README.md` (root): name + one paragraph + link to `docs/process/README.md` + notice "All changes flow through `docs/process/daily-ritual.md`. No direct commits to `main`."
- `LICENSE`: `All rights reserved` placeholder
- Verify: `find docs -type f | wc -l` ≥ 37
- Request approval → commit: `chore(repo): initial commit with docs and process tree [D00-T1]`

### D00-T2 — Remote wiring

- **Ask the human once** for the GitHub remote URL (this is unavoidable)
- `git remote add origin <url>`, `git push -u origin main`
- `git checkout -b feature/d01-bootstrap`, push
- Print the required branch-protection settings (list checks: `lint`, `typecheck`, `unit-engine`, `unit-app`, `build`; require 1 reviewer; require CODEOWNERS review on changed paths; require linear history). Ask the human to enable in GitHub UI and reply `protected` when done. No commit for this task; it's external state.
- Append to `docs/process/registers/daily-progress-log.md`: Day 0 entry noting protection enabled by human at `<timestamp>`.

### D00-T3 — Audit script stub + tag day-0-end

- Create `scripts/audit-cctv.ts` — minimal: prints header fields (date, branch, HEAD SHA, last commit, start-of-day tag), runs `git status --porcelain` and `git tag --list 'day-*'`, exits 0. Real implementation in D01-T4.
- Create `scripts/lib/.gitkeep`
- Request approval → commit: `chore(process): stub CCTV audit script [D00-T3]`
- Tag: `git tag -a day-0-end -m "Day 0 bootstrap complete: docs + remote + audit stub" && git push --tags`

## Day 1 — Toolchain

### D01-T1 — Monorepo skeleton

- Root: `package.json` (name `equitylens`, private, `engines.node 20.14.0`, `packageManager pnpm@9.4.0`), `pnpm-workspace.yaml` (`apps/*`, `packages/*`), `turbo.json` (pipeline: `build`, `lint`, `typecheck`, `test` with `dependsOn: ["^build"]` where appropriate), `.nvmrc` (`20.14.0`), `.tool-versions` (`nodejs 20.14.0\npnpm 9.4.0`)
- Root scripts: `build`/`lint`/`typecheck`/`test` (turbo), `format`/`format:check` (prettier), `audit:cctv` (tsx scripts/audit-cctv.ts)
- Dev deps at root: `turbo@^2`, `typescript@5.5.4`, `prettier@3.3.3`, `tsx@4.16.2`, `@types/node@20.14.0`
- `apps/web` — Next.js 14 App Router TS:
  - `app/page.tsx`: single line "EquityLens — bootstrap"
  - `app/layout.tsx`: `<html lang="en-AU">` minimal
  - `app/api/health/route.ts`: returns `{ ok: true, version: process.env.BUILD_SHA ?? "dev" }`
  - `next.config.mjs`: `reactStrictMode: true`, `experimental.typedRoutes: true`
- `packages/engine` (name `@equitylens/engine`), `packages/types` (`@equitylens/types`), `packages/design-tokens` (`@equitylens/design-tokens`) — each: `package.json`, `tsconfig.json`, `src/index.ts` exporting `{}`, one passing vitest spec
- `supabase/config.toml` placeholder (no project link yet)
- `pnpm install`; commit lockfile
- **Checkpoint**: capture to `checkpoints/D01-T1.txt`:
  ```
  pnpm install --frozen-lockfile
  pnpm build
  pnpm --filter @equitylens/web start &
  sleep 3 && curl -s http://localhost:3000/api/health
  kill %1
  ```
- Request approval → commit: `feat(repo): pnpm + turborepo monorepo with apps/web and packages/* [D01-T1]`

### D01-T2 — TS strict + shared config

- Root `tsconfig.base.json`: `target ES2022`, `module ESNext`, `moduleResolution Bundler`, `strict true`, `noUncheckedIndexedAccess true`, `noImplicitOverride true`, `noFallthroughCasesInSwitch true`, `exactOptionalPropertyTypes true`, `isolatedModules true`, `verbatimModuleSyntax true`, `esModuleInterop true`, `skipLibCheck true`, `forceConsistentCasingInFileNames true`, `resolveJsonModule true`, `incremental true`, `lib ["ES2022","DOM","DOM.Iterable"]`
- Per-workspace `tsconfig.json` extends `../../tsconfig.base.json`
- Each workspace `package.json`: `"typecheck": "tsc --noEmit"`
- **Checkpoint** → `checkpoints/D01-T2.txt`: `pnpm typecheck` exit 0
- Commit: `feat(repo): TypeScript strict configuration with shared base [D01-T2]`

### D01-T3 — Lint, format, commit discipline

- Dev deps (root): `eslint@8.57`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, `eslint-config-next`, `eslint-plugin-import`, `eslint-plugin-unused-imports`, `husky`, `lint-staged`, `@commitlint/cli`, `@commitlint/config-conventional`
- Root `.eslintrc.cjs` with TS preset; `apps/web/.eslintrc.cjs` extends `next/core-web-vitals`
- **Critical**: `packages/engine/.eslintrc.cjs` rules (wired NOW, enforced from Day 4):
  - `no-restricted-globals`: deny `Date`, `performance`
  - `no-restricted-properties`: deny `Math.random`
  - `no-restricted-imports`: deny `decimal.js`, `big.js`, `bignumber.js`, `mathjs`, `lodash`
  - Scope: `packages/engine/src/**` only
- `.prettierrc.json`: `{ "singleQuote": true, "trailingComma": "all", "printWidth": 100, "semi": true }`
- `.prettierignore`: `pnpm-lock.yaml`, `*.min.*`, `.next/`, `coverage/`, `dist/`
- `commitlint.config.cjs`: extend `@commitlint/config-conventional` + custom rule: subject must match `/\[D\d{2}-T\d+\]$/` (header-pattern)
- `lint-staged.config.cjs`: `{ '*.{ts,tsx,js,jsx}': ['eslint --fix', 'prettier --write'], '*.{json,md,yml,yaml}': ['prettier --write'] }`
- `.husky/pre-commit`: `pnpm lint-staged`
- `.husky/commit-msg`: `pnpm commitlint --edit "$1"`
- `prepare` script `husky`; run `pnpm prepare`
- **Checkpoint** → `checkpoints/D01-T3.txt`:
  ```
  pnpm lint
  pnpm format:check
  git commit --allow-empty -m "bad message" 2>&1 | head -5   # must be blocked
  ```
- Commit: `feat(repo): ESLint, Prettier, Husky, commitlint with task-id enforcement [D01-T3]`

### D01-T4 — Full CCTV audit script

Replace D00-T3 stub. `scripts/audit-cctv.ts` must:

- Parse `--day NN` flag; default = (latest `day-*-end` tag number + 1)
- Verify `day-(NN-1)-end` exists; if not, exit 2 (drift)
- Run in parallel (capture each to `checkpoints/audit-<check>.txt`):
  - `git rev-parse HEAD`, `git status --porcelain`, `git diff --stat day-(NN-1)-start..HEAD` (skip if start tag absent)
  - `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`
  - `pnpm audit --audit-level=high`
- For checks not yet wired (RLS coverage, region check, disclaimer audit, determinism, fixture canary, bundle budgets, a11y, secret scan): emit `SKIPPED (wired on day NN)` referencing `15-day-plan.md`
- Generate Markdown to `docs/process/prompts/day-NN/01-cctv-audit-report.md` populating the template from `docs/process/templates/cctv-audit-report.md`
- Exit codes: 0 all wired pass, 1 a wired check failed, 2 drift
- Add helpers in `scripts/lib/git.ts`, `scripts/lib/checks.ts` (zero runtime deps; use only Node built-ins + `tsx`)
- **Checkpoint** → `checkpoints/D01-T4.txt`:
  ```
  pnpm audit:cctv --day 02
  test -f docs/process/prompts/day-02/01-cctv-audit-report.md
  echo "exit: $?"
  ```
- Commit: `feat(process): full CCTV audit script with report generation [D01-T4]`

### D01-T5 — CI workflow + CODEOWNERS + PR template

- `.github/workflows/ci.yml` per `docs/operations/ci-cd-pipeline.md` §4. Live jobs: `install`, `lint`, `typecheck`, `unit-engine`, `unit-app`, `build`. Stub these with `if: false` and a comment `# WIRED: Day NN`:
  - `migration-dryrun` (Day 2)
  - `e2e` (Day 3)
  - `security` (Day 15)
  - `a11y-perf` (Day 8)
  - `region-check` (Day 2)
  - `deploy-staging`, `deploy-production` (Day 15)
- `.github/actions/restore-deps/action.yml`: composite action restoring pnpm cache
- `.github/CODEOWNERS` (use placeholder team names; flag for human to replace before Day 2):
  ```
  *                                                @equitylens/engineering
  /packages/engine/**                              @equitylens/eng-finance @equitylens/engineering
  /docs/engine/**                                  @equitylens/eng-finance
  /docs/architecture/security-and-compliance.md   @equitylens/eng-security
  /supabase/migrations/**                          @equitylens/eng-platform
  /docs/process/**                                 @equitylens/eng-platform
  ```
- `.github/pull_request_template.md`: required fields — Day number, Task IDs, Evidence paths, Registers touched, Risks introduced
- Push branch. **Pause** and ask the human to open the PR (you cannot via CLI without `gh`; if `gh` available, do it autonomously). Capture PR run URL to evidence.
- **Checkpoint** → `checkpoints/D01-T5.txt`: PR URL, screenshot/log of green required jobs and skipped stubs
- Commit: `ci(workflows): CI skeleton with required checks and CODEOWNERS [D01-T5]`

### D01-T6 — Vercel project link + preview smoke

- Prep `vercel.json` (root):
  ```json
  {
    "buildCommand": "pnpm turbo run build --filter=@equitylens/web",
    "installCommand": "pnpm install --frozen-lockfile",
    "framework": "nextjs",
    "regions": ["syd1"]
  }
  ```
- `.vercelignore`: `docs/`, `packages/engine/coverage/`, `playwright-report/`, `test-results/`
- **Ask the human once** to run `pnpm dlx vercel link` (interactive, you cannot drive UI) and add Vercel ↔ GitHub integration. Ask them to reply with the preview URL when ready.
- On receiving the URL, capture to `checkpoints/D01-T6.txt`:
  ```
  curl -s -o /dev/null -w "%{http_code}\n" <url>/
  curl -s <url>/api/health
  ```
- Both must pass: 200 + JSON
- Commit: `chore(vercel): link project with Sydney region and Turborepo build [D01-T6]`

### D01-T7 — Close out: registers + EOD report + tag

Autonomously update all six registers. No human prompting for these — you have full authority to append:

1. **`docs/process/registers/daily-progress-log.md`**: append Day 0 + Day 1 entries using the template. Be honest about anything that slipped.
2. **`docs/process/registers/technical-debt.md`**: append six entries — one per stubbed CI job. Each entry: category `ci`, severity `medium`, payoff trigger = the day the job gets wired. IDs TD-0001 through TD-0006.
3. **`docs/process/registers/defect-log.md`**: append any defects encountered during T1–T6 (likely none). If none, write "No defects opened on Day 1."
4. **`docs/process/registers/deviation-log.md`**: append any out-of-scope edits made or spec ambiguities encountered. If none, write "No deviations on Day 1."
5. **`docs/process/registers/product-backlog.md`**: no changes today.
6. **`docs/process/registers/adr-index.md`**: no new ADRs today.
7. Generate `docs/process/prompts/day-01/03-end-of-day-report.md` from the template — all sections populated honestly.
8. Generate `docs/process/prompts/day-00/03-end-of-day-report.md` (Day 0 backfill) — minimal: tasks T1–T3, tag, no checkpoints (bootstrap had no automated suite yet).
9. Tag: `git tag -a day-1-end -m "Day 1 complete: monorepo, toolchain, CI skeleton, Vercel preview" && git push --tags`

- **Checkpoint** → `checkpoints/D01-T7.txt`:
  ```
  git tag --list 'day-*-end'                              # day-0-end, day-1-end
  test -f docs/process/prompts/day-01/03-end-of-day-report.md
  test -f docs/process/prompts/day-02/01-cctv-audit-report.md
  wc -l docs/process/registers/technical-debt.md          # should show 6 new TD entries
  ```
- Commit: `chore(process): day 1 closeout — registers, reports, tag [D01-T7]`

## Anti-Scope (Day 1)

- No Supabase project (Day 2)
- No engine source beyond empty placeholders (Day 4)
- No UI components, Tailwind, shadcn, Recharts (Day 8)
- No DB migrations
- No third-party math libraries ever
- No new ADRs unless a high-severity deviation occurs
- Do not silently fix unrelated issues — log to `defect-log.md` or `product-backlog.md`

## Failure Handling (Autonomous)

- **Checkpoint fails**: append entry to `docs/process/registers/defect-log.md` with severity, opened day, observed/expected, hypothesis. Halt. Report to human with the DEF-ID and your one fix-forward proposal. If approved, attempt once; if it still fails, surface for guidance.
- **Out-of-scope edit needed**: append to `deviation-log.md` with rationale, propose disposition (`accepted` / `remediated`), wait for human decision.
- **Spec ambiguity**: append to `deviation-log.md` as type `interpretation`, propose your reading, continue with that reading (do not block on small ambiguities), surface in EOD report.

## Commit Approval Protocol

Before each commit, print:

```
=== Ready to commit [DNN-TM] ===
Subject:  <commit subject>
Files:    <count> changed (<+adds / -dels>)
Tests:    <which ran, pass/fail>
Checkpoint: <pass/fail> — evidence: <path>
Risks:    <none | list>
Registers updated: <list or none>
================================
```

Wait for human reply: `approve` / `revise <note>` / `reject <reason>` / `defer <reason>`.

## Start

Acknowledge with:

1. The seven Day 1 task IDs and three Day 0 task IDs you will execute
2. The list of unavoidable human-driven steps (GitHub URL, branch protection, Vercel link)
3. Begin pre-flight, then D00-T1
