"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import {
  approveTimeOffRequest,
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

  const pendingRequests = requestsQuery.data.requests.filter(
    (request) => request.status === "pending",
  );
  const approvedRequests = requestsQuery.data.requests.filter(
    (request) => request.status === "approved",
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

  return (
    <main className="min-h-screen bg-[#eef2ec] text-[#18211f]">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="grid gap-4 border-b border-[#b6c2b7] pb-5 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#54635b]">
              ExampleHR Manager View
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal">
              Approval queue
            </h1>
            <Link
              href="/"
              className="mt-3 inline-flex border border-[#748271] bg-[#fbfff8] px-3 py-2 text-sm font-semibold transition hover:border-[#18211f]"
            >
              Back to employee view
            </Link>
          </div>
          <div className="border border-[#b6c2b7] bg-[#fbfff8] px-4 py-3 text-sm shadow-sm">
            <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-[#54635b]">
              Approval rule
            </span>
            <span className="mt-1 block font-medium">
              Verify latest HCM balance before every approval.
            </span>
          </div>
        </header>

        <section className="grid gap-4">
          {pendingRequests.length === 0 ? (
            <div className="border border-[#b6c2b7] bg-[#fbfff8] px-4 py-8 text-sm text-[#54635b]">
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
                !approvalMutation.isPending;

              return (
                <article
                  key={request.id}
                  className="grid gap-4 border border-[#b6c2b7] bg-[#fbfff8] p-4 shadow-sm lg:grid-cols-[1fr_280px]"
                >
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#54635b]">
                          {request.id}
                        </p>
                        <h2 className="mt-1 text-xl font-semibold">
                          {balance?.employeeName ?? request.employeeId}
                        </h2>
                        <p className="mt-1 text-sm text-[#54635b]">
                          {balance?.locationName ?? "Unknown location"} -{" "}
                          {formatLeaveType(request.leaveType)} -{" "}
                          {request.requestedAmount} hours
                        </p>
                      </div>
                      <span
                        className={`border px-2 py-1 text-xs font-semibold ${stateClass[uiState.approvalState]}`}
                      >
                        {uiState.approvalState}
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="border border-[#d0d9cf] bg-[#f5f8f1] p-3">
                        <p className="text-xs text-[#54635b]">Available</p>
                        <p className="mt-1 text-2xl font-semibold">
                          {balance?.available ?? "--"}
                        </p>
                      </div>
                      <div className="border border-[#d0d9cf] bg-[#f5f8f1] p-3">
                        <p className="text-xs text-[#54635b]">Pending</p>
                        <p className="mt-1 text-2xl font-semibold">
                          {balance?.pending ?? "--"}
                        </p>
                      </div>
                      <div className="border border-[#d0d9cf] bg-[#f5f8f1] p-3">
                        <p className="text-xs text-[#54635b]">Balance version</p>
                        <p className="mt-1 text-2xl font-semibold">
                          {balance ? `v${balance.version}` : "--"}
                        </p>
                      </div>
                    </div>

                    <p className="border-l-4 border-[#748271] bg-[#f5f8f1] px-3 py-2 text-sm">
                      {uiState.message}
                    </p>
                    <p className="text-sm text-[#54635b]">
                      {request.startDate} to {request.endDate} - {request.reason}
                    </p>
                  </div>

                  <div className="flex flex-col justify-between gap-4 border border-[#d0d9cf] bg-[#e1eadf] p-3">
                    <label className="grid gap-1 text-sm font-medium">
                      HCM approval behavior
                      <select
                        value={behavior}
                        onChange={(event) =>
                          setBehaviorByRequest((current) => ({
                            ...current,
                            [request.id]: event.target.value as ApprovalBehavior,
                          }))
                        }
                        className="border border-[#9aa89b] bg-[#fbfff8] px-3 py-2"
                      >
                        <option value="normal">normal</option>
                        <option value="balance-changed">balance-changed</option>
                        <option value="hcm-conflict">hcm-conflict</option>
                      </select>
                    </label>

                    <div className="grid gap-2">
                      <button
                        type="button"
                        disabled={!canApprove}
                        onClick={() => void handleApprove(request)}
                        className="border border-[#18211f] bg-[#18211f] px-4 py-3 text-sm font-semibold text-[#fbfff8] transition hover:bg-[#2f3935] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {uiState.approvalState === "verifying"
                          ? "Verifying"
                          : "Verify and approve"}
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
                        className="border border-[#748271] bg-[#fbfff8] px-4 py-3 text-sm font-semibold transition hover:border-[#18211f]"
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
          <section className="border border-[#b6c2b7] bg-[#fbfff8]">
            <div className="border-b border-[#b6c2b7] px-4 py-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#54635b]">
                Approval confirmations
              </h2>
            </div>
            <div className="divide-y divide-[#d0d9cf]">
              {approvedRequests.map((request) => (
                <div
                  key={request.id}
                  className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[1fr_120px]"
                >
                  <span>
                    {request.id} - {formatLeaveType(request.leaveType)} -{" "}
                    {request.requestedAmount} hours
                  </span>
                  <strong>confirmed</strong>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
