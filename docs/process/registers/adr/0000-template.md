# ADR-0000: Template

> This is the template for new Architecture Decision Records. Copy this file to `adr/NNNN-<slug>.md` (next free ID from `adr-index.md`) and fill in. Do not modify this file.

---

## Status

`proposed` | `accepted` | `rejected` | `superseded-by-ADR-NNNN`

Set to `proposed` on creation. Updated by Opus when the decision is finalised. If superseded, the link points to the replacing ADR.

## Date

`YYYY-MM-DD`

## Day of Build

`Day NN` (or `pre-D1` for foundational decisions made before the sprint started)

## Authors

* Opus (drafted)
* Human approver
* Code (consulted, if applicable)

## Linked Records

* Deviation: `DEV-NNNN` (if this ADR was triggered by a deviation)
* Defect: `DEF-NNNN` (if triggered by a defect)
* Backlog: `BL-NNNN` (if triggered by a planning decision)
* Tech debt: `TD-NNNN` (if accepting debt knowingly)
* Supersedes: `ADR-NNNN` (if replacing a prior decision)

---

## Context

What is the situation that requires a decision? What are the forces at play? What constraints (technical, regulatory, product, time) are in scope?

Two to four paragraphs is usually enough. Cite specific documents (`/architecture/...`, `/engine/...`) where context lives, rather than restating them.

## Decision

A clear, declarative statement of what was decided.

> Example: "We will represent all monetary amounts as `bigint` cents end-to-end (DB `BIGINT`, TS `bigint`, JSON serialised as strings). We will not use floating-point or `Decimal` libraries within the engine."

## Consequences

### Positive

* What becomes easier?
* What risk is reduced?
* What invariants are preserved?

### Negative

* What becomes harder?
* What is forgone?
* What ongoing cost is accepted?

### Neutral / Notes

* Anything else future readers should know.
* Implementation hints (without becoming a spec — link to the spec instead).
* Migration plan if this changes existing behaviour.

## Alternatives Considered

For each alternative, one or two sentences on why it was not chosen.

1. **Alternative A** — why not.
2. **Alternative B** — why not.
3. **Do nothing** — why not (or "considered and partly adopted as a fallback").

## Validation

How will we know this decision was correct? What signals would tell us to revisit?

* Metric or test that confirms the decision is working.
* Trigger that would re-open this decision (e.g., "if we add a non-AUD currency, revisit").

## References

* External: legislation, RFCs, vendor docs, papers.
* Internal: `/docs/**` paths.
