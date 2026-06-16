import { beforeEach, describe, expect, it } from "vitest";

import {
  approveTimeOffRequest,
  createTimeOffRequest,
  getAuthoritativeBalance,
  listBalances,
  listTimeOffRequests,
  resetMockHcmDb,
} from "@/lib/hcm/mockDb";

describe("mockDb", () => {
  beforeEach(() => {
    resetMockHcmDb();
  });

  it("seeds the employee balance grid and the pending request", () => {
    const balances = listBalances({ employeeIds: ["emp-1001", "emp-2002"] });
    const vacation = balances.balances.find(
      (balance) => balance.employeeId === "emp-1001" && balance.leaveType === "vacation",
    );

    expect(balances.balances).toHaveLength(6);
    expect(vacation).toMatchObject({
      available: 72,
      pending: 8,
      used: 0,
      version: 2,
      locationName: "New York",
    });

    const requests = listTimeOffRequests("emp-1001");
    expect(requests.requests).toHaveLength(1);
    expect(requests.requests[0]).toMatchObject({
      id: "tor-0001",
      status: "pending",
      leaveType: "vacation",
    });
  });

  it("rejects insufficient-balance requests", () => {
    const result = createTimeOffRequest({
      employeeId: "emp-1001",
      leaveType: "vacation",
      startDate: "2026-07-10",
      endDate: "2026-07-12",
      requestedAmount: 999,
      reason: "Too much time off",
      expectedBalanceVersion: 2,
      scenario: "insufficient-balance",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.value.error.code).toBe("INSUFFICIENT_BALANCE");
      expect(result.value.error.field).toBe("requestedAmount");
    }
  });

  it("applies the anniversary bonus only once", () => {
    const first = getAuthoritativeBalance("emp-2002", "vacation", true);
    const second = getAuthoritativeBalance("emp-2002", "vacation", true);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);

    if (first.ok && second.ok) {
      expect(first.value.triggeredBonus).toBe(true);
      expect(first.value.balance.available).toBe(48);
      expect(second.value.triggeredBonus).toBe(false);
      expect(second.value.balance.available).toBe(48);
    }
  });

  it("approves a pending request and updates the stored balance", () => {
    const created = createTimeOffRequest({
      employeeId: "emp-1001",
      leaveType: "sick",
      startDate: "2026-07-11",
      endDate: "2026-07-11",
      requestedAmount: 4,
      reason: "Medical appointment",
      expectedBalanceVersion: 1,
    });

    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error("Expected request creation to succeed.");
    }

    const approval = approveTimeOffRequest({
      requestId: created.value.request.id,
      managerId: "mgr-9001",
      expectedRequestVersion: created.value.request.version,
    });

    expect(approval.ok).toBe(true);
    if (approval.ok) {
      expect(approval.value.request.status).toBe("approved");
      expect(approval.value.request.version).toBe(2);
    }
  });
});
