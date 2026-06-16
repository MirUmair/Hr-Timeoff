# Technical Requirements Document: Time Off Workflow

## 1. Purpose

This document defines the technical design for the time-off experience in `examplehr-timeoff`.
It describes the target architecture, data flow, optimistic update behavior, cache strategy, mock HCM endpoints, Storybook coverage, and the testing approach.

The current repository is a minimal Next.js App Router shell. The implementation described here is the intended next step and should be built without introducing unnecessary routing or state complexity.

## 2. Goals

- Let an employee view current time-off balance, requests, and request status.
- Let an employee create, edit, and cancel time-off requests with immediate UI feedback.
- Keep the UI responsive by using optimistic updates for write operations.
- Reconcile optimistic state with canonical server state after each mutation.
- Avoid stale data through deliberate cache invalidation and revalidation.
- Provide isolated mock HCM endpoints so development and Storybook can run without a real backend.
- Maintain strong test coverage at the component, integration, and flow level.

## 3. Non-Goals

- Building a full HR platform.
- Implementing real authentication or authorization beyond local mock/session assumptions.
- Modeling every possible leave policy edge case on day one.
- Coupling the UI directly to a vendor-specific HCM API shape.

## 4. Current App Shape

The repository currently contains a single App Router entrypoint:

- `app/layout.tsx`
- `app/page.tsx`
- `app/globals.css`

That means the first feature work should remain centered on the App Router model:

- Keep route UI in `app/`.
- Colocate feature utilities in private folders or feature folders under `app/` as the app grows.
- Use server-rendered pages as the source of truth and client components for interactive mutation flows.

## 5. Proposed Architecture

### 5.1 High-Level Structure

The app should follow a layered design:

- Presentation layer: route pages, layouts, and reusable UI components.
- Interaction layer: client components for forms, filters, dialogs, and optimistic state.
- Data layer: typed API client or server-side data adapters that talk to the HCM contract.
- Cache layer: React Query for client-side query state plus Next.js cache revalidation for server-rendered data.
- Mock layer: local HCM endpoints that simulate the real backend contract.

### 5.2 Recommended Folder Boundaries

The implementation should be organized by feature, not by technology alone.

Suggested shape:

- `app/`
- `app/(timeoff)/`
- `app/(timeoff)/page.tsx`
- `app/(timeoff)/time-off-request/[id]/page.tsx`
- `app/api/hcm/...`
- `components/`
- `components/time-off/`
- `lib/`
- `lib/hcm/`
- `lib/query/`
- `lib/validators/`
- `stories/`

The exact folder names can change, but the separation should remain:

- routes own layout and navigation composition,
- feature components own UI behavior,
- data adapters own API translation,
- mock endpoints own fake persistence,
- stories own isolated UI examples.

### 5.3 Server and Client Responsibilities

Use server components for:

- initial data loading,
- page-level authorization checks,
- canonical reads that should be cacheable,
- server mutations when a mutation should end with revalidation.

Use client components for:

- request forms,
- date pickers,
- filters,
- dialog flows,
- optimistic mutations,
- interactive error recovery.

This split keeps the server authoritative while keeping the UI fast and tactile.

## 6. Data Model

The TRD assumes the app will work with a small canonical model:

- `TimeOffBalance`
- `TimeOffRequest`
- `Employee`
- `Policy`

Minimum `TimeOffRequest` fields:

- `id`
- `employeeId`
- `type`
- `startDate`
- `endDate`
- `status`
- `reason`
- `createdAt`
- `updatedAt`

Statuses should include at least:

- `draft`
- `pending`
- `approved`
- `rejected`
- `cancelled`

The UI should never assume a request is immutable until the server confirms it.

## 7. Data Fetching Strategy

### 7.1 Source of Truth

The server is the source of truth.

Canonical read paths should come from the HCM adapter or from cached server helpers that call the HCM adapter.
Client state may temporarily diverge during optimistic actions, but it must eventually reconcile to server data.

### 7.2 Query Ownership

Use React Query on the client for:

- request lists,
- request detail views,
- balance summaries,
- lookup data needed by forms,
- mutation status and rollback handling.

Use Next.js server rendering for:

- the first paint of the dashboard,
- route transitions that benefit from server composition,
- cacheable data that can be streamed or revalidated.

This gives us a hybrid model:

- server-rendered shell for fast initial delivery,
- client query cache for responsive interactions,
- server revalidation for durable freshness.

## 8. Optimistic Update Strategy

### 8.1 Principles

Optimistic updates should make the interface feel immediate while remaining reversible.

Every mutation should follow this shape:

1. Snapshot the current client cache.
2. Apply a minimal optimistic change.
3. Mark the affected row or form as pending.
4. Send the mutation request.
5. Replace the optimistic record with server-confirmed data on success.
6. Roll back the snapshot on failure.

### 8.2 What Gets Optimistically Updated

Optimistic updates should be used for:

- creating a request,
- editing a request,
- cancelling a request,
- changing a request draft before submission,
- toggling local filters if they are purely client-side.

Optimistic updates should not be used for:

- policy calculations that depend on server-only rules,
- approval decisions,
- any data that could affect permissions or payroll without server confirmation.

### 8.3 Temporary IDs

For create flows, the client should generate a temporary ID and insert a pending row immediately.

That row should include:

- a local-only `optimisticId`,
- a visual pending state,
- any user-entered fields,
- a clear pending timestamp or badge when useful.

When the server responds:

- replace the temporary ID with the real ID,
- merge the confirmed fields,
- remove the optimistic marker.

### 8.4 Mutation Queueing

If multiple edits happen quickly on the same item, the client should serialize them or reject stale submissions.

Recommended approach:

- disable the submit action while a request is in flight for the same entity,
- allow list browsing during submission,
- keep the latest local edit visible in the form,
- prevent duplicate create submissions by idempotency key or request fingerprint.

## 9. Reconciliation Strategy

### 9.1 Success Reconciliation

On successful mutation:

- update the affected query caches with the canonical server response,
- remove any optimistic placeholder,
- sync derived views such as balance summaries or counts,
- clear validation messages associated with the submitted draft,
- refetch if the server returned only a partial payload.

### 9.2 Failure Reconciliation

On failure:

- restore the previous snapshot,
- show a domain-specific error message,
- preserve user-entered form state where possible,
- highlight the failed entity or field,
- allow retry without forcing the user to rebuild the request.

### 9.3 Conflict Reconciliation

If the server rejects a mutation because the underlying record changed:

- treat it as a version conflict, not a generic failure,
- refetch the canonical request,
- show a warning that the record changed elsewhere,
- keep a diff-friendly summary of what was overwritten if possible.

This is important for HR flows because approvals, cancellations, and policy changes can happen from multiple surfaces.

### 9.4 Reconciliation Policy by Mutation Type

- `create`: replace optimistic placeholder with returned request.
- `edit`: merge server-confirmed fields into the existing row.
- `cancel`: flip status to cancelled locally, then confirm or roll back.
- `approve/reject`: usually require a stronger server confirmation and a mandatory refetch.

## 10. Cache Invalidation Strategy

### 10.1 Client Cache

React Query should hold the client-side query state.

Recommended invalidation behavior:

- invalidate the request list after create/edit/cancel,
- invalidate the specific request detail after any direct change to that request,
- invalidate the balance summary after any status change that can affect accrual or availability,
- avoid blind full-cache clears unless the user switches employee context or tenant.

### 10.2 Server Cache

For server-rendered reads, use Next.js cache tagging or path revalidation around the canonical data layer.

Tag groups should align with business objects, not UI widgets:

- `time-off-requests`
- `time-off-request:{id}`
- `time-off-balance:{employeeId}`
- `employee:{employeeId}`

Recommended invalidation rules:

- `updateTag` for immediate read-your-own-writes behavior after mutations in server actions,
- `revalidateTag` when stale-while-revalidate is acceptable,
- `revalidatePath` only when route-level re-rendering is simpler than tag-based invalidation.

### 10.3 Invalidation Matrix

- Create request: invalidate request list, current balance, and the new detail record.
- Edit request: invalidate request detail, request list, and any dependent balance data.
- Cancel request: invalidate request detail, request list, and balance data.
- Approve/reject: invalidate the full employee time-off view and any aggregate summaries.

### 10.4 Invalidation Timing

Preferred order:

1. Perform the mutation.
2. Persist the canonical result.
3. Invalidate the smallest useful cache scope.
4. Update client query caches.
5. Re-render or refetch only where needed.

This keeps the UI fast while minimizing thrash.

## 11. Mock HCM Endpoints

### 11.1 Purpose

Mock HCM endpoints let us build and test the UI before the real integration exists.

They should emulate:

- realistic latency,
- validation failures,
- stale reads,
- version conflicts,
- policy denials,
- pagination or filtering behavior if needed.

### 11.2 Contract Design

The mock API should mirror a stable HCM contract rather than the UI directly.

Recommended endpoint groups:

- `POST /api/hcm/balances`
- `GET /api/hcm/balance`
- `GET /api/hcm/time-off-requests`
- `POST /api/hcm/time-off-requests`
- `POST /api/hcm/manager/approve`

If the UI later needs manager workflows, add separate endpoints for approvals rather than folding them into employee endpoints.

### 11.3 Mock Behavior Requirements

The mock service should support:

- deterministic seed data,
- resettable state for tests,
- server-side validation errors,
- conflict simulation via version numbers or ETags,
- request delay injection,
- optional failure injection for testing retries.
- batch balance reads,
- per-cell authoritative balance reads,
- insufficient balance rejection,
- silent success with the wrong internal mutation,
- anniversary bonus triggering.

### 11.4 Mock Persistence

For local development, persistence can be in memory or file-backed depending on how durable the workflow needs to be.

Recommended default:

- in-memory during tests and Storybook,
- file-backed or local-only persistence during manual dev if we want state to survive refreshes.

The important rule is that the contract must stay identical across both modes.

## 12. Storybook Coverage

Storybook should be used to document and validate the critical UI states independently from the route shell.

### 12.1 What to Cover

Create stories for:

- request list empty state,
- request list populated state,
- request row pending state,
- request row error state,
- request detail panel,
- request creation form,
- validation error state,
- optimistic submission state,
- cancelled request state,
- balance summary card,
- loading skeletons,
- offline or backend failure states.

### 12.2 Story Composition Strategy

Stories should primarily target presentational and interaction components, not the full route.

Prefer:

- component-level stories for cards, tables, forms, and dialogs,
- composite stories for a full dashboard panel,
- mocked query/provider wrappers for data-dependent states.

Avoid:

- duplicating the entire app route in Storybook,
- coupling stories to live network calls,
- depending on global mutable state that makes stories order-sensitive.

### 12.3 Storybook Data Sources

Stories should consume:

- static fixture data,
- mock query client state,
- mock handlers that simulate success and failure,
- seeded states for optimistic and conflict scenarios.

This makes Storybook useful as both a design reference and a regression tool.

## 13. Testing Strategy

### 13.1 Test Layers

The test pyramid should be:

- unit tests for pure helpers and validators,
- component tests for rendering and interaction,
- integration tests for query + mutation flows,
- end-to-end tests for the full user journey.

### 13.2 Unit Tests

Unit test:

- date normalization,
- request status transitions,
- balance calculations,
- validation helpers,
- optimistic merge and rollback helpers,
- endpoint serializers and adapters.

These tests should be fast and deterministic.

### 13.3 Component Tests

Component tests should verify:

- forms render the correct labels and fields,
- validation errors appear in the right places,
- pending UI is visible during submission,
- optimistic rows render immediately,
- error states preserve user input,
- disabled states prevent duplicate submits.

### 13.4 Integration Tests

Integration tests should exercise the data layer with mocked HCM endpoints:

- fetch request list, create request, and confirm cache updates,
- edit request and verify invalidation of dependent views,
- cancel request and verify reconciliation after response,
- simulate conflict and verify refetch and warning UI,
- simulate validation error and verify rollback.

### 13.5 End-to-End Tests

E2E tests should cover the highest-value flows in a browser:

- create a request from the dashboard,
- edit a request and see the canonical result,
- cancel a request,
- recover from a validation error,
- handle a network failure gracefully.

Because this is an App Router app and some screens may be async server-rendered, E2E tests should be the primary confidence layer for route-level behavior.

### 13.6 Storybook as Visual Test Support

Storybook is not a replacement for tests, but it should reduce the chance of UI regressions by giving us reproducible states for:

- pending,
- empty,
- loaded,
- error,
- conflict,
- skeleton,
- optimistic.

## 14. Error Handling

Errors should be explicit and recoverable.

Expected error classes:

- validation errors,
- auth/session errors,
- conflict errors,
- network failures,
- unexpected server errors.

UI behavior:

- validation errors should stay near the field,
- conflicts should explain that the data changed elsewhere,
- network failures should offer retry,
- unexpected errors should fall back to a safe boundary with a support-friendly message.

## 15. Observability

At minimum, log and/or surface:

- mutation start and failure,
- conflict occurrences,
- invalidation events,
- latency of mock and real HCM calls,
- error class and endpoint name.

This makes it much easier to debug optimistic UI bugs and cache staleness.

## 16. Risks

- Optimistic UI can drift from server truth if reconciliation is incomplete.
- Over-invalidating caches can make the app feel slow and noisy.
- Under-invalidating caches can leave users seeing stale leave balances.
- Mock endpoints that diverge from the real HCM contract will create integration churn later.
- Storybook can become noisy if we model too many states without a fixture strategy.

## 17. Implementation Order

1. Define the HCM data contract and request lifecycle.
2. Build the mock endpoints and seed data.
3. Implement the server read path and route shell.
4. Add query caching and optimistic mutation helpers.
5. Wire cache invalidation and reconciliation.
6. Add Storybook stories for each key state.
7. Add unit, component, integration, and E2E coverage.

## 18. Acceptance Criteria

- Users can create, edit, and cancel time-off requests with immediate optimistic feedback.
- Failed mutations roll back cleanly and preserve user input.
- The UI shows canonical server data after reconciliation.
- Request lists and balances refresh correctly after mutations.
- Mock HCM endpoints support local development and Storybook without external dependencies.
- The critical flows have test coverage across unit, component, integration, and browser layers.
