---
name: examplehr-nextjs-workflow
description: Work safely in this ExampleHR Next.js 16 App Router codebase. Use when editing app routes, route handlers, server/client component boundaries, React Query data flow, loading/error boundaries, layout/page files, or any Next.js-specific behavior in this repository.
---

# ExampleHR Next.js Workflow

## Required First Step

Before changing Next.js APIs or route conventions, read the relevant file under:

`node_modules/next/dist/docs/`

This repository uses Next.js 16, and `AGENTS.md` warns that assumptions from older Next versions may be wrong.

## Project Patterns

- App routes live under `app/`.
- HCM mock API route handlers live under `app/api/hcm/**/route.ts`.
- Client UI components that use hooks must start with `"use client"`.
- React Query is used for server state in interactive client views.
- Route shell states use `loading.tsx`.
- Route error recovery uses `error.tsx`.

## Data Flow Rules

- Server/page entry points should fetch initial data and pass it into client views.
- Client views should use React Query with `initialData` for hydration-friendly state.
- Mutations should update the React Query cache and then fetch authoritative HCM data when correctness matters.
- Do not store HCM balances as purely local UI state if they need server reconciliation.

## Route Handler Rules

For route handlers:

- Validate request body types defensively.
- Return structured HCM errors with status codes.
- Keep parsing close to the route boundary.
- Keep domain mutations in `lib/hcm/mockDb.ts`, not inside UI components.

## Verification

After code changes, prefer:

1. `npm run lint`
2. `npm run test:coverage`
3. `npm run build`
4. `npm run build-storybook` if stories or UI states changed
