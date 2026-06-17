import type { BalanceCell, EmployeeId, LeaveType } from "./balance";

export type TimeOffRequestId = string;

export type TimeOffRequestStatus =
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";

export type TimeOffMutationScenario =
  | "normal"
  | "insufficient-balance"
  | "conflict"
  | "silent-wrong-mutation";

export type TimeOffRequest = {
  id: TimeOffRequestId;
  employeeId: EmployeeId;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  requestedAmount: number;
  status: TimeOffRequestStatus;
  reason: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  clientMutationId: string | null;
};

export type CreateTimeOffRequestInput = {
  employeeId: EmployeeId;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  requestedAmount: number;
  reason: string;
  expectedBalanceVersion?: number;
  clientMutationId?: string;
  scenario?: TimeOffMutationScenario;
};

export type ApproveTimeOffRequestInput = {
  requestId: TimeOffRequestId;
  managerId: EmployeeId;
  expectedRequestVersion?: number;
  scenario?: Extract<TimeOffMutationScenario, "normal" | "conflict">;
};

export type DenyTimeOffRequestInput = {
  requestId: TimeOffRequestId;
  managerId: EmployeeId;
  expectedRequestVersion?: number;
  reason?: string;
  scenario?: Extract<TimeOffMutationScenario, "normal" | "conflict">;
};

export type TimeOffRequestsResponse = {
  requests: TimeOffRequest[];
  generatedAt: string;
};

export type TimeOffRequestWriteResponse = {
  request: TimeOffRequest;
  generatedAt: string;
};

export type HcmResetResponse = {
  balances: BalanceCell[];
  requests: TimeOffRequest[];
  generatedAt: string;
};

export type HcmErrorCode =
  | "BAD_REQUEST"
  | "AUTHENTICATION_REQUIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INSUFFICIENT_BALANCE"
  | "CONFLICT";

export type HcmErrorResponse = {
  error: {
    code: HcmErrorCode;
    message: string;
    field?: string;
    currentVersion?: number;
  };
};
