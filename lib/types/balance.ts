export type EmployeeId = string;

export type LeaveType = "vacation" | "sick" | "personal";

export type BalanceUnit = "hours" | "days";

export type BalanceCellKey = `${EmployeeId}:${LeaveType}`;

export type BalanceAdjustmentReason =
  | "request-created"
  | "request-approved"
  | "request-rejected"
  | "request-cancelled"
  | "anniversary-bonus"
  | "manual-correction";

export type BalanceCell = {
  employeeId: EmployeeId;
  employeeName: string;
  locationId: string;
  locationName: string;
  leaveType: LeaveType;
  unit: BalanceUnit;
  available: number;
  pending: number;
  used: number;
  annualAllowance: number;
  version: number;
  lastCalculatedAt: string;
  anniversaryBonusAppliedAt: string | null;
};

export type BalanceAdjustment = {
  employeeId: EmployeeId;
  leaveType: LeaveType;
  deltaAvailable: number;
  deltaPending: number;
  deltaUsed: number;
  reason: BalanceAdjustmentReason;
  sourceRequestId?: string;
};

export type BatchBalancesRequest = {
  employeeIds: EmployeeId[];
  leaveTypes?: LeaveType[];
};

export type BatchBalancesResponse = {
  balances: BalanceCell[];
  generatedAt: string;
};

export type BalanceReadScenario = "normal" | "anniversary-bonus";

export type AuthoritativeBalanceResponse = {
  balance: BalanceCell;
  generatedAt: string;
  triggeredBonus: boolean;
};
