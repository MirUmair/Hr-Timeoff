---
name: examplehr-quality-gates
description: Validate ExampleHR app changes with the right tests and build checks. Use when adding or reviewing tests, coverage, Storybook stories, loading/error states, README proof, CI-like verification, or before declaring the take-home ready to submit.
---

# ExampleHR Quality Gates

## Test Surfaces

Prefer coverage across these layers:

- `lib/hcm/mockDb.ts` for domain math and conflict behavior.
- `app/api/hcm/**/route.ts` for request parsing and HTTP responses.
- `lib/hcm/hcmClient.ts` for endpoint wiring and error handling.
- Employee and manager views for user-visible behavior.
- Storybook stories for static/visual workflow states.

## Commands

Run the smallest useful command while iterating, then finish with:

```powershell
npm run lint
npm run test:coverage
npm run build
npm run build-storybook
```

If Storybook fails from corrupted `node_modules` files, verify whether the error is dependency corruption before changing app code.

## Coverage Guidance

- Keep coverage thresholds meaningful but realistic for take-home scope.
- Exclude static route shells, layout files, and Storybook story files from coverage if they dilute behavioral coverage.
- Do not exclude domain logic, API routes, or client behavior just to hit thresholds.

## Storybook Guidance

Add stories for states the assignment or TRD calls out:

- Loaded request lists.
- Empty manager queue.
- Optimistic submission.
- Validation failure.
- Rollback or conflict recovery.
- Loading skeletons.
- Error/retry surfaces.
- Manager approval and denial outcomes.

## Final Report

When summarizing verification, include exact command results:

- Lint status.
- Test count and coverage summary.
- Production build status.
- Storybook build status.
- Any residual warnings that do not block submission.
