import type { EmployeeId, LeaveType } from "@/lib/types/balance";
import type { TimeOffRequestId } from "@/lib/types/request";

export const queryKeys = {
  hcm: ["hcm"] as const,
  balances: (employeeIds: EmployeeId[], leaveTypes?: LeaveType[]) =>
    [
      ...queryKeys.hcm,
      "balances",
      [...employeeIds].sort(),
      leaveTypes ? [...leaveTypes].sort() : "all",
    ] as const,
  balance: (employeeId: EmployeeId, leaveType: LeaveType) =>
    [...queryKeys.hcm, "balance", employeeId, leaveType] as const,
  timeOffRequests: (employeeId?: EmployeeId) =>
    [...queryKeys.hcm, "time-off-requests", employeeId ?? "all"] as const,
  timeOffRequest: (requestId: TimeOffRequestId) =>
    [...queryKeys.hcm, "time-off-request", requestId] as const,
};
