import type {
  AuthoritativeBalanceResponse,
  BalanceCell,
  BalanceCellKey,
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
  TimeOffRequest,
  TimeOffRequestsResponse,
  TimeOffRequestWriteResponse,
} from "@/lib/types/request";

type MockDbState = {
  balances: Map<BalanceCellKey, BalanceCell>;
  requests: Map<string, TimeOffRequest>;
  nextRequestNumber: number;
};

type MockDbSuccess<T> = {
  ok: true;
  status: number;
  value: T;
};

type MockDbFailure = {
  ok: false;
  status: number;
  value: HcmErrorResponse;
};

export type MockDbResult<T> = MockDbSuccess<T> | MockDbFailure;

const leaveTypes = ["vacation", "sick", "personal"] as const;
const defaultEmployeeId = "emp-1001";

const globalStore = globalThis as typeof globalThis & {
  __exampleHrTimeOffMockDb?: MockDbState;
};

function nowIso(): string {
  return new Date().toISOString();
}

function balanceKey(employeeId: EmployeeId, leaveType: LeaveType): BalanceCellKey {
  return `${employeeId}:${leaveType}`;
}

function createBalance(
  employeeId: EmployeeId,
  employeeName: string,
  locationId: string,
  locationName: string,
  leaveType: LeaveType,
  available: number,
  annualAllowance: number,
): BalanceCell {
  return {
    employeeId,
    employeeName,
    locationId,
    locationName,
    leaveType,
    unit: "hours",
    available,
    pending: 0,
    used: 0,
    annualAllowance,
    version: 1,
    lastCalculatedAt: nowIso(),
    anniversaryBonusAppliedAt: null,
  };
}

function seedState(): MockDbState {
  const balances = new Map<BalanceCellKey, BalanceCell>();
  const seededBalances = [
    createBalance(defaultEmployeeId, "Maya Chen", "nyc", "New York", "vacation", 80, 120),
    createBalance(defaultEmployeeId, "Maya Chen", "nyc", "New York", "sick", 48, 80),
    createBalance(defaultEmployeeId, "Maya Chen", "nyc", "New York", "personal", 16, 24),
    createBalance("emp-2002", "Owen Rivera", "ldn", "London", "vacation", 40, 80),
    createBalance("emp-2002", "Owen Rivera", "ldn", "London", "sick", 32, 64),
    createBalance("emp-2002", "Owen Rivera", "ldn", "London", "personal", 8, 16),
    createBalance("emp-3003", "Sofia Patel", "aus", "Austin", "vacation", 64, 112),
    createBalance("emp-3003", "Sofia Patel", "aus", "Austin", "sick", 40, 72),
    createBalance("emp-3003", "Sofia Patel", "aus", "Austin", "personal", 20, 32),
    createBalance("emp-4004", "Leo Morgan", "tor", "Toronto", "vacation", 56, 96),
    createBalance("emp-4004", "Leo Morgan", "tor", "Toronto", "sick", 36, 64),
    createBalance("emp-4004", "Leo Morgan", "tor", "Toronto", "personal", 12, 24),
  ];

  for (const balance of seededBalances) {
    balances.set(balanceKey(balance.employeeId, balance.leaveType), balance);
  }

  const seededRequests: TimeOffRequest[] = [
    {
      id: "tor-0001",
      employeeId: defaultEmployeeId,
      leaveType: "vacation",
      startDate: "2026-07-01",
      endDate: "2026-07-03",
      requestedAmount: 8,
      status: "pending",
      reason: "School break coverage",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      version: 1,
      clientMutationId: null,
    },
    {
      id: "tor-0002",
      employeeId: "emp-2002",
      leaveType: "sick",
      startDate: "2026-07-09",
      endDate: "2026-07-10",
      requestedAmount: 8,
      status: "pending",
      reason: "Flu recovery",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      version: 1,
      clientMutationId: null,
    },
    {
      id: "tor-0003",
      employeeId: "emp-3003",
      leaveType: "personal",
      startDate: "2026-07-14",
      endDate: "2026-07-14",
      requestedAmount: 4,
      status: "pending",
      reason: "Registration appointment",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      version: 1,
      clientMutationId: null,
    },
  ];

  for (const seededRequest of seededRequests) {
    const seededRequestBalance = balances.get(
      balanceKey(seededRequest.employeeId, seededRequest.leaveType),
    );

    if (seededRequestBalance) {
      balances.set(
        balanceKey(seededRequest.employeeId, seededRequest.leaveType),
        bumpBalance(
          seededRequestBalance,
          -seededRequest.requestedAmount,
          seededRequest.requestedAmount,
          0,
        ),
      );
    }
  }

  return {
    balances,
    requests: new Map<string, TimeOffRequest>(
      seededRequests.map((seededRequest) => [seededRequest.id, seededRequest]),
    ),
    nextRequestNumber: seededRequests.length + 1,
  };
}

function getState(): MockDbState {
  if (!globalStore.__exampleHrTimeOffMockDb) {
    globalStore.__exampleHrTimeOffMockDb = seedState();
  }

  return globalStore.__exampleHrTimeOffMockDb;
}

function cloneBalance(balance: BalanceCell): BalanceCell {
  return { ...balance };
}

function cloneRequest(request: TimeOffRequest): TimeOffRequest {
  return { ...request };
}

function error(
  status: number,
  code: HcmErrorResponse["error"]["code"],
  message: string,
  field?: string,
  currentVersion?: number,
): MockDbFailure {
  return {
    ok: false,
    status,
    value: {
      error: {
        code,
        message,
        field,
        currentVersion,
      },
    },
  };
}

function success<T>(status: number, value: T): MockDbSuccess<T> {
  return { ok: true, status, value };
}

function readBalance(
  state: MockDbState,
  employeeId: EmployeeId,
  leaveType: LeaveType,
): BalanceCell | undefined {
  return state.balances.get(balanceKey(employeeId, leaveType));
}

function writeBalance(state: MockDbState, balance: BalanceCell): void {
  state.balances.set(balanceKey(balance.employeeId, balance.leaveType), balance);
}

function bumpBalance(
  balance: BalanceCell,
  deltaAvailable: number,
  deltaPending: number,
  deltaUsed: number,
): BalanceCell {
  return {
    ...balance,
    available: balance.available + deltaAvailable,
    pending: balance.pending + deltaPending,
    used: balance.used + deltaUsed,
    version: balance.version + 1,
    lastCalculatedAt: nowIso(),
  };
}

function nextRequestId(state: MockDbState): string {
  const id = `tor-${state.nextRequestNumber.toString().padStart(4, "0")}`;
  state.nextRequestNumber += 1;
  return id;
}

function alternateLeaveType(leaveType: LeaveType): LeaveType {
  return leaveType === "sick" ? "vacation" : "sick";
}

export function resetMockHcmDb(): void {
  globalStore.__exampleHrTimeOffMockDb = seedState();
}

export function listBalances(
  input?: Partial<BatchBalancesRequest>,
): BatchBalancesResponse {
  const state = getState();
  const employeeIds = input?.employeeIds;
  const requestedTypes = input?.leaveTypes;
  const balances = Array.from(state.balances.values()).filter((balance) => {
    const employeeMatches =
      !employeeIds || employeeIds.includes(balance.employeeId);
    const typeMatches =
      !requestedTypes || requestedTypes.includes(balance.leaveType);

    return employeeMatches && typeMatches;
  });

  return {
    balances: balances.map(cloneBalance),
    generatedAt: nowIso(),
  };
}

export function getAuthoritativeBalance(
  employeeId: EmployeeId,
  leaveType: LeaveType,
  triggerAnniversaryBonus: boolean,
): MockDbResult<AuthoritativeBalanceResponse> {
  const state = getState();
  const balance = readBalance(state, employeeId, leaveType);

  if (!balance) {
    return error(404, "NOT_FOUND", "Balance cell was not found.");
  }

  let nextBalance = balance;
  let triggeredBonus = false;

  if (triggerAnniversaryBonus && !balance.anniversaryBonusAppliedAt) {
    const appliedAt = nowIso();
    nextBalance = {
      ...balance,
      available: balance.available + 8,
      annualAllowance: balance.annualAllowance + 8,
      version: balance.version + 1,
      lastCalculatedAt: appliedAt,
      anniversaryBonusAppliedAt: appliedAt,
    };
    writeBalance(state, nextBalance);
    triggeredBonus = true;
  }

  return success(200, {
    balance: cloneBalance(nextBalance),
    generatedAt: nowIso(),
    triggeredBonus,
  });
}

export function listTimeOffRequests(employeeId?: EmployeeId): TimeOffRequestsResponse {
  const state = getState();
  const requests = Array.from(state.requests.values()).filter((request) => {
    return !employeeId || request.employeeId === employeeId;
  });

  return {
    requests: requests.map(cloneRequest),
    generatedAt: nowIso(),
  };
}

export function createTimeOffRequest(
  input: CreateTimeOffRequestInput,
): MockDbResult<TimeOffRequestWriteResponse> {
  const state = getState();
  const scenario = input.scenario ?? "normal";
  const balance = readBalance(state, input.employeeId, input.leaveType);

  if (input.requestedAmount <= 0) {
    return error(400, "BAD_REQUEST", "Requested amount must be positive.", "requestedAmount");
  }

  if (!balance) {
    return error(404, "NOT_FOUND", "Balance cell was not found.");
  }

  if (
    scenario === "conflict" ||
    (input.expectedBalanceVersion !== undefined &&
      input.expectedBalanceVersion !== balance.version)
  ) {
    return error(
      409,
      "CONFLICT",
      "Balance version changed before the request could be written.",
      "expectedBalanceVersion",
      balance.version,
    );
  }

  if (
    scenario === "insufficient-balance" ||
    input.requestedAmount > balance.available
  ) {
    return error(
      422,
      "INSUFFICIENT_BALANCE",
      "Requested amount exceeds the available balance.",
      "requestedAmount",
      balance.version,
    );
  }

  const storedLeaveType =
    scenario === "silent-wrong-mutation"
      ? alternateLeaveType(input.leaveType)
      : input.leaveType;
  const storedBalance = readBalance(state, input.employeeId, storedLeaveType);

  if (!storedBalance) {
    return error(404, "NOT_FOUND", "Mutation target balance cell was not found.");
  }

  const timestamp = nowIso();
  const requestId = nextRequestId(state);
  const storedRequest: TimeOffRequest = {
    id: requestId,
    employeeId: input.employeeId,
    leaveType: storedLeaveType,
    startDate: input.startDate,
    endDate: input.endDate,
    requestedAmount: input.requestedAmount,
    status: "pending",
    reason: input.reason,
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
    clientMutationId: input.clientMutationId ?? null,
  };

  const responseRequest: TimeOffRequest =
    scenario === "silent-wrong-mutation"
      ? { ...storedRequest, leaveType: input.leaveType }
      : storedRequest;

  state.requests.set(requestId, storedRequest);
  writeBalance(
    state,
    bumpBalance(storedBalance, -input.requestedAmount, input.requestedAmount, 0),
  );

  return success(201, {
    request: cloneRequest(responseRequest),
    generatedAt: nowIso(),
  });
}

export function approveTimeOffRequest(
  input: ApproveTimeOffRequestInput,
): MockDbResult<TimeOffRequestWriteResponse> {
  const state = getState();
  const request = state.requests.get(input.requestId);

  if (!request) {
    return error(404, "NOT_FOUND", "Time-off request was not found.", "requestId");
  }

  if (
    input.scenario === "conflict" ||
    (input.expectedRequestVersion !== undefined &&
      input.expectedRequestVersion !== request.version)
  ) {
    return error(
      409,
      "CONFLICT",
      "Request version changed before approval.",
      "expectedRequestVersion",
      request.version,
    );
  }

  if (request.status !== "pending") {
    return error(409, "CONFLICT", "Only pending requests can be approved.", "status", request.version);
  }

  const balance = readBalance(state, request.employeeId, request.leaveType);

  if (!balance) {
    return error(404, "NOT_FOUND", "Balance cell was not found.");
  }

  const timestamp = nowIso();
  const approvedRequest: TimeOffRequest = {
    ...request,
    status: "approved",
    updatedAt: timestamp,
    version: request.version + 1,
  };

  state.requests.set(request.id, approvedRequest);
  writeBalance(
    state,
    bumpBalance(balance, 0, -request.requestedAmount, request.requestedAmount),
  );

  return success(200, {
    request: cloneRequest(approvedRequest),
    generatedAt: nowIso(),
  });
}

export function denyTimeOffRequest(
  input: DenyTimeOffRequestInput,
): MockDbResult<TimeOffRequestWriteResponse> {
  const state = getState();
  const request = state.requests.get(input.requestId);

  if (!request) {
    return error(404, "NOT_FOUND", "Time-off request was not found.", "requestId");
  }

  if (
    input.scenario === "conflict" ||
    (input.expectedRequestVersion !== undefined &&
      input.expectedRequestVersion !== request.version)
  ) {
    return error(
      409,
      "CONFLICT",
      "Request version changed before denial.",
      "expectedRequestVersion",
      request.version,
    );
  }

  if (request.status !== "pending") {
    return error(409, "CONFLICT", "Only pending requests can be denied.", "status", request.version);
  }

  const balance = readBalance(state, request.employeeId, request.leaveType);

  if (!balance) {
    return error(404, "NOT_FOUND", "Balance cell was not found.");
  }

  const timestamp = nowIso();
  const deniedRequest: TimeOffRequest = {
    ...request,
    status: "rejected",
    reason: input.reason ? `${request.reason} | Denied: ${input.reason}` : request.reason,
    updatedAt: timestamp,
    version: request.version + 1,
  };

  state.requests.set(request.id, deniedRequest);
  writeBalance(
    state,
    bumpBalance(balance, request.requestedAmount, -request.requestedAmount, 0),
  );

  return success(200, {
    request: cloneRequest(deniedRequest),
    generatedAt: nowIso(),
  });
}

export function isLeaveType(value: string): value is LeaveType {
  return leaveTypes.some((leaveType) => leaveType === value);
}

export function defaultMockEmployeeId(): EmployeeId {
  return defaultEmployeeId;
}
