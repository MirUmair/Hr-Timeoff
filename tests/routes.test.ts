import { beforeEach, describe, expect, it } from "vitest";

import { GET as getAuthoritativeBalanceRoute } from "@/app/api/hcm/balance/route";
import { GET as getBatchBalancesRoute, POST as postBatchBalancesRoute } from "@/app/api/hcm/balances/route";
import { POST as postManagerApproveRoute } from "@/app/api/hcm/manager/approve/route";
import { POST as postManagerDenyRoute } from "@/app/api/hcm/manager/deny/route";
import { GET as getRequestsRoute, POST as postRequestsRoute } from "@/app/api/hcm/time-off-requests/route";
import { resetMockHcmDb } from "@/lib/hcm/mockDb";

describe("HCM routes", () => {
  beforeEach(() => {
    resetMockHcmDb();
  });

  it("rejects invalid authoritative balance requests", async () => {
    const response = getAuthoritativeBalanceRoute(
      new Request("http://localhost/api/hcm/balance?employeeId=emp-1001"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "BAD_REQUEST",
        field: "leaveType",
      },
    });
  });

  it("rejects invalid batch balance filters", async () => {
    const response = getBatchBalancesRoute(
      new Request("http://localhost/api/hcm/balances?leaveTypes=vacation,unknown"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "BAD_REQUEST",
        field: "leaveTypes",
      },
    });
  });

  it("creates and approves a request through the route handlers", async () => {
    const createdResponse = await postRequestsRoute(
      new Request("http://localhost/api/hcm/time-off-requests", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          employeeId: "emp-1001",
          leaveType: "sick",
          startDate: "2026-07-11",
          endDate: "2026-07-11",
          requestedAmount: 4,
          reason: "Medical appointment",
          expectedBalanceVersion: 1,
        }),
      }),
    );

    expect(createdResponse.status).toBe(201);
    const createdPayload = (await createdResponse.json()) as {
      request: { id: string; status: string; version: number };
    };
    expect(createdPayload.request.status).toBe("pending");

    const approvalResponse = await postManagerApproveRoute(
      new Request("http://localhost/api/hcm/manager/approve", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          requestId: createdPayload.request.id,
          managerId: "mgr-9001",
          expectedRequestVersion: createdPayload.request.version,
        }),
      }),
    );

    expect(approvalResponse.status).toBe(200);
    const approvalPayload = (await approvalResponse.json()) as {
      request: { status: string; version: number };
    };
    expect(approvalPayload.request.status).toBe("approved");
    expect(approvalPayload.request.version).toBeGreaterThan(createdPayload.request.version);

    const requestsResponse = getRequestsRoute(
      new Request("http://localhost/api/hcm/time-off-requests?employeeId=emp-1001"),
    );
    const requestsPayload = (await requestsResponse.json()) as {
      requests: Array<{ id: string; status: string }>;
    };

    expect(requestsPayload.requests.some((request) => request.status === "approved")).toBe(true);
  });

  it("creates and denies a request through the route handlers", async () => {
    const createdResponse = await postRequestsRoute(
      new Request("http://localhost/api/hcm/time-off-requests", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          employeeId: "emp-1001",
          leaveType: "personal",
          startDate: "2026-07-18",
          endDate: "2026-07-18",
          requestedAmount: 4,
          reason: "Appointment",
          expectedBalanceVersion: 1,
        }),
      }),
    );

    expect(createdResponse.status).toBe(201);
    const createdPayload = (await createdResponse.json()) as {
      request: { id: string; status: string; version: number };
    };

    const denialResponse = await postManagerDenyRoute(
      new Request("http://localhost/api/hcm/manager/deny", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          requestId: createdPayload.request.id,
          managerId: "mgr-9001",
          expectedRequestVersion: createdPayload.request.version,
          reason: "Coverage gap.",
        }),
      }),
    );

    expect(denialResponse.status).toBe(200);
    const denialPayload = (await denialResponse.json()) as {
      request: { status: string; version: number; reason: string };
    };
    expect(denialPayload.request.status).toBe("rejected");
    expect(denialPayload.request.version).toBeGreaterThan(createdPayload.request.version);
    expect(denialPayload.request.reason).toContain("Denied: Coverage gap.");
  });

  it("returns the batch balance corpus", async () => {
    const response = await postBatchBalancesRoute(
      new Request("http://localhost/api/hcm/balances", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          employeeIds: ["emp-1001", "emp-2002"],
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { balances: Array<{ employeeId: string }> };
    expect(payload.balances).toHaveLength(6);
    expect(payload.balances.map((balance) => balance.employeeId)).toContain("emp-1001");
  });
});
