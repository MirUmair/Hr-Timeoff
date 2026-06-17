import type { DemoSession } from "@/lib/auth/demoSession";

type AuthBadgeProps = {
  session: DemoSession;
};

export function AuthBadge({ session }: AuthBadgeProps) {
  return (
    <div className="fixed top-4 right-4 z-40 flex items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-white/90 px-4 py-3 text-sm shadow-[var(--shadow-soft)] backdrop-blur">
      <div>
        <p className="font-bold">{session.name}</p>
        <p className="text-xs capitalize text-[color:var(--muted)]">{session.role} session</p>
      </div>
      <form action="/logout" method="post">
        <button
          type="submit"
          className="rounded-xl bg-[color:var(--accent)] px-3 py-2 text-xs font-bold text-white transition hover:-translate-y-0.5"
        >
          Logout
        </button>
      </form>
    </div>
  );
}
