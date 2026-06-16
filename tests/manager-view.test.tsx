/**
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ManagerView } from "@/app/manager/manager-view";
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

describe("ManagerView", () => {
  it("renders the pending approval queue and balance context", () => {
    resetMockHcmDb();
    const initialBalances = listBalances({ employeeIds: ["emp-1001", "emp-2002"] });
    const initialRequests = listTimeOffRequests();

    render(
      <QueryProvider>
        <ManagerView
          employeeIds={["emp-1001", "emp-2002"]}
          initialBalances={initialBalances}
          initialRequests={initialRequests}
        />
      </QueryProvider>,
    );

    expect(screen.getByText("Approval queue")).toBeInTheDocument();
    expect(screen.getByText("Verify latest HCM balance before every approval.")).toBeInTheDocument();
    expect(screen.getByText(/School break coverage/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verify and approve" })).toBeEnabled();
    expect(screen.getByRole("combobox", { name: /HCM approval behavior/i })).toBeInTheDocument();
  });
});
