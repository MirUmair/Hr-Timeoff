# Technical Requirements Document: ExampleHR Time-Off Frontend

## 1. Assignment Summary

ExampleHR needs a time-off frontend where employees can see trustworthy balances and submit time-off requests while the Human Capital Management system remains the source of truth. The UI must feel instant, but it cannot lie to the user: HCM may reject a request, refresh a balance in the background, return a conflict, or even appear to accept a mutation that later proves wrong.

The take-home asks for:

- An employee view for per-location balances and time-off submission.
- A manager view for reviewing, approving, and denying pending requests with balance context visible at decision time.
- A data layer that talks to mock HCM endpoints, supports optimistic UI, reconciles with HCM, and degrades gracefully when HCM is slow, wrong, or silent.
- Mock HCM route handlers or MSW handlers that simulate real-time reads/writes, batch balance reads, anniversary bonus refreshes, silent wrong mutations, insufficient-balance rejection, and conflict responses.
- Storybook stories for meaningful UI states.
- Tests and proof of coverage.
- A TRD that explains challenges, solution design, alternatives considered, cache strategy, reconciliation strategy, and how the component tree maps to the problem.

## 2. Goals

- Show employees current balances across employee/location/leave-type cells.
- Let employees submit time-off requests with immediate optimistic feedback.
- Keep HCM authoritative by reconciling optimistic state after mutations.
- Let managers approve or deny pending requests only with current balance context.
- Separate employee and manager workspaces with demo role-based authorization.
- Model stale reads, conflicts, insufficient balance, anniversary bonuses, and silent wrong mutations.
- Provide Storybook proof for critical states, not only happy paths.
- Provide tests that future contributors cannot silently break.

## 3. Non-Goals And Scope Boundaries

- No production identity provider, password storage, SSO, or durable auth backend. The app includes dummy credentials and a demo httpOnly role session so employee/manager authorization boundaries are exercised.
- No real HCM vendor integration.
- No durable database persistence.
- No full HR platform or complete policy engine.
- Employee edit/cancel flows are future product extensions, not required by the take-home brief.
- Browser E2E can be added as a later CI layer, but the take-home explicitly allows Storybook interaction, component, and integration tests against mock HCM.

## 4. User Needs

### Employee

The employee wants fast feedback after submitting a request, but should never see a misleading final state. A request may appear immediately as pending, but approval is not shown unless HCM confirms the lifecycle state.

### Manager

The manager needs the balance shown at decision time, not a stale value from initial page load. Approval and denial therefore use stronger server confirmation and authoritative balance refreshes.

## 5. Interesting Challenges

### HCM Owns The Numbers

ExampleHR does not own employment balances. The frontend must treat local state and optimistic UI as provisional until HCM confirms.

### Balances Can Change Elsewhere

Anniversary bonuses or annual refreshes can update HCM while the user has the app open. The UI must refresh without surprising the user or hiding the fact that the original visible balance was stale.

### Per-Cell Real-Time Reads

The prompt describes an authoritative read/write API for a single balance cell. The implementation uses per-cell reads for verification after writes and before manager approval.

### Batch Reads Are Useful But Expensive

The batch corpus endpoint is useful for initial hydration, employee switching, and broad refreshes. It is not the right tool for every manager decision because it is heavier and still may not be fresh enough for approval-time confidence.

### HCM Can Be Wrong Or Silent

The assignment explicitly says a success response can still be wrong. The app therefore includes a silent-wrong-mutation scenario and performs authoritative reads after writes so late contradictions are recoverable.

## 6. Proposed Solution

The implementation uses a small full-stack Next.js App Router app:

- Server-rendered route pages fetch initial mock HCM data.
- Client views use TanStack Query for request and balance server state.
- Next.js route handlers simulate HCM.
- Domain behavior lives in `lib/hcm/mockDb.ts`.
- Typed client functions live in `lib/hcm/hcmClient.ts`.
- Demo role sessions and dummy credential accounts live in `lib/auth/*` and guard employee and manager routes.
- Shared query keys live in `lib/query/queryKeys.ts`.
- Storybook stories document important workflow states.
- Vitest and Testing Library cover domain, route, client, reconciliation, and component behavior.

## 7. Architecture And Component Tree

### Route Tree

- `app/page.tsx`
  - Fetches initial employee balances and requests.
  - Requires an employee demo session.
  - Renders `EmployeeView`.
- `app/login/page.tsx`
  - Lets reviewers auto-fill dummy credentials for four student employee accounts and one manager account.
- `app/logout/route.ts`
  - Clears the demo session cookie.
- `app/auth-badge.tsx`
  - Shows the active demo role and logout control.
- `app/employee-view.tsx`
  - Client component for balances, request history, request form, optimistic submission, and reconciliation messages.
- `app/manager/page.tsx`
  - Fetches initial manager queue data.
  - Requires a manager demo session.
  - Renders `ManagerView`.
- `app/manager/manager-view.tsx`
  - Client component for approval queue, balance verification, approve, deny, stale/conflict recovery, and decision confirmations.
- `app/api/hcm/**/route.ts`
  - Mock HCM transport layer.
- `app/loading.tsx`, `app/error.tsx`, `app/manager/loading.tsx`, `app/manager/error.tsx`
  - Route-level loading and recovery states.

### Data Layer

- `lib/hcm/mockDb.ts`
  - In-memory HCM state, seed data, balance math, request lifecycle, conflict simulation, and scenario handling.
- `lib/hcm/hcmClient.ts`
  - Browser-facing typed fetch wrappers.
- `lib/types/balance.ts`
  - Balance cell and batch balance contracts.
- `lib/types/request.ts`
  - Request lifecycle and mutation input contracts.
- `lib/reconciliation/reconcileBalance.ts`
  - Reconciliation helper for optimistic and authoritative balance comparison.
- `lib/auth/demoSession.ts`, `lib/auth/serverSession.ts`
  - Static dummy credential catalog, demo session lookup, route guards, API cookie parsing, and role checks.

### Storybook Layer

- `app/employee-view.stories.tsx`
  - Employee seeded and empty request states.
- `app/manager/manager-view.stories.tsx`
  - Manager seeded, empty, and denied decision states.
- `stories/time-off-workflow.stories.tsx`
  - Visual proof board for workflow states such as optimistic submission, rollback, stale balance, denial, loading, and backend failure.

## 8. Data Model

### Balance Cell

Balances are modeled per employee, location, and leave type:

- `employeeId`
- `employeeName`
- `locationId`
- `locationName`
- `leaveType`
- `unit`
- `available`
- `pending`
- `used`
- `annualAllowance`
- `version`
- `lastCalculatedAt`
- `anniversaryBonusAppliedAt`

### Time-Off Request

Requests include:

- `id`
- `employeeId`
- `leaveType`
- `startDate`
- `endDate`
- `requestedAmount`
- `status`
- `reason`
- `createdAt`
- `updatedAt`
- `version`
- `clientMutationId`

Supported statuses:

- `pending`
- `approved`
- `rejected`

Future edit/cancel work can add `draft` and `cancelled` states if those workflows become product requirements.

## 9. Mock HCM Contract

Implemented endpoints:

- `POST /api/hcm/balances`
  - Batch balance corpus read.
- `GET /api/hcm/balance`
  - Authoritative per-cell balance read.
  - Supports `trigger=anniversary-bonus`.
- `GET /api/hcm/time-off-requests`
  - Request list read.
- `POST /api/hcm/time-off-requests`
  - Employee request creation.
- `POST /api/hcm/manager/approve`
  - Manager approval decision.
- `POST /api/hcm/manager/deny`
  - Manager denial decision.

All HCM route handlers require a valid demo session cookie. Employee sessions can read and mutate only their own employee record. Manager decision routes require the manager role and reject request bodies whose `managerId` does not match the signed-in manager session.

The demo login roster includes Maya Chen, Owen Rivera, Sofia Patel, and Leo Morgan as student employee accounts, plus Avery Brooks as the manager. The login page displays dummy usernames and passwords and provides auto-fill controls so reviewers can quickly switch sessions while still exercising credential validation and role-based authorization.

Supported scenarios:

- `normal`
- `conflict`
- `insufficient-balance`
- `silent-wrong-mutation`
- `anniversary-bonus` trigger on authoritative balance read

## 10. Balance And Request Rules

### Create Request

When an employee creates a request:

1. The UI snapshots the current React Query cache.
2. It creates a temporary optimistic request.
3. It decreases the visible available balance and increases visible pending balance.
4. It sends the mutation to HCM with the expected balance version.
5. On success, it replaces the optimistic request with the HCM request.
6. It performs an authoritative per-cell read.
7. If HCM contradicts the optimistic balance, it surfaces a recoverable conflict.
8. On failure, it restores the previous cache and preserves user input.

### Approve Request

When a manager approves:

1. The UI reads the latest per-cell HCM balance.
2. If the visible balance changed, approval is blocked and the manager reviews the refreshed context.
3. If the balance is stable, the approval mutation uses the expected request version.
4. HCM marks the request `approved`.
5. HCM moves hours from `pending` to `used`.
6. The UI refreshes the authoritative balance and request list.

### Deny Request

When a manager denies:

1. The denial mutation uses the expected request version.
2. HCM marks the request `rejected`.
3. HCM releases hours from `pending` back to `available`.
4. The UI refreshes authoritative balance and request state.

## 11. Optimistic Versus Pessimistic Decision

### Why Optimistic For Employee Submission

Employee submission benefits from immediate feedback. The UI can safely show a provisional pending request because it is not claiming approval. This improves perceived speed while remaining honest.

### Why Not Optimistic For Manager Approval

Approval affects a more sensitive lifecycle decision. A manager should not see an approval confirmed until HCM verifies the balance and request version. Manager approval and denial therefore use stronger confirmation and refetch behavior.

### Why Not Fully Pessimistic

Fully pessimistic submission would be simpler, but it would fail the assignment's requirement that the workflow feel instant and responsive. It also would not demonstrate the core tension between local responsiveness and HCM correctness.

## 12. Alternatives Considered

### Pessimistic Writes Only

This avoids rollback complexity, but makes the employee experience feel slow and does not prove the optimistic/reconciliation challenge requested by the assignment.

### Trusting Write Responses Without Re-Read

This is risky because HCM may silently accept the wrong mutation. The implementation instead performs an authoritative balance read after writes and treats mismatches as recoverable contradictions.

### Batch Read For Every Decision

The batch endpoint is useful for initial hydration, but too expensive and broad for approval-time confidence. The implementation uses batch reads for initial context and per-cell reads for critical verification.

### Local Component State Only

Local state would work for a toy form, but it does not model shared freshness, invalidation, rollback, or recovery across employee and manager views. TanStack Query is a better fit for server-owned state.

### One Generic Request Mutation Endpoint

Approval and denial have different consistency rules from employee creation. Separate manager endpoints keep request-version checks and balance movement explicit.

## 13. Cache Strategy

### Query Keys

The app centralizes query keys in `lib/query/queryKeys.ts`:

- HCM balance corpus.
- Per-cell balance reads.
- Request lists.
- Individual request records for future detail screens.

### Client Cache Ownership

React Query owns:

- Balance query state.
- Request query state.
- Mutation pending/error states.
- Manual cache replacement after authoritative reads.

### Cache Update Rules

- Create request: optimistic cache update, then authoritative replacement or rollback.
- Approval: verify per-cell balance, write decision, then replace request and balance caches.
- Denial: write decision, release pending balance in HCM, then replace request and balance caches.
- Conflict: show recoverable warning and require refresh/retry.

## 14. Reconciliation Strategy

### Successful Reconciliation

On success:

- Replace temporary request IDs with HCM request IDs.
- Replace local balance cells with authoritative balance cells.
- Remove temporary optimistic status.
- Show completion or confirmation status.

### Failed Reconciliation

On failure:

- Restore the previous balance and request cache snapshot.
- Preserve form input.
- Show a domain-specific message.
- Mark the affected balance cell as `rejected` or `conflicted`.

### Background Refresh With In-Flight Action

If HCM changes while a mutation or approval is in flight:

- Employee create uses `expectedBalanceVersion` so stale creates are rejected as conflicts.
- Manager approval reads the latest balance immediately before approval.
- If approval-time balance differs from the visible balance, the UI blocks the decision and asks the manager to review the refreshed context.
- Anniversary bonus is modeled with an explicit trigger so tests and stories can prove the refresh behavior.

## 15. Error Handling

The app handles:

- Validation errors.
- Insufficient balance.
- Version conflicts.
- Silent wrong mutation contradictions.
- Route-level unexpected errors.
- Loading states during route fetches.

User-facing principles:

- Preserve user input where possible.
- Avoid claiming approval before HCM confirms.
- Make recoverable conflicts explicit.
- Give the user a retry or refresh path.

## 16. Storybook Plan And Coverage

Storybook is used as proof that the UI states were considered beyond the happy path.

Covered stories include:

- Employee seeded workspace.
- Employee empty request queue.
- Manager seeded queue.
- Manager empty queue.
- Manager denied decision.
- Workflow proof board for optimistic submission, validation error, rollback, stale balance, silent wrong mutation, manager denial, loading skeleton, and offline/backend failure.

Storybook is runnable with:

```bash
npm run storybook
```

The static Storybook build is verified with:

```bash
npm run build-storybook
```

## 17. Test Strategy

The assignment says Storybook interaction tests, component tests, and integration tests against mock HCM are all fair game. This implementation uses a layered suite:

### Domain Tests

`tests/mockDb.test.ts` covers:

- Seeded balance grid.
- Insufficient balance rejection.
- Anniversary bonus behavior.
- Approval balance movement.
- Denial balance release.

### Route Integration Tests

`tests/routes.test.ts` covers:

- Invalid HCM input handling.
- Batch balance reads.
- Request creation.
- Approval route behavior.
- Denial route behavior.
- Authentication-required, wrong-role, and cross-employee authorization failures.
- Dummy credential lookup and account catalog behavior.

### Client Tests

`tests/hcmClient.test.ts` covers:

- Endpoint wiring.
- HCM error parsing.
- Approval and denial client calls.

### Reconciliation Tests

`tests/reconcileBalance.test.ts` covers:

- In-sync authoritative balance.
- Stale optimistic balance.
- Authoritative overwrite detection.

### Component Tests

`tests/employee-view.test.tsx`, `tests/employee-view.interaction.test.tsx`, `tests/manager-view.test.tsx`, and `tests/manager-view.interaction.test.tsx` cover:

- Employee balance and request rendering.
- Employee request form interaction with `@testing-library/user-event`.
- Optimistic pending feedback and final authoritative reconciliation.
- Rollback, preserved form input, silent wrong mutation warning, and recoverable conflict messaging.
- Manager queue rendering.
- Manager request approval verification, stale-balance blocking, approve success, deny success, and conflict recovery with `@testing-library/user-event`.
- Approval and denial controls.

### Auth And Login Tests

`tests/demoSession.test.ts` and `tests/login-panel.test.tsx` cover:

- Dummy credential catalog behavior.
- Demo role session lookup.
- Employee access checks.
- Login account selection and auto-fill behavior.

### Coverage Proof

`npm run test:coverage` is the proof command for the submitted test suite. The latest local verification passed:

- 10 test files passed.
- 39 tests passed.
- Statements: 76.59%.
- Branches: 65.46%.
- Functions: 78.18%.
- Lines: 76.95%.

The Vitest coverage configuration uses V8 coverage and enforces 50% thresholds for statements, branches, functions, and lines. It includes `app/**/*.{ts,tsx}` and `lib/**/*.{ts,tsx}` while excluding Storybook files, route shells, loading components, error components, layouts, and pages that would dilute behavior-focused coverage. The generated proof artifacts are `coverage/index.html` and `coverage/lcov.info`.

### Browser E2E Position

Browser E2E with Playwright or Cypress would be a good next CI layer for the full browser journey. It is not included in the current implementation because the assignment did not require a specific E2E framework and explicitly allowed Storybook, component, and integration tests as fair-game proof.

## 18. Verification Commands

Primary commands:

```bash
npm run lint
npm run test:coverage
npm run build
npm run build-storybook
```

Expected proof:

- Lint passes.
- `npm run test:coverage` passes with 10 test files, 39 tests, and coverage above configured thresholds.
- Next.js production build passes.
- Storybook production build passes.

## 19. Risks And Mitigations

### Risk: Optimistic UI Drifts From HCM

Mitigation: Use expected versions, rollback snapshots, and authoritative per-cell reads after mutations.

### Risk: Manager Approves Stale Balance

Mitigation: Manager approval performs a per-cell balance read before approval and blocks if the visible balance changed.

### Risk: Mock HCM Diverges From Real HCM

Mitigation: Keep route handlers behind typed client functions and centralize domain rules in `mockDb`.

### Risk: Storybook Becomes Too Broad

Mitigation: Keep full route logic in the app, and use Storybook for meaningful states and composite workflow proof.

### Risk: Tests Only Cover Happy Paths

Mitigation: Include insufficient balance, conflict, denial, anniversary bonus, route validation, and reconciliation tests.

## 20. Acceptance Criteria

- Employee can view per-location balances.
- Employee and manager workspaces are separated by dummy credential demo login.
- Employee can submit a time-off request with optimistic pending feedback.
- Failed employee mutations roll back and preserve form input.
- HCM remains the source of truth after reconciliation.
- Manager can approve pending requests with fresh balance verification.
- Manager can deny pending requests and release pending balance.
- Mock HCM supports batch reads, per-cell reads, create, approve, deny, anniversary bonus, insufficient balance, conflict, and silent wrong mutation.
- Mock HCM routes reject missing sessions, wrong roles, and cross-employee access.
- Storybook documents meaningful UI states.
- Test suite covers domain, route, client, reconciliation, and component behavior.
- Project builds successfully with Next.js and Storybook.
