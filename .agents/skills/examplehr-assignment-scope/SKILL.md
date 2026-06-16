---
name: examplehr-assignment-scope
description: Compare ExampleHR time-off app changes against the take-home assignment and TRD. Use when checking whether features, tests, Storybook states, README content, or implementation scope match the assignment brief; when deciding whether edit/cancel/reject/E2E gaps are real requirements; or when preparing a gap analysis before submission.
---

# ExampleHR Assignment Scope

## Core Workflow

1. Read the actual assignment context before judging scope:
   - Prefer the pasted assignment text in `.codex/attachments` if available.
   - Use `TRD.md` as a design/spec artifact, not as the sole source of truth.
   - If a PDF or pasted brief is referenced, inspect that source before claiming a gap.
2. Separate assignment requirements from stretch goals.
3. When reporting gaps, cite exact files and line numbers from the implementation.
4. Avoid inventing missing features that the take-home did not ask for.

## Assignment-Relevant Behaviors

The app should focus on:

- Employee request creation with optimistic UI and reconciliation against HCM.
- HCM as source of truth for balances and request state.
- Per-cell balances by employee, leave type, and location.
- Manager approval or denial with stale/version conflict handling.
- Error, loading, conflict, rollback, and recovery states.
- Unit/integration tests, Storybook scenarios, and README explanation.

## Scope Triage

Treat these as high-priority if missing:

- Request creation path.
- Authoritative HCM read-after-write reconciliation.
- Balance version conflict behavior.
- Manager approve/deny decision path.
- Tests for domain logic, API route handlers, and client behavior.
- Storybook states proving important UI states.
- README explaining stack, decisions, and verification.

Treat these as optional unless the actual assignment brief explicitly asks for them:

- Employee edit request flow.
- Employee cancel request flow.
- Browser-level Playwright or Cypress E2E tests.
- Full production auth, database persistence, or real HCM integration.

## Reporting Style

When asked whether the project is covered:

- Start with a short verdict.
- List covered requirements first.
- List remaining gaps only if they are grounded in the actual assignment.
- Include defense notes for why a scoped-down implementation is acceptable.
