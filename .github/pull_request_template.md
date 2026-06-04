## Summary

<!-- 1–3 bullet points: what changed and why -->

-
-

## Task ID

<!-- Every PR must reference at least one task ID. Commit subjects must end with [DNN-TM]. -->

Day: <!-- e.g. 01 -->
Task(s): <!-- e.g. D01-T5 -->

## Evidence

<!-- Path(s) to checkpoint file(s) that verify this work -->

`docs/process/prompts/day-NN/checkpoints/DNN-TM.txt`

## Checklist

- [ ] All wired CCTV checks pass locally (`pnpm audit:cctv --day NN`)
- [ ] Every commit subject ends with `[DNN-TM]`
- [ ] No new `any` / `@ts-ignore` without a comment explaining why
- [ ] Engine changes: no `Date`, `Math.random`, or forbidden imports
- [ ] Register entries added for any new defects / deviations / tech debt
- [ ] Prettier clean (`pnpm format:check`)
