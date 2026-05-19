# Defect Log

> Every bug, broken flow, failing test, or unexpected behaviour discovered during the 15-day build. Defects are opened the moment they are observed (even if not yet diagnosed) and closed only with evidence of fix + regression test. Owned by Opus; Code appends new entries during execution.

---

## Conventions

* **ID**: `DEF-NNNN`, monotonically increasing, never reused.
* **Severity**:
  * `sev1` — wrong financial number reachable by a user; data exposure; auth bypass; engine determinism violation. **Halts the day.**
  * `sev2` — broken core flow; failing CI check; missing disclaimer; significant a11y regression.
  * `sev3` — minor UI issue; non-blocking test flake; performance regression within tolerance.
  * `sev4` — cosmetic; doc inconsistency.
* **Status**: `open` → `investigating` → `fix-in-progress` → `fix-ready` → `verified` → `closed`. A defect may also be `wontfix` (with rationale) or `duplicate-of <ID>`.
* **Surface**: where it manifests — `engine`, `db`, `api`, `web`, `auth`, `billing`, `reports`, `ai`, `ops`, `ci`, `docs`.
* **Regression test**: every `closed` defect must reference a test that would catch it again.

---

## Severity Rules

* **sev1 must be addressed before any other work resumes**, including the morning ritual on the next day.
* **sev2 must be closed before the next day's spine begins**, unless explicitly deferred by Opus with a deviation entry.
* **sev3/sev4 may be batched** and addressed on hardening days (14–15) or as opportunistic fixes within their surface area.

---

## Open Defects

| ID       | Severity | Surface | Title                                                    | Opened day | Status      | Owner | Notes                              |
| -------- | -------- | ------- | -------------------------------------------------------- | ---------- | ----------- | ----- | ---------------------------------- |
| _empty_  |          |         |                                                          |            |             |       |                                    |

---

## Closed Defects

| ID       | Severity | Surface | Title                                                    | Opened | Closed | Closing commit | Regression test                  |
| -------- | -------- | ------- | -------------------------------------------------------- | ------ | ------ | -------------- | -------------------------------- |
| _empty_  |          |         |                                                          |        |        |                |                                  |

---

## Entry Template

When opening a defect, copy this block into the "Open" table and expand below with full detail:

```
### DEF-NNNN — <one-line title>

* **Severity**: sev1 / sev2 / sev3 / sev4
* **Surface**: <surface>
* **Opened**: Day NN (YYYY-MM-DD) by <Code | Opus | human>
* **Status**: open

**Observed behaviour**
<what happened — concrete, with command output or screenshot reference>

**Expected behaviour**
<what should have happened — link to spec or test fixture>

**Reproduction steps**
1. <step>
2. <step>
3. <step>

**First-seen commit / context**
<SHA or "since baseline">

**Initial hypothesis**
<short — may be wrong; updated on investigation>

**Blast radius**
<what users / scenarios / surfaces this affects, if known>

**Disclosure considerations** (sev1/sev2 only)
<does this need customer comms, statuspage update, ASIC notification, etc.>
```

When closing:

```
**Diagnosis**
<root cause — single sentence then expansion>

**Fix**
<what was changed; commit SHAs>

**Regression test**
<path to the test that now covers the case>

**Verification**
<commands run and outcomes>

**Closed**: Day NN (YYYY-MM-DD) by <name>
**Status**: closed
```

---

## Anti-Patterns

* **No silent closures.** A defect with no regression test cannot be closed.
* **No re-opening without a new ID.** If a "fixed" defect recurs, open a new defect referencing the prior one. The prior entry remains closed; the new one captures fresh evidence.
* **No "wontfix" without rationale.** A `wontfix` defect lists the explicit trade-off (e.g., "expected behaviour per legislation", "out of MVP scope, moved to BL-NNNN").
* **No sev1 batching.** Sev1 is never bundled with other work.
