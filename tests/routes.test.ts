import { beforeEach, describe, expect, it } from "vitest";

import { GET as getAuthoritativeBalanceRoute } from "@/app/api/hcm/balance/route";
import { GET as getBatchBalancesRoute, POST as postBatchBalancesRoute } from "@/app/api/hcm/balances/route";
import { POST as postManagerApproveRoute } from "@/app/api/hcm/manager/approve/route";
import { POST as postManagerDenyRoute } from "@/app/api/hcm/manager/deny/route";
import { POST as postResetRoute } from "@/app/api/hcm/reset/route";
import { GET as getRequestsRoute, POST as postRequestsRoute } from "@/app/api/hcm/time-off-requests/route";
import {
  AUTH_COOKIE_NAME,
  type AuthRole,
  getSessionTokenForRole,
} from "@/lib/auth/demoSession";
import { resetMockHcmDb } from "@/lib/hcm/mockDb";

function authHeaders(role: AuthRole, init?: HeadersInit): Headers {
  const headers = new Headers(init);
  headers.set("cookie", `${AUTH_COOKIE_NAME}=${getSessionTokenForRole(role)}`);
  return headers;
}

describe("HCM routes", () => {
  beforeEach(() => {
    resetMockHcmDb();
  });

  it("rejects invalid authoritative balance requests", async () => {
    const response = getAuthoritativeBalanceRoute(
      new Request("http://localhost/api/hcm/balance?employeeId=emp-1001", {
        headers: authHeaders("employee"),
      }),
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
      new Request("http://localhost/api/hcm/balances?leaveTypes=vacation,unknown", {
        headers: authHeaders("manager"),
      }),
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
        headers: authHeaders("employee", {
          "content-type": "application/json",
        }),
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
        headers: authHeaders("manager", {
          "content-type": "application/json",
        }),
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
      new Request("http://localhost/api/hcm/time-off-requests?employeeId=emp-1001", {
        headers: authHeaders("employee"),
      }),
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
        headers: authHeaders("employee", {
          "content-type": "application/json",
        }),
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
        headers: authHeaders("manager", {
          "content-type": "application/json",
        }),
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
        headers: authHeaders("manager", {
          "content-type": "application/json",
        }),
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

  it("resets mock HCM data back to the seeded demo state", async () => {
    const createdResponse = await postRequestsRoute(
      new Request("http://localhost/api/hcm/time-off-requests", {
        method: "POST",
        headers: authHeaders("employee", {
          "content-type": "application/json",
        }),
        body: JSON.stringify({
          employeeId: "emp-1001",
          leaveType: "sick",
          startDate: "2026-07-21",
          endDate: "2026-07-21",
          requestedAmount: 4,
          reason: "Reset rehearsal",
          expectedBalanceVersion: 1,
        }),
      }),
    );

    expect(createdResponse.status).toBe(201);

    const resetResponse = postResetRoute(
      new Request("http://localhost/api/hcm/reset", {
        method: "POST",
        headers: authHeaders("employee"),
      }),
    );

    expect(resetResponse.status).toBe(200);
    const payload = (await resetResponse.json()) as {
      balances: Array<{ employeeId: string; leaveType: string; pending: number }>;
      requests: Array<{ id: string; reason: string }>;
    };

    expect(payload.requests).toHaveLength(1);
    expect(payload.requests[0]).toMatchObject({
      id: "tor-0001",
      reason: "School break coverage",
    });
    expect(
      payload.balances.find(
        (balance) => balance.employeeId === "emp-1001" && balance.leaveType === "vacation",
      ),
    ).toMatchObject({
      pending: 8,
    });
  });

  it("rejects unauthenticated manager decisions", async () => {
    const response = await postManagerApproveRoute(
      new Request("http://localhost/api/hcm/manager/approve", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          requestId: "tor-1001",
          managerId: "mgr-9001",
        }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "AUTHENTICATION_REQUIRED",
      },
    });
  });

  it("rejects employee sessions on manager decisions", async () => {
    const response = await postManagerApproveRoute(
      new Request("http://localhost/api/hcm/manager/approve", {
        method: "POST",
        headers: authHeaders("employee", {
          "content-type": "application/json",
        }),
        body: JSON.stringify({
          requestId: "tor-1001",
          managerId: "mgr-9001",
        }),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "FORBIDDEN",
      },
    });
  });

  it("prevents employees from reading another employee balance", async () => {
    const response = getAuthoritativeBalanceRoute(
      new Request("http://localhost/api/hcm/balance?employeeId=emp-2002&leaveType=vacation", {
        headers: authHeaders("employee"),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "FORBIDDEN",
      },
    });
  });
});
