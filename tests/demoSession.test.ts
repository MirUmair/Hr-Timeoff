import { describe, expect, it } from "vitest";

import {
  AUTH_COOKIE_NAME,
  getDemoSessionFromCookieHeader,
  getDemoSessionFromCredentials,
  getSessionTokenForAccount,
  listDemoAccounts,
} from "@/lib/auth/demoSession";

describe("demoSession", () => {
  it("exposes multiple dummy login accounts without public session tokens", () => {
    const accounts = listDemoAccounts();
    const employeeAccounts = accounts.filter((account) => account.role === "employee");
    const managerAccounts = accounts.filter((account) => account.role === "manager");

    expect(employeeAccounts).toHaveLength(4);
    expect(managerAccounts).toHaveLength(1);
    expect(employeeAccounts.every((account) => account.username && account.password)).toBe(true);
    expect(Object.hasOwn(accounts[0] ?? {}, "token")).toBe(false);
  });

  it("authenticates a student employee with dummy credentials", () => {
    const session = getDemoSessionFromCredentials(
      "OWEN.RIVERA@EXAMPLEHR.TEST",
      "Owen#2026",
    );

    expect(session).toMatchObject({
      accountId: "owen-rivera",
      role: "employee",
      userId: "emp-2002",
      employeeIds: ["emp-2002"],
    });
    expect(getDemoSessionFromCredentials("owen.rivera@examplehr.test", "wrong")).toBeNull();
  });

  it("authenticates the manager with access to every seeded employee", () => {
    const session = getDemoSessionFromCredentials(
      "avery.brooks@examplehr.test",
      "Manager#2026",
    );

    expect(session).toMatchObject({
      accountId: "avery-brooks",
      role: "manager",
      userId: "mgr-9001",
    });
    expect(session?.employeeIds).toEqual([
      "emp-1001",
      "emp-2002",
      "emp-3003",
      "emp-4004",
    ]);
  });

  it("resolves a demo session from an http cookie token", () => {
    const token = getSessionTokenForAccount("sofia-patel");
    const session = getDemoSessionFromCookieHeader(`${AUTH_COOKIE_NAME}=${token}`);

    expect(session).toMatchObject({
      accountId: "sofia-patel",
      role: "employee",
      userId: "emp-3003",
    });
  });
});
