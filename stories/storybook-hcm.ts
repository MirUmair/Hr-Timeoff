import { delay, http, HttpResponse } from "msw";

import {
  approveTimeOffRequest,
  createTimeOffRequest,
  denyTimeOffRequest,
  getAuthoritativeBalance,
  listBalances,
  listTimeOffRequests,
  resetMockHcmDb,
} from "@/lib/hcm/mockDb";
import type { BatchBalancesRequest, EmployeeId, LeaveType } from "@/lib/types/balance";
import type {
  ApproveTimeOffRequestInput,
  CreateTimeOffRequestInput,
  DenyTimeOffRequestInput,
  HcmResetResponse,
  TimeOffRequestsResponse,
} from "@/lib/types/request";

export const employeeIds = ["emp-1001", "emp-2002"] as const;
export const managerEmployeeIds = [
  "emp-1001",
  "emp-2002",
  "emp-3003",
  "emp-4004",
] as const;

type StoryHandlerOptions = {
  slowCreateMs?: number;
  slowBalanceMs?: number;
};

function maybeDelay(ms?: number): Promise<void> | undefined {
  return ms && ms > 0 ? delay(ms) : undefined;
}

function buildSeededRequests(empty = false): TimeOffRequestsResponse {
  if (empty) {
    return {
      requests: [],
      generatedAt: "2026-06-16T00:00:00.000Z",
    };
  }

  return listTimeOffRequests();
}

export function buildEmployeeStoryProps(emptyRequests = false) {
  resetMockHcmDb();

  return {
    employeeIds: [...employeeIds],
    initialBalances: listBalances({ employeeIds: [...employeeIds] }),
    initialRequests: buildSeededRequests(emptyRequests),
  };
}

export function buildManagerStoryProps(emptyRequests = false) {
  resetMockHcmDb();

  return {
    employeeIds: [...managerEmployeeIds],
    initialBalances: listBalances({ employeeIds: [...managerEmployeeIds] }),
    initialRequests: buildSeededRequests(emptyRequests),
  };
}

export function buildStoryHandlers(options: StoryHandlerOptions = {}) {
  return [
    http.post("/api/hcm/balances", async ({ request }) => {
      const body = (await request.json()) as BatchBalancesRequest;
      return HttpResponse.json(listBalances(body));
    }),
    http.get("/api/hcm/time-off-requests", async () => HttpResponse.json(listTimeOffRequests())),
    http.get("/api/hcm/balance", async ({ request }) => {
      if (options.slowBalanceMs) {
        await maybeDelay(options.slowBalanceMs);
      }

      const url = new URL(request.url);
      const employeeId = url.searchParams.get("employeeId") as EmployeeId;
      const leaveType = url.searchParams.get("leaveType") as LeaveType;
      const triggerAnniversaryBonus = url.searchParams.get("trigger") === "anniversary-bonus";
      const result = getAuthoritativeBalance(
        employeeId,
        leaveType,
        triggerAnniversaryBonus,
      );

      return HttpResponse.json(result.value, { status: result.status });
    }),
    http.post("/api/hcm/time-off-requests", async ({ request }) => {
      if (options.slowCreateMs) {
        await maybeDelay(options.slowCreateMs);
      }

      const body = (await request.json()) as CreateTimeOffRequestInput;
      const result = createTimeOffRequest(body);
      return HttpResponse.json(result.value, { status: result.status });
    }),
    http.post("/api/hcm/manager/approve", async ({ request }) => {
      const body = (await request.json()) as ApproveTimeOffRequestInput;
      const result = approveTimeOffRequest(body);
      return HttpResponse.json(result.value, { status: result.status });
    }),
    http.post("/api/hcm/manager/deny", async ({ request }) => {
      const body = (await request.json()) as DenyTimeOffRequestInput;
      const result = denyTimeOffRequest(body);
      return HttpResponse.json(result.value, { status: result.status });
    }),
    http.post("/api/hcm/reset", async () => {
      resetMockHcmDb();

      const payload: HcmResetResponse = {
        balances: listBalances({ employeeIds: [...managerEmployeeIds] }).balances,
        requests: listTimeOffRequests().requests,
        generatedAt: new Date().toISOString(),
      };

      return HttpResponse.json(payload);
    }),
  ];
}
