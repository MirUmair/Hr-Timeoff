---
name: examplehr-hcm-domain
description: Implement or review ExampleHR HCM time-off domain behavior. Use for balance cells, leave types, optimistic requests, approvals, denials/rejections, pending/available/used math, stale version conflicts, reconciliation, mockDb changes, HCM client changes, or manager/employee workflow correctness.
---

# ExampleHR HCM Domain

## Source Of Truth

Treat mock HCM as the authoritative backend:

- Domain state is in `lib/hcm/mockDb.ts`.
- Client API wrappers are in `lib/hcm/hcmClient.ts`.
- Shared request and balance types are in `lib/types/`.
- Route handlers under `app/api/hcm/**/route.ts` are transport boundaries.

## Balance Math

Use these invariants:

- Creating a pending request decreases `available` and increases `pending`.
- Approving a pending request decreases `pending` and increases `used`.
- Denying/rejecting a pending request increases `available` and decreases `pending`.
- Every successful balance mutation increments the balance `version`.
- Request decisions should increment the request `version`.

## Conflict Rules

Use version checks to model stale HCM state:

- `expectedBalanceVersion` protects request creation.
- `expectedRequestVersion` protects manager decisions.
- On version mismatch, return a recoverable `409 CONFLICT` with the current version when possible.
- Do not silently approve or deny non-pending requests.

## Reconciliation Rules

For write flows:

1. Optimistically reflect user intent only when it improves UX.
2. Call the HCM route/client mutation.
3. Read authoritative HCM data after success.
4. Replace cached request/balance state with authoritative values.
5. If the authoritative state disagrees with the optimistic state, roll back or surface recovery UI.

## UI Expectations

- Employee UI should preserve draft input during recoverable failures.
- Manager UI should verify latest balance context before approval.
- Denial should be a deliberate action and show that pending hours were released.
- Conflict messages should tell the user to refresh/retry rather than imply data loss.
