export default function Loading() {
  return (
    <main className="relative min-h-screen overflow-hidden text-[color:var(--foreground)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.72),_transparent_32%),radial-gradient(circle_at_10%_15%,_rgba(23,53,47,0.08),_transparent_25%)]" />
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-[var(--shadow)] md:p-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <div className="h-3 w-52 animate-pulse rounded-full bg-[rgba(23,53,47,0.1)]" />
              <div className="h-12 w-full max-w-2xl animate-pulse rounded-[22px] bg-[rgba(23,53,47,0.08)]" />
              <div className="h-4 w-full max-w-xl animate-pulse rounded-full bg-[rgba(23,53,47,0.08)]" />
              <div className="h-4 w-4/5 animate-pulse rounded-full bg-[rgba(23,53,47,0.08)]" />
              <div className="h-10 w-40 animate-pulse rounded-full bg-[rgba(23,53,47,0.12)]" />
            </div>

            <div className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-5 shadow-[var(--shadow)]">
              <div className="h-3 w-24 animate-pulse rounded-full bg-[rgba(23,53,47,0.1)]" />
              <div className="mt-4 space-y-3">
                <div className="h-4 w-full animate-pulse rounded-full bg-[rgba(23,53,47,0.08)]" />
                <div className="h-4 w-5/6 animate-pulse rounded-full bg-[rgba(23,53,47,0.08)]" />
              </div>
              <div className="mt-6 h-16 animate-pulse rounded-2xl border border-[color:var(--border)] bg-[rgba(255,250,242,0.72)]" />
            </div>
          </div>
        </div>

        <section className="space-y-4">
          <div className="h-4 w-44 animate-pulse rounded-full bg-[rgba(23,53,47,0.1)]" />
          <div className="grid gap-5">
            <div className="grid gap-5 rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow)] lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-4">
                <div className="h-3 w-32 animate-pulse rounded-full bg-[rgba(23,53,47,0.1)]" />
                <div className="h-8 w-64 animate-pulse rounded-full bg-[rgba(23,53,47,0.08)]" />
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="h-28 animate-pulse rounded-2xl border border-[color:var(--border)] bg-[rgba(255,250,242,0.76)]" />
                  <div className="h-28 animate-pulse rounded-2xl border border-[color:var(--border)] bg-[rgba(255,250,242,0.76)]" />
                  <div className="h-28 animate-pulse rounded-2xl border border-[color:var(--border)] bg-[rgba(255,250,242,0.76)]" />
                </div>
                <div className="h-14 animate-pulse rounded-2xl border border-[color:var(--border)] bg-[rgba(255,250,242,0.76)]" />
              </div>
              <div className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-4">
                <div className="h-10 animate-pulse rounded-full bg-[rgba(23,53,47,0.12)]" />
                <div className="mt-3 h-12 animate-pulse rounded-full bg-[rgba(23,53,47,0.08)]" />
                <div className="mt-4 h-10 animate-pulse rounded-full bg-[rgba(23,53,47,0.12)]" />
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
