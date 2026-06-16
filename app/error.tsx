"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-[color:var(--background)] px-4 py-10 text-[color:var(--foreground)] sm:px-6 lg:px-8">
      <section className="mx-auto grid min-h-[70vh] w-full max-w-3xl place-items-center">
        <div className="w-full rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-[var(--shadow)] md:p-8">
          <p className="font-mono-ui text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--accent-warm)]">
            HCM connection interrupted
          </p>
          <h1 className="font-display mt-3 text-4xl font-semibold tracking-tight text-[color:var(--accent)]">
            We could not load the time-off workspace.
          </h1>
          <p className="mt-4 text-sm leading-6 text-[color:var(--muted)]">
            The last request did not complete cleanly. Retry will reload the route and ask HCM for a fresh balance snapshot.
          </p>
          <p className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[rgba(255,250,242,0.82)] px-4 py-3 text-sm text-[color:var(--foreground)]">
            {error.message || "Unexpected route failure."}
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 inline-flex items-center justify-center rounded-full bg-[linear-gradient(135deg,#17352f,#213e38)] px-5 py-3 text-sm font-semibold text-[#f8f3e8] shadow-[0_14px_24px_-18px_rgba(23,53,47,0.85)] transition hover:-translate-y-0.5"
          >
            Retry workspace
          </button>
        </div>
      </section>
    </main>
  );
}
