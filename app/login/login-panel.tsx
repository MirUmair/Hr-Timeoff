"use client";

import { useState } from "react";

import {
  signInDemoAccount,
  signInWithCredentials,
} from "@/app/login/actions";
import type { AuthRole, DemoLoginAccount } from "@/lib/auth/demoSession";

type CurrentSession = {
  name: string;
  role: AuthRole;
  title: string;
};

type LoginPanelProps = {
  accounts: DemoLoginAccount[];
  currentSession: CurrentSession | null;
  error?: string;
  nextPath: string;
};

type AccountFilter = "all" | AuthRole;

function roleLabel(role: AuthRole): string {
  return role === "manager" ? "Manager" : "Student employee";
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("");
}

function destinationLabel(role: AuthRole): string {
  return role === "manager" ? "Manager approval queue" : "Employee time-off desk";
}

function accountButtonTone(account: DemoLoginAccount, selectedAccount?: DemoLoginAccount) {
  const isSelected = selectedAccount?.accountId === account.accountId;

  if (isSelected) {
    return "border-[color:var(--accent)] bg-[#eef8f6] shadow-[0_14px_32px_-26px_rgba(6,79,82,0.95)]";
  }

  return "border-[color:var(--border)] bg-white/80 hover:border-[color:var(--accent)] hover:bg-white";
}

export function LoginPanel({
  accounts,
  currentSession,
  error,
  nextPath,
}: LoginPanelProps) {
  const defaultAccount = accounts[0];
  const [username, setUsername] = useState(defaultAccount?.username ?? "");
  const [password, setPassword] = useState(defaultAccount?.password ?? "");
  const [showPassword, setShowPassword] = useState(false);
  const [accountFilter, setAccountFilter] = useState<AccountFilter>("all");

  const selectedAccount = accounts.find(
    (account) =>
      account.username.toLowerCase() === username.trim().toLowerCase() &&
      account.password === password,
  );
  const filteredAccounts = accounts.filter((account) => {
    return accountFilter === "all" || account.role === accountFilter;
  });
  const employeeCount = accounts.filter((account) => account.role === "employee").length;
  const managerCount = accounts.filter((account) => account.role === "manager").length;
  const previewAccount = selectedAccount ?? defaultAccount;

  function autofill(account: DemoLoginAccount): void {
    setUsername(account.username);
    setPassword(account.password);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f2ede5] px-4 py-6 text-[color:var(--foreground)] sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_12%,rgba(6,79,82,0.16),transparent_28%),radial-gradient(circle_at_86%_6%,rgba(191,111,54,0.18),transparent_24%),linear-gradient(135deg,rgba(255,255,255,0.64),transparent_38%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[linear-gradient(180deg,rgba(255,255,255,0.8),transparent)]" />

      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-48px)] w-full max-w-7xl overflow-hidden rounded-[34px] border border-[color:var(--border)] bg-white/74 shadow-[0_34px_90px_-58px_rgba(58,41,22,0.62)] backdrop-blur lg:grid-cols-[0.92fr_1.08fr]">
        <aside className="relative overflow-hidden bg-[linear-gradient(150deg,#052c31_0%,#07585d_56%,#0f7379_100%)] p-7 text-white sm:p-9 lg:p-10">
          <div className="pointer-events-none absolute -top-24 right-[-120px] h-72 w-72 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute bottom-[-130px] left-[-80px] h-80 w-80 rounded-full bg-[#d99b63]/20 blur-3xl" />

          <div className="relative flex min-h-full flex-col">
            <div className="flex items-center gap-4">
              <div className="grid size-12 place-items-center rounded-2xl bg-white text-base font-black text-[#07585d] shadow-[0_18px_34px_-24px_rgba(0,0,0,0.7)]">
                TO
              </div>
              <div>
                <p className="text-sm font-black tracking-tight">ExampleHR</p>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/58">
                  Time off access
                </p>
              </div>
            </div>

            <div className="mt-16 max-w-xl">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-[#f1c598]">
                Secure workspace
              </p>
              <h1 className="font-display mt-4 text-5xl font-bold leading-[0.96] tracking-tight sm:text-6xl">
                Sign in to the control desk.
              </h1>
              <p className="mt-5 text-base leading-7 text-white/74">
                Demo credentials behave like a real session boundary: student employees only see
                their own balance cells, while the manager opens the approval queue.
              </p>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/14 bg-white/10 p-4 backdrop-blur">
                <p className="text-3xl font-black">{employeeCount}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-white/58">
                  Students
                </p>
              </div>
              <div className="rounded-2xl border border-white/14 bg-white/10 p-4 backdrop-blur">
                <p className="text-3xl font-black">{managerCount}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-white/58">
                  Manager
                </p>
              </div>
              <div className="rounded-2xl border border-white/14 bg-white/10 p-4 backdrop-blur">
                <p className="text-3xl font-black">HCM</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-white/58">
                  Source
                </p>
              </div>
            </div>

            {previewAccount ? (
              <div className="mt-auto pt-10">
                <div className="rounded-[28px] border border-white/16 bg-white/12 p-5 shadow-[0_24px_60px_-42px_rgba(0,0,0,0.8)] backdrop-blur">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f1c598]">
                    Selected profile
                  </p>
                  <div className="mt-4 flex items-start gap-4">
                    <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white text-base font-black text-[#07585d]">
                      {initials(previewAccount.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xl font-black">{previewAccount.name}</p>
                      <p className="mt-1 text-sm text-white/70">
                        {roleLabel(previewAccount.role)} - {previewAccount.location}
                      </p>
                      <p className="mt-3 rounded-full border border-white/16 bg-black/10 px-3 py-1 text-xs font-bold text-white/78">
                        Opens: {destinationLabel(previewAccount.role)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </aside>

        <section className="grid content-center gap-6 p-5 sm:p-8 lg:p-10">
          <div className="mx-auto w-full max-w-xl">
            <div className="rounded-[30px] border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-6 shadow-[var(--shadow)] sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-[color:var(--accent-warm)]">
                    Employee portal
                  </p>
                  <h2 className="font-display mt-3 text-4xl font-bold tracking-tight">
                    Welcome back
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                    Enter your assigned demo credentials to continue.
                  </p>
                </div>
                <span className="rounded-full border border-[color:var(--border)] bg-white px-3 py-1 text-xs font-black text-[color:var(--accent)]">
                  Demo auth
                </span>
              </div>

              {error ? (
                <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">
                  Those credentials do not match a demo account. Use the account switcher below
                  to fill a valid username and password.
                </p>
              ) : null}

              {currentSession ? (
                <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-[color:var(--border)] bg-white p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-black">
                      Signed in as {currentSession.name}
                    </p>
                    <p className="mt-1 text-[color:var(--muted)]">
                      {currentSession.title} - {roleLabel(currentSession.role)}
                    </p>
                  </div>
                  <form action="/logout" method="post">
                    <button
                      type="submit"
                      className="rounded-xl border border-[color:var(--border)] bg-white px-4 py-2 text-sm font-black transition hover:border-[color:var(--accent)]"
                    >
                      Sign out
                    </button>
                  </form>
                </div>
              ) : null}

              <form action={signInWithCredentials} className="mt-7 grid gap-5">
                <input type="hidden" name="next" value={nextPath} />
                <label className="grid gap-2 text-sm font-black">
                  Email address
                  <input
                    name="username"
                    type="email"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className="h-[52px] rounded-2xl border border-[color:var(--border)] bg-white px-4 text-sm font-bold outline-none transition placeholder:text-[color:var(--muted)] focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[rgba(18,126,143,0.14)]"
                    autoComplete="username"
                    placeholder="name@examplehr.test"
                    required
                  />
                </label>

                <label className="grid gap-2 text-sm font-black">
                  Password
                  <span className="relative block">
                    <input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="h-[52px] w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 pr-24 text-sm font-bold outline-none transition placeholder:text-[color:var(--muted)] focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[rgba(18,126,143,0.14)]"
                      autoComplete="current-password"
                      placeholder="Enter password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute inset-y-1.5 right-1.5 rounded-xl border border-[color:var(--border)] bg-[#f8f5ef] px-3 text-xs font-black text-[color:var(--accent)] transition hover:bg-white"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </span>
                </label>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex items-center gap-2 text-sm font-bold text-[color:var(--muted)]">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-[color:var(--border)] accent-[color:var(--accent)]"
                    />
                    Remember this device
                  </label>
                  <span className="text-sm font-bold text-[color:var(--accent)]">
                    Session expires in 8 hours
                  </span>
                </div>

                <button
                  type="submit"
                  className="rounded-2xl bg-[linear-gradient(135deg,#064f52,#108894)] px-5 py-3.5 text-sm font-black text-white shadow-[0_20px_38px_-25px_rgba(6,79,82,0.9)] transition hover:-translate-y-0.5 hover:shadow-[0_26px_42px_-26px_rgba(6,79,82,0.95)]"
                >
                  {selectedAccount
                    ? `Continue as ${selectedAccount.name}`
                    : "Continue to workspace"}
                </button>
              </form>

              <div className="mt-5 rounded-2xl border border-[color:var(--border)] bg-[#f8f5ef] p-4 text-sm leading-6 text-[color:var(--muted)]">
                <span className="font-black text-[color:var(--foreground)]">Security note:</span>{" "}
                this demo validates credentials on the server and stores only an httpOnly
                session cookie. Passwords are visible here only so reviewers can test fast.
              </div>
            </div>

            <div className="mt-5 rounded-[26px] border border-[color:var(--border)] bg-white/88 p-4 shadow-[var(--shadow-soft)] backdrop-blur">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-[color:var(--accent-warm)]">
                    Demo account switcher
                  </p>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">
                    Auto-fill a profile, then use the same sign-in form above.
                  </p>
                </div>
                <div className="grid grid-cols-3 rounded-2xl border border-[color:var(--border)] bg-[#f8f5ef] p-1 text-xs font-black">
                  {(["all", "employee", "manager"] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setAccountFilter(filter)}
                      className={`rounded-xl px-3 py-2 transition ${
                        accountFilter === filter
                          ? "bg-white text-[color:var(--accent)] shadow-sm"
                          : "text-[color:var(--muted)]"
                      }`}
                    >
                      {filter === "all" ? "All" : filter === "employee" ? "Students" : "Manager"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                {filteredAccounts.map((account) => (
                  <article
                    key={account.accountId}
                    className={`grid gap-3 rounded-2xl border p-3 transition sm:grid-cols-[1fr_auto] sm:items-center ${accountButtonTone(
                      account,
                      selectedAccount,
                    )}`}
                  >
                    <button
                      type="button"
                      onClick={() => autofill(account)}
                      className="flex min-w-0 items-center gap-3 text-left"
                    >
                      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[color:var(--accent)] text-sm font-black text-white">
                        {initials(account.name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-black">
                          {account.name}
                        </span>
                        <span className="mt-1 block truncate text-xs font-bold text-[color:var(--muted)]">
                          {account.username} - {account.password}
                        </span>
                      </span>
                    </button>

                    <div className="grid grid-cols-2 gap-2 sm:w-[176px]">
                      <button
                        type="button"
                        onClick={() => autofill(account)}
                        className="rounded-xl border border-[color:var(--border)] bg-white px-3 py-2 text-xs font-black text-[color:var(--foreground)] transition hover:border-[color:var(--accent)]"
                      >
                        Auto-fill
                      </button>
                      <form action={signInDemoAccount}>
                        <input type="hidden" name="accountId" value={account.accountId} />
                        <input type="hidden" name="next" value={nextPath} />
                        <button
                          type="submit"
                          className="w-full rounded-xl bg-[color:var(--foreground)] px-3 py-2 text-xs font-black text-white transition hover:-translate-y-0.5"
                        >
                          Quick
                        </button>
                      </form>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
