/**
 * @vitest-environment jsdom
 */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ManagerView } from "@/app/manager/manager-view";
import { QueryProvider } from "@/app/query-provider";
import {
  approveTimeOffRequest,
  denyTimeOffRequest,
  getAuthoritativeBalance,
  listBalances,
  listTimeOffRequests,
  resetMockHcmDb,
} from "@/lib/hcm/mockDb";
import type { EmployeeId } from "@/lib/types/balance";

type HcmFetchCall = {
  method: string;
  path: string;
  body?: unknown;
};

type Deferred<T> = {
  promise: Promise<T>;
  reject: (reason?: unknown) => void;
  resolve: (value: T | PromiseLike<T>) => void;
};

function createDeferred<T>(): Deferred<T> {
  let reject!: (reason?: unknown) => void;
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return { promise, reject, resolve };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

function parseBody(init?: RequestInit): unknown {
  if (typeof init?.body !== "string") {
    return undefined;
  }

  return JSON.parse(init.body) as unknown;
}

function installHcmFetchHarness(options?: { delayBalance?: boolean }) {
  const calls: HcmFetchCall[] = [];
  const balanceGate = createDeferred<void>();
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const url = new URL(rawUrl, "http://localhost");
    const method = (init?.method ?? "GET").toUpperCase();
    const body = parseBody(init);

    calls.push({
      method,
      path: url.pathname,
      body,
    });

    if (url.pathname === "/api/hcm/balance" && method === "GET") {
      if (options?.delayBalance) {
        await balanceGate.promise;
      }

      const result = getAuthoritativeBalance(
        url.searchParams.get("employeeId") as EmployeeId,
        url.searchParams.get("leaveType") as "vacation" | "sick" | "personal",
        url.searchParams.get("trigger") === "anniversary-bonus",
      );

      return jsonResponse(result.value, result.status);
    }

    if (url.pathname === "/api/hcm/balances" && method === "POST") {
      return jsonResponse(listBalances(body as Parameters<typeof listBalances>[0]));
    }

    if (url.pathname === "/api/hcm/time-off-requests" && method === "GET") {
      return jsonResponse(listTimeOffRequests());
    }

    if (url.pathname === "/api/hcm/manager/approve" && method === "POST") {
      const result = approveTimeOffRequest(body as Parameters<typeof approveTimeOffRequest>[0]);
      return jsonResponse(result.value, result.status);
    }

    if (url.pathname === "/api/hcm/manager/deny" && method === "POST") {
      const result = denyTimeOffRequest(body as Parameters<typeof denyTimeOffRequest>[0]);
      return jsonResponse(result.value, result.status);
    }

    throw new Error(`Unhandled HCM test request: ${method} ${url.pathname}`);
  });

  vi.stubGlobal("fetch", fetchMock);

  return {
    calls,
    releaseBalance: () => balanceGate.resolve(),
  };
}

function renderManagerView() {
  const employeeIds: EmployeeId[] = ["emp-1001", "emp-2002", "emp-3003", "emp-4004"];

  render(
    <QueryProvider>
      <ManagerView
        employeeIds={employeeIds}
        initialBalances={listBalances({ employeeIds })}
        initialRequests={listTimeOffRequests()}
      />
    </QueryProvider>,
  );
}

function requestCardByReason(reason: string): HTMLElement {
  const text = screen.getByText((content) => content.includes(reason));
  const card = text.closest("article");

  if (!card) {
    throw new Error(`Request card not found for reason: ${reason}`);
  }

  return card;
}

describe("ManagerView HCM interactions", () => {
  beforeEach(() => {
    resetMockHcmDb();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders pending requests in the approval queue", () => {
    renderManagerView();

    expect(screen.getByText("Approval queue")).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes("School break coverage"))).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes("Flu recovery"))).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes("Registration appointment"))).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Verify and approve" })).toHaveLength(3);
    expect(screen.getAllByRole("button", { name: "Deny request" })).toHaveLength(3);
  });

  it("fetches the latest per-cell HCM balance before approving", async () => {
    const user = userEvent.setup();
    const hcm = installHcmFetchHarness({ delayBalance: true });
    renderManagerView();

    const requestCard = requestCardByReason("School break coverage");
    await user.selectOptions(within(requestCard).getByLabelText("HCM approval behavior"), "normal");
    await user.click(within(requestCard).getByRole("button", { name: "Verify and approve" }));

    expect(
      await screen.findByText(/Fetching latest per-cell HCM balance before approval\./),
    ).toBeInTheDocument();
    expect(hcm.calls[0]).toEqual(
      expect.objectContaining({
        method: "GET",
        path: "/api/hcm/balance",
      }),
    );

    hcm.releaseBalance();

    expect(await screen.findByText("tor-0001 - Vacation - 8 hours")).toBeInTheDocument();
    expect(screen.getByText("confirmed")).toBeInTheDocument();
    expect(hcm.calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      "GET /api/hcm/balance",
      "POST /api/hcm/manager/approve",
      "GET /api/hcm/balance",
    ]);

    const balanceResult = getAuthoritativeBalance("emp-1001", "vacation", false);
    if (!balanceResult.ok) {
      throw new Error(balanceResult.value.error.message);
    }

    expect(balanceResult.value.balance.available).toBe(72);
    expect(balanceResult.value.balance.pending).toBe(0);
    expect(balanceResult.value.balance.used).toBe(8);
  }, 10_000);

  it("blocks approval and shows a stale-balance warning when HCM changes the visible balance", async () => {
    const user = userEvent.setup();
    const hcm = installHcmFetchHarness();
    renderManagerView();

    const requestCard = requestCardByReason("School break coverage");
    await user.selectOptions(within(requestCard).getByLabelText("HCM approval behavior"), "balance-changed");
    await user.click(within(requestCard).getByRole("button", { name: "Verify and approve" }));

    expect(
      await screen.findByText(
        /Approval blocked\. HCM balance changed during verification; review the refreshed balance context first\./,
      ),
    ).toBeInTheDocument();
    expect(hcm.calls.map((call) => `${call.method} ${call.path}`)).toEqual(["GET /api/hcm/balance"]);
    expect(within(requestCard).getByText("80")).toBeInTheDocument();
    expect(within(requestCard).getByText("v3")).toBeInTheDocument();
  }, 10_000);

  it("succeeds on approval when the balance is stable", async () => {
    const user = userEvent.setup();
    const hcm = installHcmFetchHarness();
    renderManagerView();

    const requestCard = requestCardByReason("School break coverage");
    await user.selectOptions(within(requestCard).getByLabelText("HCM approval behavior"), "normal");
    await user.click(within(requestCard).getByRole("button", { name: "Verify and approve" }));

    expect(screen.getByText("tor-0001 - Vacation - 8 hours")).toBeInTheDocument();
    expect(screen.getByText("confirmed")).toBeInTheDocument();
    expect(screen.queryByText("School break coverage")).not.toBeInTheDocument();
    expect(hcm.calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      "GET /api/hcm/balance",
      "POST /api/hcm/manager/approve",
      "GET /api/hcm/balance",
    ]);
  }, 10_000);

  it("succeeds on denial and releases the pending balance", async () => {
    const user = userEvent.setup();
    const hcm = installHcmFetchHarness();
    renderManagerView();

    const requestCard = requestCardByReason("Flu recovery");
    await user.click(within(requestCard).getByRole("button", { name: "Deny request" }));

    expect(screen.getByText("tor-0002 - Sick - 8 hours")).toBeInTheDocument();
    expect(screen.getByText("denied")).toBeInTheDocument();
    expect(hcm.calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      "POST /api/hcm/manager/deny",
      "GET /api/hcm/balance",
    ]);

    const balanceResult = getAuthoritativeBalance("emp-2002", "sick", false);
    if (!balanceResult.ok) {
      throw new Error(balanceResult.value.error.message);
    }

    expect(balanceResult.value.balance.available).toBe(32);
    expect(balanceResult.value.balance.pending).toBe(0);
  }, 10_000);

  it("shows a recoverable conflict UI when HCM rejects the approval write", async () => {
    const user = userEvent.setup();
    const hcm = installHcmFetchHarness();
    renderManagerView();

    const requestCard = requestCardByReason("School break coverage");
    await user.selectOptions(within(requestCard).getByLabelText("HCM approval behavior"), "hcm-conflict");
    await user.click(within(requestCard).getByRole("button", { name: "Verify and approve" }));

    expect(
      await screen.findByText(
        /Recoverable conflict\. Request version changed before approval\. Refresh the queue and retry\./,
      ),
    ).toBeInTheDocument();
    expect(within(requestCard).getByText("conflict")).toBeInTheDocument();
    expect(screen.queryByText("tor-0001 - Vacation - 8 hours")).not.toBeInTheDocument();
    expect(hcm.calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      "GET /api/hcm/balance",
      "POST /api/hcm/manager/approve",
    ]);
  }, 10_000);
});
