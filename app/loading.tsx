export default function Loading() {
  return (
    <main className="relative min-h-screen overflow-hidden text-[color:var(--foreground)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.75),_transparent_34%),radial-gradient(circle_at_85%_10%,_rgba(155,107,63,0.12),_transparent_24%)]" />
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-[var(--shadow)] md:p-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <div className="h-3 w-56 animate-pulse rounded-full bg-[rgba(23,53,47,0.1)]" />
              <div className="h-12 w-full max-w-2xl animate-pulse rounded-[22px] bg-[rgba(23,53,47,0.08)]" />
              <div className="h-4 w-full max-w-xl animate-pulse rounded-full bg-[rgba(23,53,47,0.08)]" />
              <div className="h-4 w-4/5 animate-pulse rounded-full bg-[rgba(23,53,47,0.08)]" />
              <div className="flex gap-3">
                <div className="h-10 w-44 animate-pulse rounded-full bg-[rgba(23,53,47,0.12)]" />
                <div className="h-10 w-56 animate-pulse rounded-full bg-[rgba(23,53,47,0.07)]" />
              </div>
            </div>

            <div className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-5 shadow-[var(--shadow)]">
              <div className="h-3 w-24 animate-pulse rounded-full bg-[rgba(23,53,47,0.1)]" />
              <div className="mt-4 space-y-3">
                <div className="h-4 w-full animate-pulse rounded-full bg-[rgba(23,53,47,0.08)]" />
                <div className="h-4 w-5/6 animate-pulse rounded-full bg-[rgba(23,53,47,0.08)]" />
                <div className="h-4 w-2/3 animate-pulse rounded-full bg-[rgba(23,53,47,0.08)]" />
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="h-20 animate-pulse rounded-2xl border border-[color:var(--border)] bg-[rgba(255,250,242,0.7)]" />
                <div className="h-20 animate-pulse rounded-2xl border border-[color:var(--border)] bg-[rgba(255,250,242,0.7)]" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)_380px]">
          <aside className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow)]">
            <div className="h-3 w-28 animate-pulse rounded-full bg-[rgba(23,53,47,0.1)]" />
            <div className="mt-4 space-y-3">
              <div className="h-20 animate-pulse rounded-2xl border border-[color:var(--border)] bg-[rgba(255,250,242,0.74)]" />
              <div className="h-20 animate-pulse rounded-2xl border border-[color:var(--border)] bg-[rgba(255,250,242,0.74)]" />
              <div className="h-20 animate-pulse rounded-2xl border border-[color:var(--border)] bg-[rgba(255,250,242,0.74)]" />
            </div>
          </aside>

          <section className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="h-40 animate-pulse rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow)]" />
              <div className="h-40 animate-pulse rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow)]" />
              <div className="h-40 animate-pulse rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow)]" />
            </div>

            <section className="overflow-hidden rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow)]">
              <div className="border-b border-[color:var(--border)] px-5 py-4">
                <div className="h-3 w-20 animate-pulse rounded-full bg-[rgba(23,53,47,0.1)]" />
                <div className="mt-3 h-4 w-72 animate-pulse rounded-full bg-[rgba(23,53,47,0.08)]" />
              </div>
              <div className="space-y-4 px-5 py-5">
                <div className="h-20 animate-pulse rounded-2xl border border-[color:var(--border)] bg-[rgba(255,250,242,0.74)]" />
                <div className="h-20 animate-pulse rounded-2xl border border-[color:var(--border)] bg-[rgba(255,250,242,0.74)]" />
              </div>
            </section>
          </section>

          <aside className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-5 shadow-[var(--shadow)]">
            <div className="h-3 w-24 animate-pulse rounded-full bg-[rgba(23,53,47,0.1)]" />
            <div className="mt-4 space-y-4">
              <div className="h-12 animate-pulse rounded-xl border border-[color:var(--border)] bg-[rgba(255,250,242,0.8)]" />
              <div className="h-12 animate-pulse rounded-xl border border-[color:var(--border)] bg-[rgba(255,250,242,0.8)]" />
              <div className="h-12 animate-pulse rounded-xl border border-[color:var(--border)] bg-[rgba(255,250,242,0.8)]" />
              <div className="h-14 animate-pulse rounded-full bg-[rgba(23,53,47,0.12)]" />
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
