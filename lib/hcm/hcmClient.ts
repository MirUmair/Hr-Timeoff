import type {
  AuthoritativeBalanceResponse,
  BatchBalancesRequest,
  BatchBalancesResponse,
  EmployeeId,
  LeaveType,
} from "@/lib/types/balance";
import type {
  ApproveTimeOffRequestInput,
  CreateTimeOffRequestInput,
  DenyTimeOffRequestInput,
  HcmErrorResponse,
  TimeOffRequestsResponse,
  TimeOffRequestWriteResponse,
} from "@/lib/types/request";

export class HcmClientError extends Error {
  readonly status: number;
  readonly payload: HcmErrorResponse;

  constructor(status: number, payload: HcmErrorResponse) {
    super(payload.error.message);
    this.name = "HcmClientError";
    this.status = status;
    this.payload = payload;
  }
}

type JsonBody = Record<string, unknown> | readonly unknown[];

function isHcmErrorResponse(value: unknown): value is HcmErrorResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as { error?: unknown };
  if (!candidate.error || typeof candidate.error !== "object") {
    return false;
  }

  const error = candidate.error as { code?: unknown; message?: unknown };
  return typeof error.code === "string" && typeof error.message === "string";
}

async function requestJson<TResponse>(
  path: string,
  init?: RequestInit & { json?: JsonBody },
): Promise<TResponse> {
  const headers = new Headers(init?.headers);

  if (init?.json !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...init,
    headers,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  const payload = (await response.json()) as unknown;

  if (!response.ok) {
    if (isHcmErrorResponse(payload)) {
      throw new HcmClientError(response.status, payload);
    }

    throw new Error(`HCM request failed with status ${response.status}.`);
  }

  return payload as TResponse;
}

export function fetchBalances(
  input: BatchBalancesRequest,
): Promise<BatchBalancesResponse> {
  return requestJson<BatchBalancesResponse>("/api/hcm/balances", {
    method: "POST",
    json: input,
  });
}

export function fetchBalance(
  employeeId: EmployeeId,
  leaveType: LeaveType,
  triggerAnniversaryBonus = false,
): Promise<AuthoritativeBalanceResponse> {
  const params = new URLSearchParams({
    employeeId,
    leaveType,
  });

  if (triggerAnniversaryBonus) {
    params.set("trigger", "anniversary-bonus");
  }

  return requestJson<AuthoritativeBalanceResponse>(
    `/api/hcm/balance?${params.toString()}`,
  );
}

export function fetchTimeOffRequests(
  employeeId?: EmployeeId,
): Promise<TimeOffRequestsResponse> {
  const params = new URLSearchParams();

  if (employeeId) {
    params.set("employeeId", employeeId);
  }

  const query = params.size > 0 ? `?${params.toString()}` : "";
  return requestJson<TimeOffRequestsResponse>(`/api/hcm/time-off-requests${query}`);
}

export function createTimeOffRequest(
  input: CreateTimeOffRequestInput,
): Promise<TimeOffRequestWriteResponse> {
  return requestJson<TimeOffRequestWriteResponse>("/api/hcm/time-off-requests", {
    method: "POST",
    json: input,
  });
}

export function approveTimeOffRequest(
  input: ApproveTimeOffRequestInput,
): Promise<TimeOffRequestWriteResponse> {
  return requestJson<TimeOffRequestWriteResponse>("/api/hcm/manager/approve", {
    method: "POST",
    json: input,
  });
}

export function denyTimeOffRequest(
  input: DenyTimeOffRequestInput,
): Promise<TimeOffRequestWriteResponse> {
  return requestJson<TimeOffRequestWriteResponse>("/api/hcm/manager/deny", {
    method: "POST",
    json: input,
  });
}
