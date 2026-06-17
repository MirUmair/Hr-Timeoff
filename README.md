# ExampleHR Time Off

ExampleHR Time Off is a Next.js App Router take-home implementation for a time-off workflow backed by mock HCM APIs. The app keeps HCM as the source of truth while giving employees and managers fast, honest feedback about balances and decisions.

## Stack

- Next.js App Router
- TypeScript with `strict` enabled
- TanStack Query for client-side server state
- Demo httpOnly cookie sessions with dummy credentials for employee/manager role separation
- Storybook for isolated workflow states
- Vitest and Testing Library
- Mock HCM route handlers under `app/api/hcm`

## Implemented Workflow

- Employee balance view across per-employee, per-location balance cells.
- Demo login for multiple student employee accounts and one manager account, with auto-fill credential cards.
- Employee request submission with optimistic UI feedback.
- Authoritative per-cell balance verification after writes.
- Manager approval with fresh HCM balance verification at decision time.
- Manager denial that marks the request as rejected and releases pending hours back to available balance.
- Route loading and error states for graceful recovery.

## Mock HCM Scenarios

- Batch balances: `POST /api/hcm/balances`
- Per-cell authoritative read: `GET /api/hcm/balance?employeeId=emp-1001&leaveType=vacation`
- Time-off request write: `POST /api/hcm/time-off-requests`
- Manager approve: `POST /api/hcm/manager/approve`
- Manager deny: `POST /api/hcm/manager/deny`
- Insufficient balance rejection via `scenario: "insufficient-balance"` or requesting more than available.
- Conflict response via `scenario: "conflict"` or stale expected versions.
- Silent success but wrong mutation via `scenario: "silent-wrong-mutation"`.
- Anniversary bonus trigger via `/api/hcm/balance?trigger=anniversary-bonus`.

## Coverage Proof

- `tests/mockDb.test.ts`: HCM business rules, balance changes, anniversary bonus, approval, and denial.
- `tests/routes.test.ts`: API contract for batch reads, per-cell reads, request creation, approval, and denial.
- `tests/hcmClient.test.ts`: typed client endpoint wiring and HCM error parsing.
- `tests/reconcileBalance.test.ts`: optimistic-to-authoritative balance reconciliation.
- `tests/employee-view.test.tsx`: employee balance and request UI rendering.
- `tests/manager-view.test.tsx`: manager queue, approve, and deny controls.

## Development

```bash
npm run dev
```

Open `http://localhost:3000/login`, choose an account card to auto-fill credentials, then sign in.

Demo credentials:

| Workspace | Username | Password |
| --- | --- | --- |
| Maya Chen - student employee | `maya.chen@examplehr.test` | `Maya#2026` |
| Owen Rivera - student employee | `owen.rivera@examplehr.test` | `Owen#2026` |
| Sofia Patel - student employee | `sofia.patel@examplehr.test` | `Sofia#2026` |
| Leo Morgan - student employee | `leo.morgan@examplehr.test` | `Leo#2026` |
| Avery Brooks - manager | `avery.brooks@examplehr.test` | `Manager#2026` |

```bash
npm run storybook
```

```bash
npm run lint
```

```bash
npm run test
```

```bash
npm run test:coverage
```

```bash
npm run build
```
