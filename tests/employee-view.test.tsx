/**
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EmployeeView } from "@/app/employee-view";
import { QueryProvider } from "@/app/query-provider";
import { listBalances, listTimeOffRequests, resetMockHcmDb } from "@/lib/hcm/mockDb";

vi.mock("@/lib/hcm/hcmClient", () => ({
  HcmClientError: class HcmClientError extends Error {},
  approveTimeOffRequest: vi.fn(),
  createTimeOffRequest: vi.fn(),
  fetchBalance: vi.fn(),
  fetchBalances: vi.fn(),
  fetchTimeOffRequests: vi.fn(),
}));

describe("EmployeeView", () => {
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
  });
});
