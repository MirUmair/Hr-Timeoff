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

const leaveTypeMeta: Record<
  LeaveType,
  {
    badge: string;
    cardAccent: string;
    iconClass: string;
  }
> = {
  vacation: {
    badge: "VA",
    cardAccent: "bg-emerald-500",
    iconClass: "bg-emerald-50 text-emerald-700",
  },
  sick: {
    badge: "SI",
    cardAccent: "bg-sky-500",
    iconClass: "bg-sky-50 text-sky-700",
  },
  personal: {
    badge: "PE",
    cardAccent: "bg-violet-500",
    iconClass: "bg-violet-50 text-violet-700",
  },
};

const avatarTones = [
  "bg-[linear-gradient(135deg,#0b4a5f,#1e8a9a)] text-white",
  "bg-[#f0e7dc] text-[color:var(--foreground)]",
  "bg-[linear-gradient(135deg,#d9d1ff,#7057d8)] text-white",
];

const navigationItems = [
  "Dashboard",
  "Requests",
  "Calendar",
  "Employees",
  "Reports",
  "Settings",
] as const;

const calendarDays = [
  { day: "SUN", date: "05" },
  { day: "MON", date: "06", tag: "Vacation", tone: "bg-[color:var(--accent)]" },
  { day: "TUE", date: "07", tag: "Vacation", tone: "bg-[color:var(--accent)]" },
  { day: "WED", date: "08" },
  { day: "THU", date: "09" },
  { day: "FRI", date: "10", tag: "Personal", tone: "bg-violet-600" },
  { day: "SAT", date: "11" },
] as const;

function balanceKey(employeeId: EmployeeId, leaveType: LeaveType): BalanceCellKey {
  return `${employeeId}:${leaveType}`;
}

function formatLeaveType(leaveType: LeaveType): string {
  return leaveType[0].toUpperCase() + leaveType.slice(1);
}

function formatScenarioLabel(scenario: TimeOffMutationScenario): string {
  return scenario
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getDateBadge(date: string): { month: string; day: string; year: string } {
  const [year = "", month = "", day = ""] = date.split("-");
  const monthLabels = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ];
  const monthIndex = Number(month) - 1;

  return {
    month: monthLabels[monthIndex] ?? "JUL",
    day,
    year,
  };
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
  const shell = "mx-auto grid min-h-[calc(100vh-24px)] w-full max-w-[1540px] overflow-hidden rounded-[28px] border border-[color:var(--border)] bg-white shadow-[0_24px_80px_-48px_rgba(16,35,49,0.45)] lg:grid-cols-[272px_minmax(0,1fr)] xl:grid-cols-[272px_minmax(0,1fr)_360px]";
  const surface =
    "rounded-[18px] border border-[color:var(--border)] bg-white shadow-[0_16px_38px_-28px_rgba(16,35,49,0.45)]";
  const fieldClass =
    "h-12 w-full rounded-xl border border-[color:var(--border)] bg-white px-4 text-sm font-medium text-[color:var(--foreground)] outline-none transition placeholder:text-[color:var(--muted)] focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[rgba(18,126,143,0.14)]";
  const labelClass = "grid gap-2 text-sm font-semibold text-[color:var(--foreground)]";

  const queryClient = useQueryClient();
  const [activeEmployeeId, setActiveEmployeeId] = useState<EmployeeId>(
    employeeIds[0] ?? "emp-1001",
  );
  const [cellStatus, setCellStatus] = useState<
    Partial<Record<BalanceCellKey, FreshnessStatus>>
  >({});
  const [notice, setNotice] = useState("Balances loaded from HCM.");
  const [isRequestModalOpen, setRequestModalOpen] = useState(false);
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
  const selectedEmployeeIndex = Math.max(
    0,
    employees.findIndex((employee) => employee.employeeId === activeEmployeeId),
  );
  const selectedAvatarClass =
    avatarTones[selectedEmployeeIndex % avatarTones.length] ?? avatarTones[0];
  const pendingRequestCount = activeRequests.filter(
    (request) => request.status === "pending",
  ).length;
  const hcmStatusCard = (
    <section className="rounded-[22px] border border-amber-300 bg-[linear-gradient(180deg,#fff5d6_0%,#fffdf8_100%)] p-6 shadow-[0_22px_52px_-34px_rgba(148,97,0,0.5)] ring-1 ring-amber-100">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-amber-900/70">
            HCM Status
          </p>
          <h2 className="mt-3 text-xl font-extrabold tracking-tight text-amber-950">
            Authoritative HCM source
          </h2>
        </div>
        <span className="grid size-10 place-items-center rounded-full border border-amber-200 bg-white text-sm font-extrabold text-amber-900 shadow-sm">
          OK
        </span>
      </div>
      <p className="mt-5 rounded-2xl border border-amber-200 bg-white/85 px-4 py-3 text-sm font-semibold leading-6 text-amber-950 shadow-sm">
        {notice} just now
      </p>
      <div className="mt-5 grid gap-3">
        <div className="rounded-2xl border border-amber-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-800/80">Mode</p>
          <p className="mt-2 text-base font-extrabold text-amber-950">Optimistic</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-800/80">Source</p>
          <p className="mt-2 text-base font-extrabold text-amber-950">Authoritative HCM</p>
        </div>
      </div>
    </section>
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
      setRequestModalOpen(false);
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
    <main className="min-h-screen bg-[#f4f7f8] p-3 text-[color:var(--foreground)]">
      <div className={shell}>
        <aside className="flex flex-col gap-7 border-b border-[color:var(--border)] bg-[#fbfdfe] p-6 lg:border-r lg:border-b-0">
          <div className="flex items-center gap-4">
            <div className="grid size-12 place-items-center rounded-2xl bg-[linear-gradient(135deg,#0b4a5f,#1e8a9a)] text-base font-bold text-white shadow-[0_16px_30px_-20px_rgba(11,74,95,0.9)]">
              TO
            </div>
            <div>
              <p className="text-base font-bold">Time Off</p>
              <p className="text-sm text-[color:var(--muted)]">Control Desk</p>
              <span className="sr-only">Time off control desk</span>
            </div>
          </div>

          <nav aria-label="Time off workspace" className="space-y-2">
            {navigationItems.map((item, index) => (
              <span
                key={item}
                className={`flex items-center gap-4 rounded-xl px-4 py-3 text-sm font-semibold ${index === 0
                  ? "bg-[linear-gradient(135deg,#e9f2f4,#f4f8fa)] text-[color:var(--accent)] shadow-[inset_0_0_0_1px_rgba(214,227,235,0.72)]"
                  : "text-[color:var(--foreground)]"
                  }`}
              >
                <span className="grid size-6 place-items-center rounded-lg border border-[color:var(--border)] bg-white text-[10px] text-[color:var(--muted)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {item}
              </span>
            ))}
          </nav>

          <div className="mt-auto space-y-6">
            <section className="flex items-center gap-4 rounded-2xl border border-[color:var(--border)] bg-white p-4 shadow-[0_16px_40px_-34px_rgba(16,35,49,0.38)]">
              <div className={`grid size-12 place-items-center rounded-full text-sm font-bold ${selectedAvatarClass}`}>
                {getInitials(selectedEmployee?.employeeName ?? activeEmployeeId)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">
                  {selectedEmployee?.employeeName ?? activeEmployeeId}
                </p>
                <p className="text-sm text-[color:var(--muted)]">HR Coordinator</p>
              </div>
              <span className="text-[color:var(--muted)]">v</span>
            </section>
          </div>
        </aside>

        <section className="min-w-0 space-y-6 bg-white px-5 py-7 sm:px-8">
          <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-[#071427] sm:text-3xl">
                Welcome, {selectedEmployee?.employeeName ?? activeEmployeeId}
              </h1>
              <p className="mt-2 text-sm text-[color:var(--muted)] sm:text-base">
                Review balances, submit requests, and keep everything in sync.
              </p>
            </div>

          </header>

          <section className="grid gap-4 md:grid-cols-3">
            {visibleBalances.map((balance) => {
              const key = balanceKey(balance.employeeId, balance.leaveType);
              const status = getCellStatus(
                cellStatus,
                key,
                balancesQuery.isFetching,
                balancesQuery.isStale,
              );
              const meta = leaveTypeMeta[balance.leaveType];

              return (
                <article
                  key={key}
                  className={`${surface} relative overflow-hidden p-6 transition hover:-translate-y-0.5 hover:shadow-[0_18px_44px_-30px_rgba(16,35,49,0.42)]`}
                >
                  <div className={`absolute inset-x-0 top-0 h-1 ${meta.cardAccent}`} />
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <span className={`grid size-12 place-items-center rounded-full text-sm font-extrabold ${meta.iconClass}`}>
                        {meta.badge}
                      </span>
                      <h2 className="font-bold">{formatLeaveType(balance.leaveType)}</h2>
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${statusClass[status]}`}
                    >
                      {statusCopy[status]}
                    </span>
                  </div>
                  <p className="mt-8 text-5xl font-extrabold tracking-tight text-[#071427]">
                    {balance.available}
                    <span className="ml-3 align-middle text-base font-semibold text-[color:var(--foreground)]">
                      {balance.unit}
                    </span>
                  </p>
                  <dl className="mt-6 grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-[color:var(--border)] bg-white px-3 py-3">
                      <dt className="text-xs text-[color:var(--muted)]">Pending</dt>
                      <dd className="mt-2 text-lg font-extrabold">{balance.pending}</dd>
                    </div>
                    <div className="rounded-xl border border-[color:var(--border)] bg-white px-3 py-3">
                      <dt className="text-xs text-[color:var(--muted)]">Used</dt>
                      <dd className="mt-2 text-lg font-extrabold">{balance.used}</dd>
                    </div>
                    <div className="rounded-xl border border-[color:var(--border)] bg-white px-3 py-3">
                      <dt className="text-xs text-[color:var(--muted)]">Version</dt>
                      <dd className="mt-2 text-lg font-extrabold">v{balance.version}</dd>
                    </div>
                  </dl>
                </article>
              );
            })}
          </section>

          <section className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
            <section className={`${surface} p-5`}>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-extrabold">Employee / Location</h2>
                <span className="rounded-lg bg-[#edf6f8] px-3 py-1 text-xs font-bold text-[color:var(--accent)]">
                  {employees.length} People
                </span>
              </div>
              <div className="mt-5 space-y-3">
                {employees.map((employee, index) => {
                  const avatarClass = avatarTones[index % avatarTones.length] ?? avatarTones[0];

                  return (
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
                      className={`flex w-full items-center gap-4 rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 ${activeEmployeeId === employee.employeeId
                        ? "border-transparent bg-[linear-gradient(135deg,#0b4a5f,#1b8797)] text-white shadow-[0_20px_34px_-24px_rgba(11,74,95,0.9)]"
                        : "border-[color:var(--border)] bg-white text-[color:var(--foreground)] hover:border-[color:var(--border-strong)]"
                        }`}
                    >
                      <span className={`grid size-11 place-items-center rounded-full text-sm font-bold ${avatarClass}`}>
                        {getInitials(employee.employeeName)}
                      </span>
                      <span>
                        <span className="block font-bold">{employee.employeeName}</span>
                        <span className="mt-1 block text-sm text-current/70">
                          {employee.locationName} - {employee.employeeId}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className={`${surface} overflow-hidden`}>
              <div className="flex items-center justify-between px-6 py-5">
                <div>
                  <h2 className="text-base font-extrabold">Requests</h2>
                  <p className="mt-2 text-sm text-[color:var(--muted)]">
                    Live request history for {selectedEmployee?.employeeName ?? activeEmployeeId}
                  </p>
                </div>
                <span className="rounded-lg bg-[#edf6f8] px-4 py-2 text-xs font-bold text-[color:var(--accent)]">
                  {pendingRequestCount} open
                </span>
              </div>
              <div className="space-y-3 px-6 pb-5">
                {activeRequests.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-[color:var(--border)] px-4 py-8 text-sm text-[color:var(--muted)]">
                    No requests for this employee yet.
                  </p>
                ) : (
                  activeRequests.map((request) => {
                    const badge = getDateBadge(request.startDate);

                    return (
                      <div
                        key={request.id}
                        className="grid gap-4 rounded-2xl border border-[color:var(--border)] bg-white p-4 text-sm sm:grid-cols-[76px_minmax(0,1fr)_auto] sm:items-center"
                      >
                        <div className="rounded-xl bg-[#f4f7f9] px-3 py-2 text-center">
                          <p className="text-xs font-bold text-[color:var(--muted)]">{badge.month}</p>
                          <p className="text-3xl font-extrabold leading-none text-[#071427]">{badge.day}</p>
                          <p className="mt-1 text-xs font-semibold text-[color:var(--muted)]">{badge.year}</p>
                        </div>
                        <div>
                          <p className="font-extrabold">
                            {formatLeaveType(request.leaveType)} request - {request.requestedAmount} hours
                          </p>
                          <p className="mt-2 text-[color:var(--muted)]">
                            {request.startDate} to {request.endDate}
                          </p>
                          <p className="mt-1 text-[color:var(--muted)]">{request.reason}</p>
                        </div>
                        <div className="flex items-center gap-4 sm:flex-col sm:items-end">
                          <span className="rounded-full bg-amber-50 px-4 py-2 text-xs font-bold capitalize text-amber-700">
                            {request.status}
                          </span>
                          <span className="text-sm font-bold text-[color:var(--muted)]">v{request.version}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="border-t border-[color:var(--border)] px-6 py-4 text-center">
                <span className="font-bold text-[color:var(--accent)]">View all requests &gt;</span>
              </div>
            </section>
          </section>

          <section className={`${surface} overflow-hidden`}>
            <div className="px-6 py-5">
              <h2 className="text-base font-extrabold">Upcoming time off</h2>
              <div className="mt-5 grid overflow-hidden rounded-2xl border border-[color:var(--border)] sm:grid-cols-7">
                {calendarDays.map((day) => (
                  <div
                    key={`${day.day}-${day.date}`}
                    className="min-h-28 border-b border-[color:var(--border)] p-4 text-center last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0"
                  >
                    <p className="text-xs font-bold text-[color:var(--muted)]">{day.day}</p>
                    <p className="mt-1 text-2xl font-extrabold text-[#071427]">{day.date}</p>
                    {"tag" in day ? (
                      <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold text-white ${day.tone}`}>
                        {day.tag}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t border-[color:var(--border)] px-6 py-4 text-center">
              <span className="font-bold text-[color:var(--accent)]">View full calendar</span>
            </div>
          </section>
        </section>

        <aside className="border-t border-[color:var(--border)] bg-white p-6 xl:border-t-0 xl:border-l">
          <div className="xl:sticky xl:top-6 space-y-4">
            {hcmStatusCard}

            <div className="rounded-[22px] border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-6 shadow-[0_20px_46px_-38px_rgba(58,41,22,0.42)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[color:var(--accent-warm)]">
                    New request
                  </p>
                  <h2 className="mt-3 text-xl font-extrabold">New time off request</h2>
                  <p className="mt-4 text-sm leading-6 text-[color:var(--muted)]">
                    Open a focused popup to submit against the latest HCM balance.
                  </p>
                </div>
                <span className="rounded-full border border-[color:var(--border)] bg-white px-3 py-1 text-xs font-extrabold uppercase text-[color:var(--accent-warm)]">
                  Draft
                </span>
              </div>

              <dl className="mt-6 grid gap-3 text-sm">
                <div className="rounded-2xl border border-[color:var(--border)] bg-white p-4">
                  <dt className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--muted)]">
                    Employee
                  </dt>
                  <dd className="mt-2 font-bold">
                    {selectedEmployee?.employeeName ?? activeEmployeeId}
                  </dd>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-[color:var(--border)] bg-white p-4">
                    <dt className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--muted)]">
                      Leave
                    </dt>
                    <dd className="mt-2 font-bold">{formatLeaveType(form.leaveType)}</dd>
                  </div>
                  <div className="rounded-2xl border border-[color:var(--border)] bg-white p-4">
                    <dt className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--muted)]">
                      Hours
                    </dt>
                    <dd className="mt-2 font-bold">{form.requestedAmount}</dd>
                  </div>
                </div>
              </dl>

              <button
                type="button"
                onClick={() => setRequestModalOpen(true)}
                className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl bg-[linear-gradient(135deg,#064f52,#159596)] px-5 text-sm font-extrabold text-white shadow-[0_18px_28px_-20px_rgba(6,79,82,0.9)] transition hover:-translate-y-0.5"
              >
                Submit request
              </button>

              <p className="mt-5 rounded-2xl border border-[color:var(--border)] bg-white/80 p-4 text-sm leading-6 text-[color:var(--muted)]">
                Balances are updated in near real-time from HCM.
              </p>
            </div>
          </div>
        </aside>

        {isRequestModalOpen ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-dialog-title"
            className="fixed inset-0 z-50 grid place-items-center bg-[#092327]/55 p-4 backdrop-blur-sm"
          >
            <form
              onSubmit={handleSubmit}
              className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-6 shadow-[0_30px_90px_-36px_rgba(0,0,0,0.55)] sm:p-8"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[color:var(--accent-warm)]">
                    Draft request
                  </p>
                  <h2 id="request-dialog-title" className="mt-3 text-2xl font-extrabold">
                    New time off request
                  </h2>
                  <p className="mt-3 max-w-lg text-sm leading-6 text-[color:var(--muted)]">
                    Submit against the latest HCM balance with optimistic feedback.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRequestModalOpen(false)}
                  className="grid size-10 place-items-center rounded-full border border-[color:var(--border)] bg-white text-sm font-extrabold text-[color:var(--foreground)] transition hover:border-[color:var(--accent)]"
                  aria-label="Close request form"
                >
                  X
                </button>
              </div>

              <div className="mt-7 grid gap-5">
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
                    <option value="normal">{formatScenarioLabel("normal")}</option>
                    <option value="insufficient-balance">
                      {formatScenarioLabel("insufficient-balance")}
                    </option>
                    <option value="conflict">{formatScenarioLabel("conflict")}</option>
                    <option value="silent-wrong-mutation">
                      {formatScenarioLabel("silent-wrong-mutation")}
                    </option>
                  </select>
                </label>

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setRequestModalOpen(false)}
                    className="inline-flex h-12 items-center justify-center rounded-xl border border-[color:var(--border)] bg-white px-5 text-sm font-extrabold text-[color:var(--foreground)] transition hover:border-[color:var(--accent)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={mutation.isPending}
                    className="inline-flex h-12 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#064f52,#159596)] px-5 text-sm font-extrabold text-white shadow-[0_18px_28px_-20px_rgba(6,79,82,0.9)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {mutation.isPending ? "Submitting" : "Submit request"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        ) : null}
      </div>
    </main>
  );
}
