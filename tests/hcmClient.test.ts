import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  HcmClientError,
  approveTimeOffRequest,
  createTimeOffRequest,
  denyTimeOffRequest,
  fetchBalance,
  fetchBalances,
  fetchTimeOffRequests,
  resetDemoHcmData,
} from "@/lib/hcm/hcmClient";

describe("hcmClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends batch balance requests to the expected endpoint", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          balances: [],
          generatedAt: "2026-06-16T00:00:00.000Z",
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );

    await fetchBalances({ employeeIds: ["emp-1001"] });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/hcm/balances",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("parses HCM error payloads into HcmClientError", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "CONFLICT",
            message: "Version mismatch.",
          },
        }),
        {
          status: 409,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );

    await expect(
      createTimeOffRequest({
        employeeId: "emp-1001",
        leaveType: "vacation",
        startDate: "2026-07-01",
        endDate: "2026-07-03",
        requestedAmount: 4,
        reason: "Trip",
      }),
    ).rejects.toBeInstanceOf(HcmClientError);
  });

  it("builds the authoritative balance and approval endpoints", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      return new Response(
        JSON.stringify({}),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    });

    await fetchBalance("emp-1001", "vacation", true);
    await fetchTimeOffRequests("emp-1001");
    await approveTimeOffRequest({
      requestId: "tor-0001",
      managerId: "mgr-9001",
      expectedRequestVersion: 1,
    });
    await denyTimeOffRequest({
      requestId: "tor-0002",
      managerId: "mgr-9001",
      expectedRequestVersion: 1,
      reason: "Coverage gap.",
    });
    await resetDemoHcmData();

    expect(fetchSpy.mock.calls[0]?.[0]).toContain("/api/hcm/balance?");
    expect(fetchSpy.mock.calls[1]?.[0]).toContain("/api/hcm/time-off-requests?employeeId=emp-1001");
    expect(fetchSpy.mock.calls[2]?.[0]).toBe("/api/hcm/manager/approve");
    expect(fetchSpy.mock.calls[3]?.[0]).toBe("/api/hcm/manager/deny");
    expect(fetchSpy.mock.calls[4]?.[0]).toBe("/api/hcm/reset");
  });
});
