"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import {
  approveTimeOffRequest,
  denyTimeOffRequest,
  fetchBalance,
  fetchBalances,
  fetchTimeOffRequests,
  HcmClientError,
} from "@/lib/hcm/hcmClient";
import { queryKeys } from "@/lib/query/queryKeys";
import type {
  BalanceCell,
  BatchBalancesResponse,
  EmployeeId,
  LeaveType,
} from "@/lib/types/balance";
import type {
  TimeOffRequest,
  TimeOffRequestsResponse,
} from "@/lib/types/request";

type ApprovalBehavior = "normal" | "balance-changed" | "hcm-conflict";

type ApprovalState =
  | "ready"
  | "stale"
  | "verifying"
  | "blocked"
  | "confirmed"
  | "denied"
  | "conflict";

type ManagerViewProps = {
  employeeIds: EmployeeId[];
  initialBalances: BatchBalancesResponse;
  initialRequests: TimeOffRequestsResponse;
};

type RequestUiState = {
  approvalState: ApprovalState;
  message: string;
  verifiedBalanceVersion?: number;
};

const stateClass: Record<ApprovalState, string> = {
  ready: "border-emerald-200 bg-emerald-50 text-emerald-800",
  stale: "border-amber-200 bg-amber-50 text-amber-800",
  verifying: "border-blue-200 bg-blue-50 text-blue-800",
  blocked: "border-orange-300 bg-orange-50 text-orange-900",
  confirmed: "border-teal-200 bg-teal-50 text-teal-900",
  denied: "border-slate-200 bg-slate-50 text-slate-900",
  conflict: "border-red-300 bg-red-50 text-red-900",
};

function formatLeaveType(leaveType: LeaveType): string {
  return leaveType[0].toUpperCase() + leaveType.slice(1);
}

function findBalance(
  balances: BalanceCell[],
  request: TimeOffRequest,
): BalanceCell | undefined {
  return balances.find(
    (balance) =>
      balance.employeeId === request.employeeId &&
      balance.leaveType === request.leaveType,
  );
}

function replaceBalance(
  response: BatchBalancesResponse,
  authoritative: BalanceCell,
): BatchBalancesResponse {
  return {
    ...response,
    balances: response.balances.map((balance) =>
      balance.employeeId === authoritative.employeeId &&
      balance.leaveType === authoritative.leaveType
        ? authoritative
        : balance,
    ),
  };
}

function replaceRequest(
  response: TimeOffRequestsResponse,
  nextRequest: TimeOffRequest,
): TimeOffRequestsResponse {
  return {
    ...response,
    requests: response.requests.map((request) =>
      request.id === nextRequest.id ? nextRequest : request,
    ),
  };
}

function balanceChanged(previous: BalanceCell, next: BalanceCell): boolean {
  return (
    previous.available !== next.available ||
    previous.pending !== next.pending ||
    previous.used !== next.used ||
    previous.version !== next.version
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof HcmClientError) {
    return error.payload.error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Approval failed.";
}

function getVisibleState(
  requestId: string,
  requestState: Partial<Record<string, RequestUiState>>,
  balancesStale: boolean,
): RequestUiState {
  const state = requestState[requestId];

  if (
    balancesStale &&
    (!state || state.approvalState === "ready" || state.approvalState === "stale")
  ) {
    return {
      approvalState: "stale",
      message: "Balance context is stale. Verify HCM before approving.",
    };
  }

  if (state) {
    return state;
  }

  return {
    approvalState: "ready",
    message: "Ready for HCM verification.",
  };
}

export function ManagerView({
  employeeIds,
  initialBalances,
  initialRequests,
}: ManagerViewProps) {
  const shell = "mx-auto w-full max-w-[1420px] px-4 py-7 sm:px-6 lg:px-8";
  const surface =
    "rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow)] ring-1 ring-white/70 backdrop-blur";
  const surfaceSoft =
    "rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] shadow-[var(--shadow-soft)] ring-1 ring-white/80";
  const fieldClass =
    "w-full rounded-xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm text-[color:var(--foreground)] outline-none transition focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[rgba(30,138,154,0.14)]";

  const queryClient = useQueryClient();
  const [behaviorByRequest, setBehaviorByRequest] = useState<
    Partial<Record<string, ApprovalBehavior>>
  >({});
  const [requestState, setRequestState] = useState<
    Partial<Record<string, RequestUiState>>
  >({});

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
  const approvalMutation = useMutation({
    mutationFn: approveTimeOffRequest,
  });
  const denialMutation = useMutation({
    mutationFn: denyTimeOffRequest,
  });

  const pendingRequests = requestsQuery.data.requests.filter(
    (request) => request.status === "pending",
  );
  const approvedRequests = requestsQuery.data.requests.filter(
    (request) => request.status === "approved",
  );
  const rejectedRequests = requestsQuery.data.requests.filter(
    (request) => request.status === "rejected",
  );

  async function handleApprove(request: TimeOffRequest) {
    const visibleBalance = findBalance(balancesQuery.data.balances, request);
    const behavior = behaviorByRequest[request.id] ?? "normal";

    if (!visibleBalance) {
      setRequestState((current) => ({
        ...current,
        [request.id]: {
          approvalState: "blocked",
          message: "Approval blocked because no balance context is available.",
        },
      }));
      return;
    }

    setRequestState((current) => ({
      ...current,
      [request.id]: {
        approvalState: "verifying",
        message: "Fetching latest per-cell HCM balance before approval.",
      },
    }));

    const latestBalance = await fetchBalance(
      request.employeeId,
      request.leaveType,
      behavior === "balance-changed",
    );

    queryClient.setQueryData<BatchBalancesResponse>(
      queryKeys.balances(employeeIds),
      replaceBalance(balancesQuery.data, latestBalance.balance),
    );

    if (balanceChanged(visibleBalance, latestBalance.balance)) {
      setRequestState((current) => ({
        ...current,
        [request.id]: {
          approvalState: "blocked",
          message:
            "Approval blocked. HCM balance changed during verification; review the refreshed balance context first.",
          verifiedBalanceVersion: latestBalance.balance.version,
        },
      }));
      return;
    }

    if (balancesQuery.isStale) {
      setRequestState((current) => ({
        ...current,
        [request.id]: {
          approvalState: "stale",
          message:
            "Approval blocked. The queue balance was stale; it has been refreshed, so approve again after review.",
          verifiedBalanceVersion: latestBalance.balance.version,
        },
      }));
      return;
    }

    try {
      const approval = await approvalMutation.mutateAsync({
        requestId: request.id,
        managerId: "mgr-9001",
        expectedRequestVersion: request.version,
        scenario: behavior === "hcm-conflict" ? "conflict" : "normal",
      });

      queryClient.setQueryData<TimeOffRequestsResponse>(
        queryKeys.timeOffRequests(),
        replaceRequest(requestsQuery.data, approval.request),
      );

      const confirmedBalance = await fetchBalance(
        approval.request.employeeId,
        approval.request.leaveType,
      );

      queryClient.setQueryData<BatchBalancesResponse>(
        queryKeys.balances(employeeIds),
        replaceBalance(balancesQuery.data, confirmedBalance.balance),
      );
      setRequestState((current) => ({
        ...current,
        [request.id]: {
          approvalState: "confirmed",
          message: "Approval confirmed by HCM.",
          verifiedBalanceVersion: confirmedBalance.balance.version,
        },
      }));
    } catch (error) {
      setRequestState((current) => ({
        ...current,
        [request.id]: {
          approvalState:
            error instanceof HcmClientError && error.payload.error.code === "CONFLICT"
              ? "conflict"
              : "blocked",
          message:
            error instanceof HcmClientError && error.payload.error.code === "CONFLICT"
              ? `Recoverable conflict. ${getErrorMessage(error)} Refresh the queue and retry.`
              : getErrorMessage(error),
        },
      }));
    }
  }

  async function handleDeny(request: TimeOffRequest) {
    setRequestState((current) => ({
      ...current,
      [request.id]: {
        approvalState: "verifying",
        message: "Sending denial to HCM and releasing the pending balance.",
      },
    }));

    try {
      const denial = await denialMutation.mutateAsync({
        requestId: request.id,
        managerId: "mgr-9001",
        expectedRequestVersion: request.version,
        reason: "Manager denied after review.",
      });

      queryClient.setQueryData<TimeOffRequestsResponse>(
        queryKeys.timeOffRequests(),
        replaceRequest(requestsQuery.data, denial.request),
      );

      const confirmedBalance = await fetchBalance(
        denial.request.employeeId,
        denial.request.leaveType,
      );

      queryClient.setQueryData<BatchBalancesResponse>(
        queryKeys.balances(employeeIds),
        replaceBalance(balancesQuery.data, confirmedBalance.balance),
      );
      setRequestState((current) => ({
        ...current,
        [request.id]: {
          approvalState: "denied",
          message: "Denial confirmed by HCM and pending balance released.",
          verifiedBalanceVersion: confirmedBalance.balance.version,
        },
      }));
    } catch (error) {
      setRequestState((current) => ({
        ...current,
        [request.id]: {
          approvalState:
            error instanceof HcmClientError && error.payload.error.code === "CONFLICT"
              ? "conflict"
              : "blocked",
          message:
            error instanceof HcmClientError && error.payload.error.code === "CONFLICT"
              ? `Recoverable conflict. ${getErrorMessage(error)} Refresh the queue and retry.`
              : getErrorMessage(error),
        },
      }));
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden text-[color:var(--foreground)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.9),_transparent_31%),radial-gradient(circle_at_12%_10%,_rgba(30,138,154,0.12),_transparent_24%)]" />
      <section className={shell + " relative z-10 space-y-6"}>
        <header className={`${surface} relative overflow-hidden p-5 md:p-7`}>
          <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--accent),#1e8a9a,var(--accent-warm))]" />
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="font-mono-ui text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--accent-warm)]">
                ExampleHR manager workspace
              </p>
              <h1 className="font-display mt-3 text-4xl leading-[0.98] font-semibold tracking-tight text-[color:var(--foreground)] sm:text-5xl">
                Approval queue
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-[color:var(--muted)] sm:text-base">
                Verify the live balance context before every decision so approvals stay aligned with the source of truth.
              </p>
              <Link
                href="/"
                className="mt-6 inline-flex items-center justify-center rounded-xl border border-[color:var(--border-strong)] bg-white px-4 py-2.5 text-sm font-semibold text-[color:var(--foreground)] transition hover:-translate-y-0.5 hover:border-[color:var(--accent)] hover:bg-[#f7fbfd]"
              >
                Back to employee view
              </Link>
            </div>
            <div className="min-w-[290px] rounded-3xl bg-[color:var(--accent)] p-5 text-white shadow-[0_24px_48px_-32px_rgba(11,74,95,0.75)]">
              <p className="font-mono-ui text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
                Approval rule
              </p>
              <p className="mt-3 text-sm leading-6 text-white/90">
                Verify latest HCM balance before every approval.
              </p>
              <div className="mt-5 rounded-2xl border border-white/15 bg-white/10 p-4 text-sm text-cyan-100">
                Queue decisions are blocked whenever the balance or request version drifts.
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-4">
          {pendingRequests.length === 0 ? (
            <div className={`${surface} px-5 py-10 text-sm text-[color:var(--muted)]`}>
              No pending requests in the manager queue.
            </div>
          ) : (
            pendingRequests.map((request) => {
              const balance = findBalance(balancesQuery.data.balances, request);
              const behavior = behaviorByRequest[request.id] ?? "normal";
              const uiState = getVisibleState(
                request.id,
                requestState,
                balancesQuery.isStale,
              );
              const canApprove =
                uiState.approvalState !== "verifying" &&
                !approvalMutation.isPending &&
                !denialMutation.isPending;

              return (
                <article
                  key={request.id}
                  className={`${surface} grid gap-5 p-5 transition hover:border-[color:var(--border-strong)] hover:shadow-[var(--shadow-soft)] xl:grid-cols-[minmax(0,1fr)_320px]`}
                >
                  <div className="space-y-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-mono-ui text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                          {request.id}
                        </p>
                        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[color:var(--accent)]">
                          {balance?.employeeName ?? request.employeeId}
                        </h2>
                        <p className="mt-2 text-sm text-[color:var(--muted)]">
                          {balance?.locationName ?? "Unknown location"} -{" "}
                          {formatLeaveType(request.leaveType)} - {request.requestedAmount} hours
                        </p>
                      </div>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${stateClass[uiState.approvalState]}`}
                      >
                        {uiState.approvalState}
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-[color:var(--border)] bg-[#f6fbfd] p-4">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
                          Available
                        </p>
                        <p className="mt-2 text-3xl font-semibold text-[color:var(--accent)]">
                          {balance?.available ?? "--"}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-[color:var(--border)] bg-[#f6fbfd] p-4">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
                          Pending
                        </p>
                        <p className="mt-2 text-3xl font-semibold text-[color:var(--accent)]">
                          {balance?.pending ?? "--"}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-[color:var(--border)] bg-[#f6fbfd] p-4">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
                          Balance version
                        </p>
                        <p className="mt-2 text-3xl font-semibold text-[color:var(--accent)]">
                          {balance ? `v${balance.version}` : "--"}
                        </p>
                      </div>
                    </div>

                    <p className="rounded-2xl border-l-4 border-[color:var(--accent-warm)] bg-[#f6fbfd] px-4 py-3 text-sm leading-6 text-[color:var(--foreground)]">
                      {uiState.message}
                    </p>
                    <p className="text-sm text-[color:var(--muted)]">
                      {request.startDate} to {request.endDate} - {request.reason}
                    </p>
                  </div>

                  <div className={`${surfaceSoft} flex flex-col justify-between gap-4 p-4`}>
                    <label className="grid gap-2 text-sm font-medium text-[color:var(--foreground)]">
                      HCM approval behavior
                      <select
                        value={behavior}
                        onChange={(event) =>
                          setBehaviorByRequest((current) => ({
                            ...current,
                            [request.id]: event.target.value as ApprovalBehavior,
                          }))
                        }
                        className={fieldClass}
                      >
                        <option value="normal">normal</option>
                        <option value="balance-changed">balance-changed</option>
                        <option value="hcm-conflict">hcm-conflict</option>
                      </select>
                    </label>

                    <div className="grid gap-3">
                      <button
                        type="button"
                        disabled={!canApprove}
                        onClick={() => void handleApprove(request)}
                        className="inline-flex items-center justify-center rounded-xl bg-[linear-gradient(135deg,#0b4a5f,#1e8a9a)] px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_28px_-18px_rgba(11,74,95,0.9)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {uiState.approvalState === "verifying"
                          ? "Verifying"
                          : "Verify and approve"}
                      </button>
                      <button
                        type="button"
                        disabled={!canApprove}
                        onClick={() => void handleDeny(request)}
                        className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900 transition hover:-translate-y-0.5 hover:border-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {uiState.approvalState === "verifying"
                          ? "Reviewing"
                          : "Deny request"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void queryClient.invalidateQueries({
                            queryKey: queryKeys.balances(employeeIds),
                          });
                          void queryClient.invalidateQueries({
                            queryKey: queryKeys.timeOffRequests(),
                          });
                          setRequestState((current) => ({
                            ...current,
                            [request.id]: {
                              approvalState: "ready",
                              message: "Queue refreshed. Verify HCM again before approval.",
                            },
                          }));
                        }}
                        className="inline-flex items-center justify-center rounded-xl border border-[color:var(--border-strong)] bg-white px-4 py-3 text-sm font-semibold text-[color:var(--foreground)] transition hover:-translate-y-0.5 hover:border-[color:var(--accent)] hover:bg-[#f7fbfd]"
                      >
                        Refresh and recover
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>

        {approvedRequests.length > 0 ? (
          <section className={`${surface} overflow-hidden`}>
            <div className="border-b border-[color:var(--border)] px-5 py-4">
              <h2 className="font-mono-ui text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                Approval confirmations
              </h2>
            </div>
            <div className="divide-y divide-[color:var(--border)]/70">
              {approvedRequests.map((request) => (
                <div
                  key={request.id}
                  className="grid gap-2 px-5 py-4 text-sm sm:grid-cols-[minmax(0,1fr)_120px]"
                >
                  <span className="text-[color:var(--foreground)]">
                    {request.id} - {formatLeaveType(request.leaveType)} - {request.requestedAmount} hours
                  </span>
                  <strong className="text-[color:var(--accent)]">confirmed</strong>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {rejectedRequests.length > 0 ? (
          <section className={`${surface} overflow-hidden`}>
            <div className="border-b border-[color:var(--border)] px-5 py-4">
              <h2 className="font-mono-ui text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                Denial confirmations
              </h2>
            </div>
            <div className="divide-y divide-[color:var(--border)]/70">
              {rejectedRequests.map((request) => (
                <div
                  key={request.id}
                  className="grid gap-2 px-5 py-4 text-sm sm:grid-cols-[minmax(0,1fr)_120px]"
                >
                  <span className="text-[color:var(--foreground)]">
                    {request.id} - {formatLeaveType(request.leaveType)} - {request.requestedAmount} hours
                  </span>
                  <strong className="text-rose-800">denied</strong>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
