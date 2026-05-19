# Architecture Decision Records (ADRs)

> Index of architecturally-significant decisions made during the build. ADRs are immutable once accepted; superseding a decision creates a new ADR that links back to the old one. Owned by Opus; drafted in response to high-severity deviations, tech-choice changes, or any decision that future readers will need to understand to make sense of the codebase.

---

## When to Write an ADR

Open an ADR for any decision that:

* Changes the answer to a question someone will reasonably ask in six months ("why did we use X instead of Y?").
* Locks in a constraint (e.g., "all money is bigint cents end-to-end").
* Resolves a tension between two valid approaches.
* Is hard or expensive to reverse later.
* Was the subject of a high-severity deviation.

Do **not** open an ADR for:

* Naming choices (use code review).
* Implementation details internal to a single module.
* Decisions already documented in `/architecture/**` (those docs are the canonical spec; an ADR is only needed when departing from or amending them).

---

## States

* `proposed` — drafted, awaiting review. Opus drafts; human reviews.
* `accepted` — decision in force. The codebase reflects it (or has a tracked plan to reflect it).
* `superseded-by-ADR-NNNN` — replaced. The new ADR explains the change.
* `rejected` — considered and not adopted. Kept on file for audit.

---

## Naming

* Filename: `adr/NNNN-<kebab-slug>.md`, four-digit zero-padded ID.
* Title format: `ADR-NNNN: <decision>`.
* IDs are never reused, even for rejected or superseded ADRs.

---

## Index

| ID       | Title                                                        | State    | Day | Linked                            |
| -------- | ------------------------------------------------------------ | -------- | --- | --------------------------------- |
| ADR-0000 | Template (do not modify)                                     | n/a      | —   | —                                 |
| ADR-0001 | Money represented as bigint cents end-to-end                 | accepted | pre-D1 | `/engine/financial-calc-engine.md` |
| ADR-0002 | Deterministic engine in TypeScript; AI never computes        | accepted | pre-D1 | `/architecture/ai-integration.md` |
| ADR-0003 | Supabase region locked to `ap-southeast-2`                   | accepted | pre-D1 | `/architecture/security-and-compliance.md` |
| ADR-0004 | Scenario results immutable, pinned to engine + ruleset versions | accepted | pre-D1 | `/engine/tax-rule-versioning.md` |
| ADR-0005 | Tax rulesets versioned in DB with publish-locks              | accepted | pre-D1 | `/engine/tax-rule-versioning.md` |
| ADR-0006 | Audit logs hash-chained and partitioned monthly              | accepted | pre-D1 | `/database/indexing-and-partitioning.md` |
| ADR-0007 | RLS on every tenant-scoped table, no service-role bypass in app code | accepted | pre-D1 | `/database/rls-policies.sql` |
| ADR-0008 | PII masking gateway in front of every LLM call               | accepted | pre-D1 | `/architecture/ai-integration.md` |
| ADR-0009 | OKLCH design tokens; Inter Variable with tnum                | accepted | pre-D1 | `/ui-ux/design-system.md`         |
| ADR-0010 | Reports rendered by workers, not inline; presigned-URL delivery | accepted | pre-D1 | `/reports-exports/scheduling-and-delivery.md` |

---

## Pending Decisions (Will Likely Become ADRs)

* Free-form AI chat surface vs structured-only — gating mechanism (BL-0012).
* Trust / SMSF ownership modelling effect on CGT discount (BL-0009).
* MFA approach (TOTP only vs WebAuthn) (BL-0006).
* Annual billing implementation (Stripe phase configurations) (BL-0021).

Move to the index above when drafted.
