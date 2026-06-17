/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LoginPanel } from "@/app/login/login-panel";
import { listDemoAccounts } from "@/lib/auth/demoSession";

vi.mock("@/app/login/actions", () => ({
  signInDemoAccount: vi.fn(),
  signInWithCredentials: vi.fn(),
}));

describe("LoginPanel", () => {
  it("auto-fills student and manager dummy credentials", () => {
    render(
      <LoginPanel
        accounts={listDemoAccounts()}
        currentSession={null}
        nextPath="/"
      />,
    );

    expect(screen.getByLabelText("Email address")).toHaveValue(
      "maya.chen@examplehr.test",
    );
    expect(screen.getByLabelText("Password")).toHaveValue("Maya#2026");

    const owenCard = screen.getByText("Owen Rivera").closest("article");

    if (!owenCard) {
      throw new Error("Expected Owen account card to render.");
    }

    fireEvent.click(within(owenCard).getByRole("button", { name: /Owen Rivera/i }));

    expect(screen.getByLabelText("Email address")).toHaveValue(
      "owen.rivera@examplehr.test",
    );
    expect(screen.getByLabelText("Password")).toHaveValue("Owen#2026");

    const managerCard = screen.getByText("Avery Brooks").closest("article");

    if (!managerCard) {
      throw new Error("Expected manager account card to render.");
    }

    fireEvent.click(within(managerCard).getByRole("button", { name: /Avery Brooks/i }));

    expect(screen.getByLabelText("Email address")).toHaveValue(
      "avery.brooks@examplehr.test",
    );
    expect(screen.getByLabelText("Password")).toHaveValue("Manager#2026");
    expect(
      screen.getByRole("button", { name: "Continue as Avery Brooks" }),
    ).toBeInTheDocument();
  });
});
