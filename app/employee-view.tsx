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
    <main className="min-h-screen bg-[#f4f1e8] text-[#18211f]">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="grid gap-4 border-b border-[#c9c0ad] pb-5 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5a645f]">
              ExampleHR Employee View
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-[#18211f]">
              Time off control desk
            </h1>
            <Link
              href="/manager"
              className="mt-3 inline-flex border border-[#758071] bg-[#fffaf0] px-3 py-2 text-sm font-semibold text-[#18211f] transition hover:border-[#18211f]"
            >
              Open manager queue
            </Link>
          </div>
          <div className="flex items-end">
            <div className="border border-[#c9c0ad] bg-[#fffaf0] px-4 py-3 text-sm shadow-sm">
              <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-[#5a645f]">
                HCM status
              </span>
              <span className="mt-1 block font-medium">{notice}</span>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[240px_1fr_360px]">
          <aside className="border border-[#c9c0ad] bg-[#ede7da] p-3">
            <h2 className="px-2 pb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#5a645f]">
              Employee / location
            </h2>
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
                  className={`w-full border px-3 py-3 text-left transition ${
                    activeEmployeeId === employee.employeeId
                      ? "border-[#18211f] bg-[#18211f] text-[#fffaf0]"
                      : "border-[#c9c0ad] bg-[#fffaf0] text-[#18211f] hover:border-[#758071]"
                  }`}
                >
                  <span className="block text-sm font-semibold">
                    {employee.employeeName}
                  </span>
                  <span className="mt-1 block text-xs opacity-80">
                    {employee.locationName} - {employee.employeeId}
                  </span>
                </button>
              ))}
            </div>
          </aside>

          <section className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
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
                    className="border border-[#c9c0ad] bg-[#fffaf0] p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#5a645f]">
                          {formatLeaveType(balance.leaveType)}
                        </h2>
                        <p className="mt-3 text-4xl font-semibold tracking-normal">
                          {balance.available}
                          <span className="ml-1 text-sm font-medium text-[#5a645f]">
                            {balance.unit}
                          </span>
                        </p>
                      </div>
                      <span
                        className={`border px-2 py-1 text-[11px] font-semibold ${statusClass[status]}`}
                      >
                        {statusCopy[status]}
                      </span>
                    </div>
                    <dl className="mt-5 grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <dt className="text-xs text-[#5a645f]">Pending</dt>
                        <dd className="font-semibold">{balance.pending}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-[#5a645f]">Used</dt>
                        <dd className="font-semibold">{balance.used}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-[#5a645f]">Version</dt>
                        <dd className="font-semibold">v{balance.version}</dd>
                      </div>
                    </dl>
                  </article>
                );
              })}
            </div>

            <section className="border border-[#c9c0ad] bg-[#fffaf0]">
              <div className="flex items-center justify-between border-b border-[#c9c0ad] px-4 py-3">
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#5a645f]">
                  Requests
                </h2>
                <span className="text-sm font-medium">
                  {selectedEmployee?.employeeName ?? activeEmployeeId}
                </span>
              </div>
              <div className="divide-y divide-[#ded6c6]">
                {activeRequests.length === 0 ? (
                  <p className="px-4 py-8 text-sm text-[#5a645f]">
                    No requests for this employee yet.
                  </p>
                ) : (
                  activeRequests.map((request) => (
                    <div
                      key={request.id}
                      className="grid gap-3 px-4 py-3 text-sm sm:grid-cols-[1fr_120px_100px]"
                    >
                      <div>
                        <p className="font-semibold">
                          {formatLeaveType(request.leaveType)} - {request.requestedAmount} hours
                        </p>
                        <p className="mt-1 text-[#5a645f]">
                          {request.startDate} to {request.endDate} - {request.reason}
                        </p>
                      </div>
                      <p className="font-medium">{request.status}</p>
                      <p className="text-[#5a645f]">v{request.version}</p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </section>

          <form
            onSubmit={handleSubmit}
            className="border border-[#18211f] bg-[#dbe6dd] p-4 shadow-sm"
          >
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#34403b]">
              New request
            </h2>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm font-medium">
                Employee
                <select
                  value={form.employeeId}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      employeeId: event.target.value,
                    }))
                  }
                  className="border border-[#9ba99f] bg-[#fffaf0] px-3 py-2"
                >
                  {employees.map((employee) => (
                    <option key={employee.employeeId} value={employee.employeeId}>
                      {employee.employeeName} - {employee.locationName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm font-medium">
                Leave type
                <select
                  value={form.leaveType}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      leaveType: event.target.value as LeaveType,
                    }))
                  }
                  className="border border-[#9ba99f] bg-[#fffaf0] px-3 py-2"
                >
                  {leaveTypes.map((leaveType) => (
                    <option key={leaveType} value={leaveType}>
                      {formatLeaveType(leaveType)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-medium">
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
                    className="border border-[#9ba99f] bg-[#fffaf0] px-3 py-2"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium">
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
                    className="border border-[#9ba99f] bg-[#fffaf0] px-3 py-2"
                  />
                </label>
              </div>

              <label className="grid gap-1 text-sm font-medium">
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
                  className="border border-[#9ba99f] bg-[#fffaf0] px-3 py-2"
                />
              </label>

              <label className="grid gap-1 text-sm font-medium">
                Reason
                <input
                  value={form.reason}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      reason: event.target.value,
                    }))
                  }
                  className="border border-[#9ba99f] bg-[#fffaf0] px-3 py-2"
                />
              </label>

              <label className="grid gap-1 text-sm font-medium">
                HCM behavior
                <select
                  value={form.scenario}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      scenario: event.target.value as TimeOffMutationScenario,
                    }))
                  }
                  className="border border-[#9ba99f] bg-[#fffaf0] px-3 py-2"
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
                className="mt-2 border border-[#18211f] bg-[#18211f] px-4 py-3 text-sm font-semibold text-[#fffaf0] transition hover:bg-[#2f3935] disabled:cursor-not-allowed disabled:opacity-60"
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
