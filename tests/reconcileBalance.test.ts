import { describe, expect, it } from "vitest";

import { reconcileBalance } from "@/lib/reconciliation/reconcileBalance";
import type { BalanceCell } from "@/lib/types/balance";

function buildBalance(overrides: Partial<BalanceCell> = {}): BalanceCell {
  return {
    employeeId: "emp-1001",
    employeeName: "Maya Chen",
    locationId: "nyc",
    locationName: "New York",
    leaveType: "vacation",
    unit: "hours",
    available: 72,
    pending: 8,
    used: 40,
    annualAllowance: 120,
    version: 2,
    lastCalculatedAt: "2026-06-16T00:00:00.000Z",
    anniversaryBonusAppliedAt: null,
    ...overrides,
  };
}

describe("reconcileBalance", () => {
  it("keeps an in-sync authoritative balance unchanged", () => {
    const optimistic = buildBalance();
    const authoritative = buildBalance();

    expect(reconcileBalance(optimistic, authoritative)).toEqual({
      balance: authoritative,
      status: "in-sync",
      changedFields: [],
    });
  });

  it("marks stale optimistic balances when the optimistic version is newer", () => {
    const optimistic = buildBalance({ version: 4, available: 64 });
    const authoritative = buildBalance({ version: 3, available: 72 });

    const result = reconcileBalance(optimistic, authoritative);

    expect(result.status).toBe("stale-optimistic-balance");
    expect(result.balance).toBe(authoritative);
    expect(result.changedFields).toEqual(["available", "version"]);
  });

  it("marks authoritative overwrites when the server moves forward", () => {
    const optimistic = buildBalance({ version: 2, pending: 4 });
    const authoritative = buildBalance({ version: 5, pending: 12 });

    const result = reconcileBalance(optimistic, authoritative);

    expect(result.status).toBe("authoritative-overwrite");
    expect(result.changedFields).toContain("pending");
    expect(result.changedFields).toContain("version");
  });
});
