# Deviation Log

> Every departure from the canonical specification (the `/docs/**` tree, the 15-day plan, or the day's execution prompt). Deviations are not failures; they are honest acknowledgements that reality diverged from plan. They are recorded so that the divergence is traceable and either accepted (with rationale) or remediated.

---

## What Counts as a Deviation

- Scope change mid-day (added or removed work).
- Architecture choice that differs from `/architecture/**` documents.
- Spec interpretation where two readings were possible and one was chosen.
- Out-of-scope file modified to unblock an in-scope task.
- Skipped checkpoint with explicit approval.
- Technology / library / pattern introduced that was not in the original plan.
- Order-of-day changed (a task pulled forward from a later day, or pushed back).

---

## What Does NOT Count

- A failing test that gets fixed within the day — that's a defect.
- A planned refactor — that's just work.
- A pivot decided by Opus at morning ritual — that's a re-plan, captured in the new Daily Execution Prompt.
- A purely cosmetic edit to fix typos — too small to track.

---

## Conventions

- **ID**: `DEV-NNNN`, monotonically increasing.
- **Type**: `scope` / `architecture` / `interpretation` / `out-of-scope-edit` / `checkpoint-skip` / `tech-choice` / `reorder`.
- **Disposition**: `accepted` (deviation kept; spec updated to match) / `remediated` (rolled back to spec) / `pending` (under review).
- **Severity**: `low` / `medium` / `high` — `high` requires an ADR.

---

## Open Deviations

| ID       | Day | Type           | Title                                                               | Severity | Disposition                              | Owner |
| -------- | --- | -------------- | ------------------------------------------------------------------- | -------- | ---------------------------------------- | ----- |
| DEV-0002 | 01  | tech-choice    | Node 24 / pnpm 10 local dev vs spec Node ^20.14.0 / pnpm 9.4.0      | medium   | accepted; CI pins via .nvmrc             | Code  |
| DEV-0006 | 01  | interpretation | `header-pattern` not a commitlint built-in; replaced with grep hook | low      | accepted with mitigation (CI job D01-T5) | Code  |

---

## Closed Deviations

| ID       | Day | Type           | Title                                                                          | Disposition | Linked ADR / spec change |
| -------- | --- | -------------- | ------------------------------------------------------------------------------ | ----------- | ------------------------ |
| DEV-0001 | 00  | scope          | Two commits share [D00-T1] tag                                                 | accepted    | N/A                      |
| DEV-0005 | 01  | scope          | tsconfig.base.json in D01-T1 scope; D01-T2 scope reduced accordingly           | accepted    | N/A                      |
| DEV-0007 | 01  | tech-choice    | Husky hooks export npm_config_engine_strict=false for Node 24 local dev        | accepted    | N/A                      |
| DEV-0008 | 01  | interpretation | commitlint subject-case enforces lowercase; spec commit subjects in title-case | accepted    | N/A                      |
| DEV-0009 | 01  | interpretation | vercel.json rootDirectory not in Vercel schema; must use dashboard setting     | accepted    | N/A                      |

---

### DEV-0001 — Two commits share [D00-T1] tag

- **Day**: 00
- **Type**: scope
- **Severity**: low
- **Opened by**: Code
- **Status**: accepted

**What was the spec / plan?**
Each task ID `[DNN-TM]` should appear on exactly one commit.

**What actually happened?**
The repo init work for D00-T1 required two commits (initial scaffold, then deletion of the single-use `migrate-docs.sh` script). Both carry `[D00-T1]`.

**Why?**
The migration script was used once and immediately deleted; the deletion was a tidy-up inside the same task boundary.

**Disposition**: accepted — two-commit tasks are legitimate when the second commit is a direct consequence of the first within the same task scope. No spec change required.

**Linked records**: ADR: N/A | Defect: N/A | Backlog: N/A | Tech debt: N/A

---

### DEV-0002 — Node 24 / pnpm 10 local dev vs spec Node ^20.14.0 / pnpm 9.4.0

- **Day**: 01
- **Type**: tech-choice
- **Severity**: medium
- **Opened by**: Code (raised during D01-T1 revision)
- **Status**: accepted

**What was the spec / plan?**
`.nvmrc` pins `20.14.0`; `package.json` specifies `"engines": { "node": "^20.14.0" }` and `"packageManager": "pnpm@9.4.0"`.

**What actually happened?**
Local dev machine runs Node v24.15.0 and pnpm v10.30.3. Engine-strict enforcement bypassed via `npm_config_engine_strict=false` env var in Husky hooks and CCTV audit child processes.

**Why?**
Developer environment cannot be changed; the spec versions are enforced in CI via `.nvmrc` and `pnpm/action-setup@v4`.

**Impact**
Local and CI results may differ in edge cases. CCTV audit shows "Node version drift" warning on every local run. pnpm lockfile at format version 9.0 (compatible with both pnpm 9 and 10).

**Disposition**: accepted — CI enforces exact spec versions. Local drift accepted and documented. See DEV-0007 for the hook mitigation.

**Linked records**: ADR: N/A | Defect: N/A | Backlog: N/A | Tech debt: N/A

---

### DEV-0005 — tsconfig.base.json shipped in D01-T1 scope

- **Day**: 01
- **Type**: scope
- **Severity**: low
- **Opened by**: Code
- **Status**: accepted

**What was the spec / plan?**
D01-T1 = monorepo scaffold. D01-T2 = TypeScript configuration.

**What actually happened?**
`tsconfig.base.json` was written during D01-T1 to unblock workspace compilation. D01-T2 was then reduced to per-package tsconfig wiring and verification only.

**Why?**
The monorepo scaffold required a working base config to pass typecheck; deferring it to T2 would have required re-running T1 checkpoints.

**Disposition**: accepted — D01-T2 scope reduced accordingly; no work omitted overall.

**Linked records**: ADR: N/A | Defect: N/A | Backlog: N/A | Tech debt: N/A

---

### DEV-0006 — `header-pattern` is not a commitlint built-in rule

- **Day**: 01
- **Type**: interpretation
- **Severity**: low
- **Opened by**: Code
- **Status**: accepted (mitigation: CI grep job in D01-T5)

**What was the spec / plan?**
Bootstrap prompt specified `header-pattern` as a commitlint rule to enforce the `[DNN-TM]` task-ID suffix.

**What actually happened?**
`header-pattern` does not exist as a built-in `@commitlint/config-conventional` rule. A grep-based check was added to `.husky/commit-msg` instead.

**Why?**
There is no built-in commitlint rule for suffix pattern matching. The grep approach is functionally equivalent but is client-side only. CI job (D01-T5 `commit-lint`) adds the server-side enforcement.

**Disposition**: accepted with mitigation — `.husky/commit-msg` enforces locally; `commit-lint` CI job enforces on PRs via grep + commitlint range check. Server-side enforcement satisfies original intent.

**Linked records**: ADR: N/A | Defect: N/A | Backlog: N/A | Tech debt: N/A

---

### DEV-0007 — Husky hooks export npm_config_engine_strict=false

- **Day**: 01
- **Type**: tech-choice
- **Severity**: low
- **Opened by**: Code
- **Status**: accepted

**What was the spec / plan?**
Husky hooks run lint-staged and commitlint without engine-strict workarounds.

**What actually happened?**
`export npm_config_engine_strict=false` added to `.husky/pre-commit` and `.husky/commit-msg` to allow pnpm to run on Node 24 locally.

**Why?**
Without the override, pnpm refuses to run on Node 24 due to `engine-strict=true` in `.npmrc`. CI (Node 20.14.0) is unaffected — the export is a no-op when the engine version matches.

**Disposition**: accepted — necessary consequence of DEV-0002. On CI the override does nothing; it only activates locally.

**Linked records**: ADR: N/A | Defect: N/A | Backlog: N/A | Tech debt: N/A

---

### DEV-0008 — commitlint subject-case rule enforces lowercase; spec used title-case

- **Day**: 01
- **Type**: interpretation
- **Severity**: low
- **Opened by**: Code
- **Status**: accepted

**What was the spec / plan?**
The bootstrap prompt showed example commit subjects in title-case (e.g., `ESLint, Prettier, Husky, commitlint...`).

**What actually happened?**
`@commitlint/config-conventional` includes a `subject-case` rule that rejects anything other than lowercase. All commit subjects use lowercase (e.g., `eslint, prettier, husky, commitlint...`).

**Why?**
The conventional-commits spec requires lowercase subjects. Overriding `subject-case` would weaken the enforcer; lowercase is the correct convention.

**Disposition**: accepted — lowercase subjects are the correct conventional-commits style. The bootstrap prompt's title-case examples were illustrative, not prescriptive.

**Linked records**: ADR: N/A | Defect: N/A | Backlog: N/A | Tech debt: N/A

---

### DEV-0009 — vercel.json rootDirectory key not in Vercel schema

- **Day**: 01
- **Type**: interpretation
- **Severity**: low
- **Opened by**: Code
- **Status**: accepted

**What was the spec / plan?**
`rootDirectory: "apps/web"` included in initial `vercel.json` to tell Vercel the Next.js app location in the monorepo.

**What actually happened?**
Vercel schema validation rejected the key: `"should NOT have additional property 'rootDirectory'"`. Root Directory must be set in the Vercel dashboard (Settings → Build and Deployment), not in `vercel.json`.

**Why?**
`rootDirectory` is a project-level setting in Vercel, not a `vercel.json` property. A common monorepo pattern was incorrectly applied.

**Disposition**: accepted — `rootDirectory` removed from `vercel.json`; set to `apps/web` in Vercel dashboard. `outputDirectory: ".next"` added to `vercel.json` (valid schema key, relative to Root Directory).

**Linked records**: ADR: N/A | Defect: N/A | Backlog: N/A | Tech debt: N/A

---

## Entry Template

```
### DEV-NNNN — <one-line title>

* **Day**: NN
* **Type**: scope / architecture / interpretation / out-of-scope-edit / checkpoint-skip / tech-choice / reorder
* **Severity**: low / medium / high
* **Opened by**: <Code | Opus | human>
* **Status**: pending

**What was the spec / plan?**
<verbatim or paraphrase, with file + section reference>

**What actually happened (or is proposed)?**
<concrete description>

**Why?**
<rationale — must answer the "why not stick to spec" question>

**Impact**
<users / surfaces / future work affected>

**Options considered**
1. <option> — pros / cons
2. <option> — pros / cons

**Recommendation**
<which option and why>

**Disposition** (filled in once decided)
* accepted — spec to be updated: `<which file / section>`, owner: `<who>`, by: `<day>`
* remediated — work reverted in commit `<SHA>`; spec stands
* pending — awaiting decision by `<who>`, expected by `<day>`

**Linked records**
* ADR: `<ADR-NNNN or N/A>`
* Defect: `<DEF-NNNN or N/A>`
* Backlog: `<BL-NNNN or N/A>`
* Tech debt: `<TD-NNNN or N/A>`
```

---

## Rules

- **No silent deviation.** A change that materially differs from spec must have a `DEV-NNNN` entry by end-of-day, even if accepted.
- **High-severity deviations require an ADR** within the same day. The ADR captures the long-term decision; the deviation captures the moment it was made.
- **Acceptance updates the spec.** A deviation that is accepted is not just a footnote; the corresponding `/docs/**` file is updated so that the spec and the code agree going forward.
- **Remediation is fast.** A deviation marked `remediated` must show a revert/fix commit within the same day or be re-classed as `accepted`.
- **Pending deviations age out.** Any deviation `pending` for more than two days is escalated; the day's plan opens with the resolution as task T1.
