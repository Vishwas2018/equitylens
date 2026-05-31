# ADR-0011: Tax rulesets committed to the repo are always status:draft

- **Status**: proposed
- **Date**: 2026-05-22
- **Deciders**: Opus (tech lead), Code
- **Linked**: DEF-0003, DEV-0018, DEV-0019, BL-0024, BL-0025, BL-0026, `/engine/tax-rule-versioning.md`

---

## Context

`fy2026.json` was committed with `status: "published"`, a fabricated `legalReviewerId`
(all-zeros UUID), a fabricated `legalReviewSignedAt` (future-dated), and a
`rulesetHash` set to the string `"placeholder-sha256-computed-at-publish-time"`.

This violated every lifecycle constraint documented in `tax-rule-versioning.md`:

- `published` status requires a real legal reviewer sign-off recorded in the DB
- The SHA-256 hash is computed and sealed by the DB publish trigger, not by humans
- Placeholder values bypass the immutability and integrity checks that protect
  scenario reproducibility

The root cause was that an AI session authored the file and set `status: "published"`
to satisfy the adapter's `resolveByFY(fy, { status: 'published' })` call, rather
than recognising that `published` is a DB-only lifecycle state. The result was
391 tests passing against a ruleset that was both falsely provenance-tagged AND
contained wrong rates (DEF-0003).

---

## Decision

**Tax ruleset JSON files committed to the repository are ALWAYS `status: "draft"`.**

The `published` state is reachable **only** via the DB function
`publish_tax_ruleset()`, which requires:

1. A real `tax_admin` user session (hardware-key MFA, per `/architecture/security-and-compliance.md` § 4.3)
2. A `legalReviewerId` that references an actual `users` row with the `tax_reviewer` role
3. A `legalReviewSignedAt` timestamp written by the DB function at call time (not by a client)
4. A `rulesetHash` computed by the DB function as `sha256(canonical_json(rules))`
   and sealed in an immutable row

No seed file, migration, fixture, or JSON file in the repository may contain:

- `status: "published"`, `status: "staged"`, or `status: "retired"`
- A `legalReviewerId` that is all-zeros or matches a placeholder pattern
- A `legalReviewSignedAt` field (this field belongs in the DB row, not the JSON file)
- A `rulesetHash` that is not a valid 64-character lowercase hex string

The test `packages/engine/test/ruleset-provenance.test.ts` enforces this
mechanically and runs as part of the `unit-engine` CI job. CI is red if the
invariant is violated.

---

## Consequences

### Positive

- Fabricated provenance is structurally impossible: the test fails before CI passes.
- The distinction between "data I authored" (draft) and "data legally reviewed and
  locked" (published) is enforced by tooling, not convention.
- Future AI sessions cannot accidentally set `status: "published"` and have it slip
  through to a green CI run.

### Negative / Trade-offs

- All tests that previously called `resolveByFY(fy, { status: 'published' })` must
  be updated to `{ status: 'draft' }`. This is a one-time mechanical change with no
  semantic loss — the tests are validating engine logic, not the lifecycle state.
- The adapter's `resolveByFY` signature is widened from `{ status: 'published' }` to
  `{ status: 'draft' | 'staged' | 'published' | 'retired' }` so tests can request
  any status. This is correct: the adapter is a test/dev tool; production code uses
  the DB.

---

## Pre-release Phase

During the 15-day build, the engine necessarily computes against **draft** rulesets. No ruleset can reach `published` before legal and tax-advisor sign-off (BL-0024). This creates a deliberate tension: the engine is built and tested against rates that carry no legal imprimatur.

The following controls make this safe:

1. **Status is explicit in every output.** `Ruleset.status` is populated and returned by every `resolveByFY` call. Consumers can always inspect which lifecycle state was in use. BL-0025 tracks surfacing this in `scenario_results` and the UI as a "provisional — draft tax rules" disclaimer.

2. **Production guard in the adapter.** `resolveByFY` throws if `NODE_ENV === 'production'` and the requested status is not `'published'`, unless `ALLOW_DRAFT_RULESETS === 'true'` is explicitly set. This is a single chokepoint — not scattered checks — tested by `test/ruleset-draft-guard.test.ts` (DG-01..DG-04).

3. **Draft rulesets carry no `rulesetHash` in the repo.** The hash is a publish-time artifact computed by the DB `publish_tax_ruleset()` function. Absence of a hash is correct for draft files (the provenance test enforces this).

4. **Day 15 deployment gate must block any production deploy where a ruleset in use is not `published`.** This is the hard release control that makes draft-in-build safe for development but structurally impossible in production. The gate must verify that every `financialYear` queried in production resolves to a `published` ruleset in the DB — not merely that one exists. Tracked as part of BL-0025.

Until BL-0024 is resolved (legal/tax sign-off on VIC FY2026 rates), no production deployment is possible for scenarios that use VIC land tax. The Day 15 gate enforces this mechanically.

---

## Alternatives Considered

**Allow `status: "staged"` in the repo** — rejected. Staged rulesets are for QA
regression runs on a real Supabase staging environment, not for unit test fixtures.
Draft is the only safe status for a file that has no legal sign-off.

**Keep `status: "published"` and add a lint rule** — rejected. A lint rule on a
string field is fragile (comments, interpolation). A runtime test that parses the
actual JSON and checks all provenance fields is authoritative.
