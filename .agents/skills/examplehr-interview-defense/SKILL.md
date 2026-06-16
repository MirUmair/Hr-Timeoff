---
name: examplehr-interview-defense
description: Prepare the user to defend the ExampleHR time-off app in an interview or take-home review. Use when explaining why the stack was chosen, how optimistic UI and reconciliation work, how HCM consistency is protected, what tradeoffs were made, or how to answer reviewer questions confidently.
---

# ExampleHR Interview Defense

## Answer Style

Help the user answer like the implementer:

- Start with the product problem.
- Explain the technical choice.
- Name the tradeoff.
- Point to how the code proves the behavior.
- Keep answers honest about scoped-out items.

## Core Talking Points

Use these explanations:

- Next.js App Router provides a compact full-stack surface for pages and mock HCM route handlers.
- React Query is used because balances and requests are server state with freshness, invalidation, and mutation concerns.
- The mock HCM is intentionally isolated in `lib/hcm/mockDb.ts` so domain behavior can be tested without UI noise.
- Version fields model stale HCM data and protect against unsafe writes.
- Optimistic UI improves responsiveness, but authoritative read-after-write protects correctness.
- Storybook documents UX states reviewers may not naturally trigger during a demo.
- Vitest/RTL proves domain logic, route behavior, and user-visible states quickly.

## Defending Tradeoffs

If asked why there is no real database:

Say the assignment is frontend/product-context focused, so the mock HCM simulates authoritative backend behavior, conflicts, and failures without adding deployment or infra noise.

If asked why no edit/cancel:

Check the actual assignment first. If not explicitly required, say the app focuses on create, reconcile, approve, and deny because those exercise the key HCM consistency risks.

If asked why not E2E:

Say the current suite covers domain, route, and component behavior, while Storybook covers visual states. Browser E2E would be the next step if this moved toward production CI.

If asked how denial works:

Say denial is a manager decision on a pending request. It marks the request as rejected, increments the request version, releases pending hours back to available balance, and refreshes authoritative HCM state in the UI.

## Practice Format

When grilling or preparing answers:

1. Ask one interview question at a time.
2. Give a strong sample answer.
3. Mention the file or behavior that backs it up.
4. Add one follow-up question the reviewer might ask.
