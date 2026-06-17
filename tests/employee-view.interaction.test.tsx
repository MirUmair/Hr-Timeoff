/**
 * @vitest-environment jsdom
 */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EmployeeView } from "@/app/employee-view";
import { QueryProvider } from "@/app/query-provider";
import {
  createTimeOffRequest,
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

function installHcmFetchHarness(options?: { delayCreate?: boolean }) {
  const calls: HcmFetchCall[] = [];
  const createGate = createDeferred<void>();
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

    if (url.pathname === "/api/hcm/time-off-requests" && method === "POST") {
      if (options?.delayCreate) {
        await createGate.promise;
      }

      const result = createTimeOffRequest(body as Parameters<typeof createTimeOffRequest>[0]);
      return jsonResponse(result.value, result.status);
    }

    if (url.pathname === "/api/hcm/time-off-requests" && method === "GET") {
      return jsonResponse(
        listTimeOffRequests((url.searchParams.get("employeeId") ?? undefined) as
          | EmployeeId
          | undefined),
      );
    }

    if (url.pathname === "/api/hcm/balance" && method === "GET") {
      const result = getAuthoritativeBalance(
        url.searchParams.get("employeeId") as EmployeeId,
        url.searchParams.get("leaveType") as Parameters<typeof getAuthoritativeBalance>[1],
        url.searchParams.get("trigger") === "anniversary-bonus",
      );

      return jsonResponse(result.value, result.status);
    }

    if (url.pathname === "/api/hcm/balances" && method === "POST") {
      return jsonResponse(listBalances(body as Parameters<typeof listBalances>[0]));
    }

    throw new Error(`Unhandled HCM test request: ${method} ${url.pathname}`);
  });

  vi.stubGlobal("fetch", fetchMock);

  return {
    calls,
    fetchMock,
    releaseCreate: () => createGate.resolve(),
  };
}

function renderEmployeeView() {
  const employeeIds: EmployeeId[] = ["emp-1001"];

  render(
    <QueryProvider>
      <EmployeeView
        employeeIds={employeeIds}
        initialBalances={listBalances({ employeeIds })}
        initialRequests={listTimeOffRequests("emp-1001")}
      />
    </QueryProvider>,
  );
}

function vacationBalanceCard(): HTMLElement {
  const card = screen
    .getAllByText("Vacation")
    .map((element) => element.closest("article"))
    .find((element): element is HTMLElement => Boolean(element));

  if (!card) {
    throw new Error("Vacation balance card was not found.");
  }

  return card;
}

async function fillRequestForm(
  user: ReturnType<typeof userEvent.setup>,
  input: {
    hours: string;
    reason: string;
    scenario: string;
  },
) {
  await user.click(screen.getByRole("button", { name: "Submit request" }));
  const dialog = screen.getByRole("dialog", { name: "New time off request" });

  await user.selectOptions(within(dialog).getByLabelText("Leave type"), "vacation");
  await user.clear(within(dialog).getByLabelText("Start"));
  await user.type(within(dialog).getByLabelText("Start"), "2026-08-05");
  await user.clear(within(dialog).getByLabelText("End"));
  await user.type(within(dialog).getByLabelText("End"), "2026-08-06");
  await user.clear(within(dialog).getByLabelText("Hours"));
  await user.type(within(dialog).getByLabelText("Hours"), input.hours);
  await user.clear(within(dialog).getByLabelText("Reason"));
  await user.type(within(dialog).getByLabelText("Reason"), input.reason);
  await user.selectOptions(within(dialog).getByLabelText("HCM behavior"), input.scenario);

  return dialog;
}

describe("EmployeeView HCM interactions", () => {
  beforeEach(() => {
    resetMockHcmDb();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("submits a normal request with optimistic feedback and authoritative reconciliation", async () => {
    const user = userEvent.setup();
    const hcm = installHcmFetchHarness({ delayCreate: true });
    renderEmployeeView();

    const dialog = await fillRequestForm(user, {
      hours: "4",
      reason: "Client planning session",
      scenario: "normal",
    });

    await user.click(within(dialog).getByRole("button", { name: "Submit request" }));

    expect(await screen.findByText("Request submitted. Verifying with HCM... just now")).toBeInTheDocument();
    expect(within(vacationBalanceCard()).getByText("optimisticPending")).toBeInTheDocument();
    expect(screen.getByText("Client planning session")).toBeInTheDocument();
    expect(hcm.calls).toContainEqual(
      expect.objectContaining({
        method: "POST",
        path: "/api/hcm/time-off-requests",
      }),
    );

    hcm.releaseCreate();

    expect(
      await screen.findByText("Request submitted. Verifying with HCM... Complete. just now"),
    ).toBeInTheDocument();
    expect(hcm.calls).toContainEqual(
      expect.objectContaining({
        method: "GET",
        path: "/api/hcm/balance",
      }),
    );
    expect(screen.queryByRole("dialog", { name: "New time off request" })).not.toBeInTheDocument();
    expect(screen.getByText("Client planning session")).toBeInTheDocument();
    expect(screen.getByText("Authoritative HCM")).toBeInTheDocument();
    expect(within(vacationBalanceCard()).getByText("68")).toBeInTheDocument();
    expect(within(vacationBalanceCard()).getByText("12")).toBeInTheDocument();
  }, 10_000);

  it("rolls back optimistic balance and preserves form input on insufficient balance", async () => {
    const user = userEvent.setup();
    const hcm = installHcmFetchHarness({ delayCreate: true });
    renderEmployeeView();

    const dialog = await fillRequestForm(user, {
      hours: "4",
      reason: "Too many hours",
      scenario: "insufficient-balance",
    });

    await user.click(within(dialog).getByRole("button", { name: "Submit request" }));

    expect(await screen.findByText("Request submitted. Verifying with HCM... just now")).toBeInTheDocument();
    expect(within(vacationBalanceCard()).getByText("68")).toBeInTheDocument();

    hcm.releaseCreate();

    expect(
      await screen.findByText("Request rejected. Requested amount exceeds the available balance. just now"),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "New time off request" })).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Reason")).toHaveValue("Too many hours");
    expect(within(vacationBalanceCard()).getByText("72")).toBeInTheDocument();
    expect(within(vacationBalanceCard()).getByText("8")).toBeInTheDocument();
    expect(screen.queryByText("Too many hours", { selector: "p" })).not.toBeInTheDocument();
  }, 10_000);

  it("shows a reconciliation warning when HCM silently mutates a different balance cell", async () => {
    const user = userEvent.setup();
    installHcmFetchHarness();
    renderEmployeeView();

    const dialog = await fillRequestForm(user, {
      hours: "4",
      reason: "Silent wrong mutation demo",
      scenario: "silent-wrong-mutation",
    });

    await user.click(within(dialog).getByRole("button", { name: "Submit request" }));

    expect(
      await screen.findByText(
        "Conflict detected. HCM accepted the request, but the authoritative balance did not match the optimistic mutation. just now",
      ),
    ).toBeInTheDocument();
    expect(within(vacationBalanceCard()).getByText("conflicted")).toBeInTheDocument();
  }, 10_000);

  it("shows a recoverable conflict message when HCM rejects a stale write", async () => {
    const user = userEvent.setup();
    installHcmFetchHarness();
    renderEmployeeView();

    const dialog = await fillRequestForm(user, {
      hours: "4",
      reason: "Conflict scenario demo",
      scenario: "conflict",
    });

    await user.click(within(dialog).getByRole("button", { name: "Submit request" }));

    expect(
      await screen.findByText(
        "Request rejected. Balance version changed before the request could be written. just now",
      ),
    ).toBeInTheDocument();
    expect(within(vacationBalanceCard()).getByText("conflicted")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Reason")).toHaveValue("Conflict scenario demo");
  }, 10_000);
});
