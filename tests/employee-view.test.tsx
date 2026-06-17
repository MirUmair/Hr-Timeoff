/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EmployeeView } from "@/app/employee-view";
import { QueryProvider } from "@/app/query-provider";
import { resetDemoHcmData } from "@/lib/hcm/hcmClient";
import { listBalances, listTimeOffRequests, resetMockHcmDb } from "@/lib/hcm/mockDb";

vi.mock("@/lib/hcm/hcmClient", () => ({
  HcmClientError: class HcmClientError extends Error {},
  approveTimeOffRequest: vi.fn(),
  createTimeOffRequest: vi.fn(),
  fetchBalance: vi.fn(),
  fetchBalances: vi.fn(),
  fetchTimeOffRequests: vi.fn(),
  resetDemoHcmData: vi.fn(),
}));

describe("EmployeeView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the seeded employee balances and request queue", () => {
    resetMockHcmDb();
    const initialBalances = listBalances({ employeeIds: ["emp-1001", "emp-2002"] });
    const initialRequests = listTimeOffRequests();

    render(
      <QueryProvider>
        <EmployeeView
          employeeIds={["emp-1001", "emp-2002"]}
          initialBalances={initialBalances}
          initialRequests={initialRequests}
        />
      </QueryProvider>,
    );

    expect(screen.getByText("Time off control desk")).toBeInTheDocument();
    expect(screen.getAllByText("Maya Chen").length).toBeGreaterThan(0);
    expect(screen.getByText(/New York.*emp-1001/)).toBeInTheDocument();
    expect(screen.getByText(/School break coverage/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit request" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));

    expect(
      screen.getByRole("dialog", { name: "New time off request" }),
    ).toBeInTheDocument();
  });

  it("shows only the latest request and opens all requests in a dialog", () => {
    resetMockHcmDb();
    const initialBalances = listBalances({ employeeIds: ["emp-1001"] });
    const initialRequests = listTimeOffRequests("emp-1001");
    const seededRequest = initialRequests.requests[0];

    if (!seededRequest) {
      throw new Error("Expected seeded request for employee test.");
    }

    const latestRequest = {
      ...seededRequest,
      id: "tor-latest",
      reason: "Latest client demo",
      startDate: "2026-08-01",
      endDate: "2026-08-02",
      createdAt: "2026-07-20T10:00:00.000Z",
      updatedAt: "2026-07-20T10:00:00.000Z",
      version: 2,
    };

    render(
      <QueryProvider>
        <EmployeeView
          employeeIds={["emp-1001"]}
          initialBalances={initialBalances}
          initialRequests={{
            ...initialRequests,
            requests: [seededRequest, latestRequest],
          }}
        />
      </QueryProvider>,
    );

    expect(screen.getByText("Latest client demo")).toBeInTheDocument();
    expect(screen.queryByText("School break coverage")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /View all requests/i }));

    const dialog = screen.getByRole("dialog", { name: "All requests" });
    expect(within(dialog).getByText("Latest client demo")).toBeInTheDocument();
    expect(within(dialog).getByText("School break coverage")).toBeInTheDocument();
  });

  it("resets demo HCM data and refreshes visible requests", async () => {
    resetMockHcmDb();
    const initialBalances = listBalances({ employeeIds: ["emp-1001"] });
    const initialRequests = listTimeOffRequests("emp-1001");
    const seededRequest = initialRequests.requests[0];

    if (!seededRequest) {
      throw new Error("Expected seeded request for employee reset test.");
    }

    const temporaryRequest = {
      ...seededRequest,
      id: "tor-temporary",
      reason: "Temporary client test request",
      createdAt: "2026-07-21T10:00:00.000Z",
      updatedAt: "2026-07-21T10:00:00.000Z",
      version: 2,
    };

    vi.mocked(resetDemoHcmData).mockResolvedValue({
      balances: initialBalances.balances,
      requests: initialRequests.requests,
      generatedAt: "2026-07-21T11:00:00.000Z",
    });

    render(
      <QueryProvider>
        <EmployeeView
          employeeIds={["emp-1001"]}
          initialBalances={initialBalances}
          initialRequests={{
            ...initialRequests,
            requests: [seededRequest, temporaryRequest],
          }}
        />
      </QueryProvider>,
    );

    expect(screen.getByText("Temporary client test request")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reset demo data" }));

    await waitFor(() => expect(resetDemoHcmData).toHaveBeenCalledTimes(1));

    expect(screen.getByText("Demo HCM data reset to its starting position. just now")).toBeInTheDocument();
    expect(screen.getByText("School break coverage")).toBeInTheDocument();
    expect(screen.queryByText("Temporary client test request")).not.toBeInTheDocument();
  });
});
