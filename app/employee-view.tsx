"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import Link from "next/link";
import { startTransition, useState } from "react";

import {
  createTimeOffRequest,
  fetchBalance,
  fetchBalances,
  fetchTimeOffRequests,
  HcmClientError,
} from "@/lib/hcm/hcmClient";
import { queryKeys } from "@/lib/query/queryKeys";
import type {
  BalanceCell,
  BalanceCellKey,
  BatchBalancesResponse,
  EmployeeId,
  LeaveType,
} from "@/lib/types/balance";
import type {
  TimeOffMutationScenario,
  TimeOffRequest,
  TimeOffRequestsResponse,
} from "@/lib/types/request";

type FreshnessStatus =
  | "fresh"
  | "stale"
  | "refreshing"
  | "verifying"
  | "optimisticPending"
  | "rejected"
  | "conflicted";

type RequestForm = {
  employeeId: EmployeeId;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  requestedAmount: string;
  reason: string;
  scenario: TimeOffMutationScenario;
};

type EmployeeViewProps = {
  employeeIds: EmployeeId[];
  initialBalances: BatchBalancesResponse;
  initialRequests: TimeOffRequestsResponse;
};

type EmployeeSummary = {
  employeeId: EmployeeId;
  employeeName: string;
  locationName: string;
};

const leaveTypes = ["vacation", "sick", "personal"] as const satisfies ReadonlyArray<LeaveType>;

const statusCopy: Record<FreshnessStatus, string> = {
  fresh: "fresh",
  stale: "stale",
  refreshing: "refreshing",
  verifying: "verifying",
  optimisticPending: "optimisticPending",
  rejected: "rejected",
  conflicted: "conflicted",
};

const statusClass: Record<FreshnessStatus, string> = {
  fresh: "border-emerald-200 bg-emerald-50 text-emerald-800",
  stale: "border-amber-200 bg-amber-50 text-amber-800",
  refreshing: "border-sky-200 bg-sky-50 text-sky-800",
  verifying: "border-blue-200 bg-blue-50 text-blue-800",
  optimisticPending: "border-cyan-200 bg-cyan-50 text-cyan-900",
  rejected: "border-rose-200 bg-rose-50 text-rose-800",
  conflicted: "border-red-300 bg-red-50 text-red-900",
};

function balanceKey(employeeId: EmployeeId, leaveType: LeaveType): BalanceCellKey {
  return `${employeeId}:${leaveType}`;
}

function formatLeaveType(leaveType: LeaveType): string {
  return leaveType[0].toUpperCase() + leaveType.slice(1);
}

function getEmployees(balances: BalanceCell[]): EmployeeSummary[] {
  const employees = new Map<EmployeeId, EmployeeSummary>();

  for (const balance of balances) {
    if (!employees.has(balance.employeeId)) {
      employees.set(balance.employeeId, {
        employeeId: balance.employeeId,
        employeeName: balance.employeeName,
        locationName: balance.locationName,
      });
    }
  }

  return Array.from(employees.values());
}

function updateBalance(
  response: BatchBalancesResponse,
  employeeId: EmployeeId,
  leaveType: LeaveType,
  updater: (balance: BalanceCell) => BalanceCell,
): BatchBalancesResponse {
  return {
    ...response,
    balances: response.balances.map((balance) => {
      if (balance.employeeId === employeeId && balance.leaveType === leaveType) {
        return updater(balance);
      }

      return balance;
    }),
  };
}

function replaceBalance(
  response: BatchBalancesResponse,
  authoritative: BalanceCell,
): BatchBalancesResponse {
  return updateBalance(
    response,
    authoritative.employeeId,
    authoritative.leaveType,
    () => authoritative,
  );
}

function appendOrReplaceRequest(
  response: TimeOffRequestsResponse,
  request: TimeOffRequest,
  tempId?: string,
): TimeOffRequestsResponse {
  const withoutExisting = response.requests.filter(
    (item) => item.id !== request.id && item.id !== tempId,
  );

  return {
    ...response,
    requests: [request, ...withoutExisting],
  };
}

function hasReconciliationConflict(
  optimistic: BalanceCell,
  authoritative: BalanceCell,
): boolean {
  return (
    optimistic.available !== authoritative.available ||
    optimistic.pending !== authoritative.pending ||
    optimistic.used !== authoritative.used
  );
}

function buildTempRequest(form: RequestForm, amount: number): TimeOffRequest {
  const timestamp = new Date().toISOString();

  return {
    id: `optimistic-${crypto.randomUUID()}`,
    employeeId: form.employeeId,
    leaveType: form.leaveType,
    startDate: form.startDate,
    endDate: form.endDate,
    requestedAmount: amount,
    status: "pending",
    reason: form.reason,
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 0,
    clientMutationId: crypto.randomUUID(),
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof HcmClientError) {
    return error.payload.error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "The HCM request failed.";
}

function getCellStatus(
  cellStatus: Partial<Record<BalanceCellKey, FreshnessStatus>>,
  key: BalanceCellKey,
  isFetching: boolean,
  isStale: boolean,
): FreshnessStatus {
  const explicitStatus = cellStatus[key];

  if (explicitStatus) {
    return explicitStatus;
  }

  if (isFetching) {
    return "refreshing";
  }

  if (isStale) {
    return "stale";
  }

  return "fresh";
}

export function EmployeeView({
  employeeIds,
  initialBalances,
  initialRequests,
}: EmployeeViewProps) {
  const shell = "mx-auto w-full max-w-[1480px] px-4 py-7 sm:px-6 lg:px-8";
  const surface =
    "rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow)] ring-1 ring-white/70 backdrop-blur";
  const surfaceSoft =
    "rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] shadow-[var(--shadow-soft)] ring-1 ring-white/80";
  const fieldClass =
    "w-full rounded-xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm text-[color:var(--foreground)] outline-none transition placeholder:text-[color:var(--muted)] focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[rgba(30,138,154,0.14)]";
  const labelClass = "grid gap-2 text-sm font-medium text-[color:var(--foreground)]";

  const queryClient = useQueryClient();
  const [activeEmployeeId, setActiveEmployeeId] = useState<EmployeeId>(
    employeeIds[0] ?? "emp-1001",
  );
  const [cellStatus, setCellStatus] = useState<
    Partial<Record<BalanceCellKey, FreshnessStatus>>
  >({});
  const [notice, setNotice] = useState("Balances loaded from HCM.");
  const [form, setForm] = useState<RequestForm>({
    employeeId: employeeIds[0] ?? "emp-1001",
    leaveType: "vacation",
    startDate: "2026-07-06",
    endDate: "2026-07-08",
    requestedAmount: "16",
    reason: "Family travel",
    scenario: "normal",
  });

  const balancesQuery = useQuery({
    queryKey: queryKeys.balances(employeeIds),
    queryFn: () => fetchBalances({ employeeIds }),
    initialData: initialBalances,
  });
  const requestsQuery = useQuery({
    queryKey: queryKeys.timeOffRequests(),
    queryFn: () => fetchTimeOffRequests(),
    initialData: initialRequests,
  });
  const mutation = useMutation({
    mutationFn: createTimeOffRequest,
  });

  const balances = balancesQuery.data.balances;
  const requests = requestsQuery.data.requests;
  const employees = getEmployees(balances);
  const visibleBalances = balances.filter(
    (balance) => balance.employeeId === activeEmployeeId,
  );
  const selectedEmployee = employees.find(
    (employee) => employee.employeeId === activeEmployeeId,
  );
  const activeRequests = requests.filter(
    (request) => request.employeeId === activeEmployeeId,
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const amount = Number(form.requestedAmount);
    const key = balanceKey(form.employeeId, form.leaveType);
    const currentBalance = balances.find(
      (balance) =>
        balance.employeeId === form.employeeId && balance.leaveType === form.leaveType,
    );

    if (!currentBalance || !Number.isFinite(amount) || amount <= 0) {
      setNotice("Request rejected before submit. Check the selected balance and hours.");
      setCellStatus((current) => ({ ...current, [key]: "rejected" }));
      return;
    }

    const previousBalances = balancesQuery.data;
    const previousRequests = requestsQuery.data;
    const optimisticRequest = buildTempRequest(form, amount);
    const optimisticBalance: BalanceCell = {
      ...currentBalance,
      available: currentBalance.available - amount,
      pending: currentBalance.pending + amount,
      version: currentBalance.version + 1,
      lastCalculatedAt: new Date().toISOString(),
    };

    setNotice("Request submitted. Verifying with HCM...");
    setCellStatus((current) => ({ ...current, [key]: "optimisticPending" }));

    queryClient.setQueryData<BatchBalancesResponse>(
      queryKeys.balances(employeeIds),
      updateBalance(previousBalances, form.employeeId, form.leaveType, () => optimisticBalance),
    );
    queryClient.setQueryData<TimeOffRequestsResponse>(
      queryKeys.timeOffRequests(),
      appendOrReplaceRequest(previousRequests, optimisticRequest),
    );

    try {
      const response = await mutation.mutateAsync({
        employeeId: form.employeeId,
        leaveType: form.leaveType,
        startDate: form.startDate,
        endDate: form.endDate,
        requestedAmount: amount,
        reason: form.reason,
        expectedBalanceVersion: currentBalance.version,
        clientMutationId: optimisticRequest.clientMutationId ?? undefined,
        scenario: form.scenario,
      });

      startTransition(() => {
        setCellStatus((current) => ({ ...current, [key]: "verifying" }));
        queryClient.setQueryData<TimeOffRequestsResponse>(
          queryKeys.timeOffRequests(),
          appendOrReplaceRequest(previousRequests, response.request, optimisticRequest.id),
        );
      });

      const authoritative = await fetchBalance(form.employeeId, form.leaveType);

      queryClient.setQueryData<BatchBalancesResponse>(
        queryKeys.balances(employeeIds),
        replaceBalance(previousBalances, authoritative.balance),
      );

      if (hasReconciliationConflict(optimisticBalance, authoritative.balance)) {
        setCellStatus((current) => ({ ...current, [key]: "conflicted" }));
        setNotice(
          "Conflict detected. HCM accepted the request, but the authoritative balance did not match the optimistic mutation.",
        );
        return;
      }

      setCellStatus((current) => ({ ...current, [key]: "fresh" }));
      setNotice("Request submitted. Verifying with HCM... Complete.");
    } catch (error) {
      queryClient.setQueryData(queryKeys.balances(employeeIds), previousBalances);
      queryClient.setQueryData(queryKeys.timeOffRequests(), previousRequests);
      const failedStatus =
        error instanceof HcmClientError && error.payload.error.code === "CONFLICT"
          ? "conflicted"
          : "rejected";

      setCellStatus((current) => ({ ...current, [key]: failedStatus }));
      setNotice(`Request rejected. ${getErrorMessage(error)}`);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden text-[color:var(--foreground)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.9),_transparent_32%),radial-gradient(circle_at_88%_6%,_rgba(30,138,154,0.14),_transparent_24%)]" />
      <section className={shell + " relative z-10 space-y-6"}>
        <header className={`${surface} relative overflow-hidden p-5 md:p-7`}>
          <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--accent),#1e8a9a,var(--accent-warm))]" />
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="font-mono-ui text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--accent-warm)]">
                ExampleHR employee workspace
              </p>
              <h1 className="font-display mt-3 text-4xl leading-[0.98] font-semibold tracking-tight text-[color:var(--foreground)] sm:text-5xl">
                Time off control desk
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-[color:var(--muted)] sm:text-base">
                Review balances, submit requests, and keep every change in sync with the authoritative HCM record.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/manager"
                  className="inline-flex items-center justify-center rounded-xl bg-[color:var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_26px_-18px_rgba(11,74,95,0.85)] transition hover:-translate-y-0.5 hover:bg-[#083849]"
                >
                  Open manager queue
                </Link>
                <div className="inline-flex items-center rounded-xl border border-[color:var(--border)] bg-white/70 px-4 py-2.5 text-sm text-[color:var(--muted)]">
                  Live verification and rollback safeguards
                </div>
              </div>
            </div>
            <div className="min-w-[280px] rounded-3xl bg-[color:var(--accent)] p-5 text-white shadow-[0_24px_48px_-32px_rgba(11,74,95,0.75)]">
              <p className="font-mono-ui text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
                HCM status
              </p>
              <p className="mt-3 text-sm leading-6 text-white/90">
                {notice}
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl border border-white/15 bg-white/10 p-3">
                  <span className="block text-xs uppercase tracking-[0.18em] text-cyan-100">
                    Mode
                  </span>
                  <strong className="mt-1 block">Optimistic</strong>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 p-3">
                  <span className="block text-xs uppercase tracking-[0.18em] text-cyan-100">
                    Source
                  </span>
                  <strong className="mt-1 block">Authoritative HCM</strong>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)_360px]">
          <aside className={`${surface} p-3 lg:sticky lg:top-6 lg:self-start`}>
            <div className="flex items-center justify-between px-1 pb-3">
              <h2 className="font-mono-ui text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                Employee / location
              </h2>
              <span className="rounded-lg border border-[color:var(--border)] bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--accent-warm)]">
                {employees.length} people
              </span>
            </div>
            <div className="space-y-2">
              {employees.map((employee) => (
                <button
                  key={employee.employeeId}
                  type="button"
                  onClick={() => {
                    setActiveEmployeeId(employee.employeeId);
                    setForm((current) => ({
                      ...current,
                      employeeId: employee.employeeId,
                    }));
                  }}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition duration-200 hover:-translate-y-0.5 ${
                    activeEmployeeId === employee.employeeId
                      ? "border-[color:var(--accent)] bg-[linear-gradient(135deg,#0b4a5f,#16798a)] text-white shadow-[0_18px_36px_-26px_rgba(11,74,95,0.9)]"
                      : "border-[color:var(--border)] bg-white text-[color:var(--foreground)] hover:border-[color:var(--border-strong)] hover:bg-[#f7fbfd]"
                  }`}
                >
                  <span className="block text-sm font-semibold">
                    {employee.employeeName}
                  </span>
                  <span className="mt-1 block text-xs text-current/70">
                    {employee.locationName} - {employee.employeeId}
                  </span>
                </button>
              ))}
            </div>
          </aside>

          <section className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              {visibleBalances.map((balance) => {
                const key = balanceKey(balance.employeeId, balance.leaveType);
                const status = getCellStatus(
                  cellStatus,
                  key,
                  balancesQuery.isFetching,
                  balancesQuery.isStale,
                );

                return (
                  <article
                    key={key}
                    className={`${surface} p-5 transition duration-200 hover:-translate-y-0.5 hover:border-[color:var(--border-strong)] hover:shadow-[var(--shadow-soft)]`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-mono-ui text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                          {formatLeaveType(balance.leaveType)}
                        </h2>
                        <p className="mt-4 text-4xl font-semibold tracking-tight text-[color:var(--accent)]">
                          {balance.available}
                          <span className="ml-2 align-middle text-sm font-medium text-[color:var(--muted)]">
                            {balance.unit}
                          </span>
                        </p>
                      </div>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusClass[status]}`}
                      >
                        {statusCopy[status]}
                      </span>
                    </div>
                    <dl className="mt-6 grid grid-cols-3 gap-2 text-sm">
                      <div className="rounded-2xl border border-[color:var(--border)] bg-[#f6fbfd] p-3">
                        <dt className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
                          Pending
                        </dt>
                        <dd className="mt-1 text-base font-semibold">
                          {balance.pending}
                        </dd>
                      </div>
                      <div className="rounded-2xl border border-[color:var(--border)] bg-[#f6fbfd] p-3">
                        <dt className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
                          Used
                        </dt>
                        <dd className="mt-1 text-base font-semibold">
                          {balance.used}
                        </dd>
                      </div>
                      <div className="rounded-2xl border border-[color:var(--border)] bg-[#f6fbfd] p-3">
                        <dt className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
                          Version
                        </dt>
                        <dd className="mt-1 text-base font-semibold">v{balance.version}</dd>
                      </div>
                    </dl>
                  </article>
                );
              })}
            </div>

            <section className={`${surface} overflow-hidden`}>
              <div className="flex items-center justify-between border-b border-[color:var(--border)] px-5 py-4">
                <div>
                  <h2 className="font-mono-ui text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                    Requests
                  </h2>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">
                    Live request history for {selectedEmployee?.employeeName ?? activeEmployeeId}
                  </p>
                </div>
                <span className="rounded-lg border border-[color:var(--border)] bg-white px-3 py-1 text-sm font-medium text-[color:var(--foreground)]">
                  {activeRequests.length} open
                </span>
              </div>
              <div className="divide-y divide-[color:var(--border)]/70">
                {activeRequests.length === 0 ? (
                  <p className="px-5 py-10 text-sm text-[color:var(--muted)]">
                    No requests for this employee yet.
                  </p>
                ) : (
                  activeRequests.map((request) => (
                    <div
                      key={request.id}
                      className="grid gap-4 px-5 py-4 text-sm md:grid-cols-[minmax(0,1fr)_140px_80px] md:items-center"
                    >
                      <div>
                        <p className="font-semibold text-[color:var(--accent)]">
                          {formatLeaveType(request.leaveType)} request
                          <span className="mx-2 text-[color:var(--muted)]">-</span>
                          {request.requestedAmount} hours
                        </p>
                        <p className="mt-1 text-[color:var(--muted)]">
                          {request.startDate} to {request.endDate} - {request.reason}
                        </p>
                      </div>
                      <p className="inline-flex w-fit rounded-lg border border-[color:var(--border)] bg-[#f6fbfd] px-3 py-1 text-sm font-medium capitalize">
                        {request.status}
                      </p>
                      <p className="font-mono-ui text-sm text-[color:var(--muted)] md:text-right">
                        v{request.version}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </section>

          <form
            onSubmit={handleSubmit}
            className={`${surfaceSoft} self-start p-5 lg:col-span-2 xl:sticky xl:top-6 xl:col-span-1`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-mono-ui text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                  New request
                </h2>
                <p className="mt-2 text-sm text-[color:var(--muted)]">
                  Submit against the latest HCM balance with optimistic feedback.
                </p>
              </div>
              <span className="rounded-lg border border-[color:var(--border)] bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--accent-warm)]">
                Draft
              </span>
            </div>

            <div className="mt-5 grid gap-4">
              <label className={labelClass}>
                Employee
                <select
                  value={form.employeeId}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      employeeId: event.target.value,
                    }))
                  }
                  className={fieldClass}
                >
                  {employees.map((employee) => (
                    <option key={employee.employeeId} value={employee.employeeId}>
                      {employee.employeeName} - {employee.locationName}
                    </option>
                  ))}
                </select>
              </label>

              <label className={labelClass}>
                Leave type
                <select
                  value={form.leaveType}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      leaveType: event.target.value as LeaveType,
                    }))
                  }
                  className={fieldClass}
                >
                  {leaveTypes.map((leaveType) => (
                    <option key={leaveType} value={leaveType}>
                      {formatLeaveType(leaveType)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className={labelClass}>
                  Start
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        startDate: event.target.value,
                      }))
                    }
                    className={fieldClass}
                  />
                </label>
                <label className={labelClass}>
                  End
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        endDate: event.target.value,
                      }))
                    }
                    className={fieldClass}
                  />
                </label>
              </div>

              <label className={labelClass}>
                Hours
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.requestedAmount}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      requestedAmount: event.target.value,
                    }))
                  }
                  className={fieldClass}
                />
              </label>

              <label className={labelClass}>
                Reason
                <input
                  value={form.reason}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      reason: event.target.value,
                    }))
                  }
                  className={fieldClass}
                />
              </label>

              <label className={labelClass}>
                HCM behavior
                <select
                  value={form.scenario}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      scenario: event.target.value as TimeOffMutationScenario,
                    }))
                  }
                  className={fieldClass}
                >
                  <option value="normal">normal</option>
                  <option value="insufficient-balance">insufficient-balance</option>
                  <option value="conflict">conflict</option>
                  <option value="silent-wrong-mutation">silent-wrong-mutation</option>
                </select>
              </label>

              <button
                type="submit"
                disabled={mutation.isPending}
                className="mt-1 inline-flex items-center justify-center rounded-xl bg-[linear-gradient(135deg,#0b4a5f,#1e8a9a)] px-5 py-3.5 text-sm font-semibold text-white shadow-[0_16px_28px_-18px_rgba(11,74,95,0.9)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_32px_-20px_rgba(11,74,95,0.95)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {mutation.isPending ? "Submitting" : "Submit request"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
