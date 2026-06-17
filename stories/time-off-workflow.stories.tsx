import type { Meta, StoryObj } from "@storybook/nextjs";

const stateTiles = [
  {
    title: "Optimistic submission",
    label: "employee",
    copy: "Request appears immediately and is marked as verifying against HCM.",
    tone: "border-cyan-200 bg-cyan-50 text-cyan-900",
  },
  {
    title: "Validation error",
    label: "employee",
    copy: "The form keeps user input visible while surfacing the failed field inline.",
    tone: "border-rose-200 bg-rose-50 text-rose-900",
  },
  {
    title: "Rolled back",
    label: "employee",
    copy: "The optimistic row disappears after an authoritative rejection.",
    tone: "border-amber-200 bg-amber-50 text-amber-900",
  },
  {
    title: "Stale balance",
    label: "manager",
    copy: "The queue is blocked until the per-cell HCM balance is refreshed.",
    tone: "border-yellow-200 bg-yellow-50 text-yellow-900",
  },
  {
    title: "Silent wrong mutation",
    label: "employee",
    copy: "The server acknowledges the write, but the authoritative read disagrees.",
    tone: "border-red-200 bg-red-50 text-red-900",
  },
  {
    title: "Manager denial",
    label: "manager",
    copy: "A denied request releases pending hours back to the employee balance.",
    tone: "border-slate-200 bg-slate-50 text-slate-900",
  },
  {
    title: "Loading skeleton",
    label: "route",
    copy: "Route shell and content placeholders preserve the shape of the final screen.",
    tone: "border-stone-200 bg-stone-50 text-stone-900",
  },
  {
    title: "Offline failure",
    label: "backend",
    copy: "A retry-friendly surface explains the HCM connection problem without losing the draft.",
    tone: "border-neutral-200 bg-neutral-50 text-neutral-900",
  },
] as const;

const requestRows = [
  {
    id: "tor-0001",
    status: "pending",
    copy: "School break coverage - 8 hours",
    tone: "bg-cyan-50 text-cyan-900 border-cyan-200",
  },
  {
    id: "tor-0002",
    status: "error",
    copy: "Vacation overlap detected - user can retry",
    tone: "bg-rose-50 text-rose-900 border-rose-200",
  },
  {
    id: "tor-0003",
    status: "conflict",
    copy: "Version drift detected - refresh required",
    tone: "bg-red-50 text-red-900 border-red-200",
  },
  {
    id: "tor-0004",
    status: "rejected",
    copy: "Pending balance released after manager denial",
    tone: "bg-slate-50 text-slate-900 border-slate-200",
  },
] as const;

const meta = {
  title: "Time Off/Workflow States",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

function StateBoard() {
  return (
    <main className="relative min-h-screen overflow-hidden text-[color:var(--foreground)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.7),_transparent_36%),radial-gradient(circle_at_85%_10%,_rgba(155,107,63,0.14),_transparent_24%)]" />
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-[var(--shadow)] md:p-8">
          <p className="font-mono-ui text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--accent-warm)]">
            Storybook proof sheet
          </p>
          <h1 className="font-display mt-3 text-4xl font-semibold tracking-tight text-[color:var(--accent)]">
            Time off workflow states
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-[color:var(--muted)] sm:text-base">
            These snapshots document the employee and manager states the TRD calls out:
            optimistic submission, validation failure, rollback, stale balance,
            denied requests, loading shells, and backend failure recovery.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stateTiles.map((tile) => (
            <article
              key={tile.title}
              className={`rounded-[24px] border p-5 shadow-[var(--shadow)] ${tile.tone}`}
            >
              <p className="font-mono-ui text-[10px] font-semibold uppercase tracking-[0.24em] opacity-70">
                {tile.label}
              </p>
              <h2 className="mt-3 text-xl font-semibold tracking-tight">{tile.title}</h2>
              <p className="mt-3 text-sm leading-6 opacity-90">{tile.copy}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
          <article className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow)]">
            <div className="flex items-center justify-between gap-3 border-b border-[color:var(--border)] pb-4">
              <div>
                <p className="font-mono-ui text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                  Request list
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[color:var(--accent)]">
                  Loaded, pending, conflicted, and denied rows
                </h2>
              </div>
              <span className="rounded-full border border-[color:var(--border)] bg-[rgba(255,255,255,0.6)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--accent-warm)]">
                Visual fixture
              </span>
            </div>

            <div className="divide-y divide-[color:var(--border)]/70">
              {requestRows.map((row) => (
                <div
                  key={row.id}
                  className="grid gap-3 px-1 py-4 text-sm md:grid-cols-[minmax(0,1fr)_120px_170px] md:items-center"
                >
                  <div>
                    <p className="font-semibold text-[color:var(--accent)]">{row.id}</p>
                    <p className="mt-1 text-[color:var(--muted)]">{row.copy}</p>
                  </div>
                  <span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${row.tone}`}>
                    {row.status}
                  </span>
                  <p className="text-[color:var(--muted)]">
                    User input stays visible during retry or recovery.
                  </p>
                </div>
              ))}
            </div>
          </article>

          <aside className="space-y-6">
            <article className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-5 shadow-[var(--shadow)]">
              <p className="font-mono-ui text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                Request detail
              </p>
              <div className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[rgba(255,250,242,0.82)] p-4">
                <p className="text-sm font-semibold text-[color:var(--accent)]">
                  Maya Chen - Vacation - 8 hours
                </p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                  Per-cell HCM verification is shown before approval, and the refreshed
                  balance version is called out when the queue becomes stale.
                </p>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-[color:var(--border)] bg-[rgba(255,250,242,0.8)] p-3">
                  <span className="block text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
                    Available
                  </span>
                  <strong className="mt-1 block text-2xl text-[color:var(--accent)]">72</strong>
                </div>
                <div className="rounded-2xl border border-[color:var(--border)] bg-[rgba(255,250,242,0.8)] p-3">
                  <span className="block text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
                    Pending
                  </span>
                  <strong className="mt-1 block text-2xl text-[color:var(--accent)]">8</strong>
                </div>
                <div className="rounded-2xl border border-[color:var(--border)] bg-[rgba(255,250,242,0.8)] p-3">
                  <span className="block text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
                    Version
                  </span>
                  <strong className="mt-1 block text-2xl text-[color:var(--accent)]">v2</strong>
                </div>
              </div>
            </article>

            <article className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow)]">
              <p className="font-mono-ui text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                Creation form
              </p>
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-[color:var(--border)] bg-[rgba(255,250,242,0.82)] px-4 py-3 text-sm text-[color:var(--muted)]">
                  Validation error keeps the reason and date fields intact.
                </div>
                <div className="rounded-xl border border-[color:var(--border)] bg-[rgba(255,250,242,0.82)] px-4 py-3 text-sm text-[color:var(--muted)]">
                  Optimistic submit shows a verifying badge before the authoritative read.
                </div>
                <div className="rounded-xl border border-[color:var(--border)] bg-[rgba(255,250,242,0.82)] px-4 py-3 text-sm text-[color:var(--muted)]">
                  Offline states keep the draft visible so the user can retry without retyping.
                </div>
              </div>
            </article>
          </aside>
        </section>
      </section>
    </main>
  );
}

export const Board: Story = {
  render: () => <StateBoard />,
};
