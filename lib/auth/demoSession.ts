import type { EmployeeId } from "@/lib/types/balance";
import type { HcmErrorResponse } from "@/lib/types/request";

export const AUTH_COOKIE_NAME = "examplehr_session";

export type AuthRole = "employee" | "manager";

export type DemoSession = {
  accountId: string;
  token: string;
  role: AuthRole;
  userId: EmployeeId;
  name: string;
  title: string;
  username: string;
  employeeIds: EmployeeId[];
};

export type DemoLoginAccount = Omit<DemoSession, "token"> & {
  password: string;
  location: string;
  description: string;
};

type DemoAccount = DemoLoginAccount & {
  token: string;
};

const demoAccounts: DemoAccount[] = [
  {
    accountId: "maya-chen",
    token: "demo-employee-maya",
    role: "employee",
    userId: "emp-1001",
    name: "Maya Chen",
    title: "Student employee",
    username: "maya.chen@examplehr.test",
    password: "Maya#2026",
    employeeIds: ["emp-1001"],
    location: "New York",
    description: "Own balance view with a seeded vacation request.",
  },
  {
    accountId: "owen-rivera",
    token: "demo-employee-owen",
    role: "employee",
    userId: "emp-2002",
    name: "Owen Rivera",
    title: "Student employee",
    username: "owen.rivera@examplehr.test",
    password: "Owen#2026",
    employeeIds: ["emp-2002"],
    location: "London",
    description: "Own balance view with a seeded sick leave request.",
  },
  {
    accountId: "sofia-patel",
    token: "demo-employee-sofia",
    role: "employee",
    userId: "emp-3003",
    name: "Sofia Patel",
    title: "Student employee",
    username: "sofia.patel@examplehr.test",
    password: "Sofia#2026",
    employeeIds: ["emp-3003"],
    location: "Austin",
    description: "Own balance view with a seeded personal request.",
  },
  {
    accountId: "leo-morgan",
    token: "demo-employee-leo",
    role: "employee",
    userId: "emp-4004",
    name: "Leo Morgan",
    title: "Student employee",
    username: "leo.morgan@examplehr.test",
    password: "Leo#2026",
    employeeIds: ["emp-4004"],
    location: "Toronto",
    description: "Clean starter account with no pending requests.",
  },
  {
    accountId: "avery-brooks",
    token: "demo-manager-avery",
    role: "manager",
    userId: "mgr-9001",
    name: "Avery Brooks",
    title: "Time-off manager",
    username: "avery.brooks@examplehr.test",
    password: "Manager#2026",
    employeeIds: ["emp-1001", "emp-2002", "emp-3003", "emp-4004"],
    location: "Global queue",
    description: "Reviews every student employee request with live HCM balance context.",
  },
];

function toSession(account: DemoAccount): DemoSession {
  return {
    accountId: account.accountId,
    token: account.token,
    role: account.role,
    userId: account.userId,
    name: account.name,
    title: account.title,
    username: account.username,
    employeeIds: account.employeeIds,
  };
}

export function isAuthRole(value: unknown): value is AuthRole {
  return value === "employee" || value === "manager";
}

export function getSessionTokenForRole(role: AuthRole): string {
  const account = demoAccounts.find((candidate) => candidate.role === role);

  if (!account) {
    throw new Error(`No demo ${role} account is configured.`);
  }

  return account.token;
}

export function getSessionTokenForAccount(accountId: string): string {
  const account = demoAccounts.find((candidate) => candidate.accountId === accountId);

  if (!account) {
    throw new Error(`No demo account is configured for ${accountId}.`);
  }

  return account.token;
}

export function listDemoAccounts(): DemoLoginAccount[] {
  return demoAccounts.map((account) => ({
    accountId: account.accountId,
    role: account.role,
    userId: account.userId,
    name: account.name,
    title: account.title,
    username: account.username,
    employeeIds: [...account.employeeIds],
    password: account.password,
    location: account.location,
    description: account.description,
  }));
}

export function getDemoSessionFromToken(token?: string | null): DemoSession | null {
  if (!token) {
    return null;
  }

  const account = demoAccounts.find((candidate) => candidate.token === token);
  return account ? toSession(account) : null;
}

export function getDemoSessionFromAccountId(accountId?: string | null): DemoSession | null {
  if (!accountId) {
    return null;
  }

  const account = demoAccounts.find((candidate) => candidate.accountId === accountId);
  return account ? toSession(account) : null;
}

export function getDemoSessionFromCredentials(
  username?: string | null,
  password?: string | null,
): DemoSession | null {
  if (!username || !password) {
    return null;
  }

  const normalizedUsername = username.trim().toLowerCase();
  const account = demoAccounts.find(
    (candidate) =>
      candidate.username.toLowerCase() === normalizedUsername &&
      candidate.password === password,
  );

  return account ? toSession(account) : null;
}

export function getDemoSessionFromCookieHeader(
  cookieHeader?: string | null,
): DemoSession | null {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
  const sessionCookie = cookies.find((cookie) =>
    cookie.startsWith(`${AUTH_COOKIE_NAME}=`),
  );

  if (!sessionCookie) {
    return null;
  }

  const [, rawToken = ""] = sessionCookie.split("=");
  return getDemoSessionFromToken(decodeURIComponent(rawToken));
}

export function canAccessEmployee(
  session: DemoSession,
  employeeId: EmployeeId,
): boolean {
  return session.role === "manager" || session.employeeIds.includes(employeeId);
}

export function authErrorResponse(status: 401 | 403, message: string): Response {
  const payload: HcmErrorResponse = {
    error: {
      code: status === 401 ? "AUTHENTICATION_REQUIRED" : "FORBIDDEN",
      message,
    },
  };

  return Response.json(payload, { status });
}

export function requireRouteSession(request: Request): DemoSession | Response {
  const session = getDemoSessionFromCookieHeader(request.headers.get("cookie"));

  if (!session) {
    return authErrorResponse(401, "Sign in before using the HCM API.");
  }

  return session;
}

export function requireRouteRole(
  request: Request,
  role: AuthRole,
): DemoSession | Response {
  const session = requireRouteSession(request);

  if (session instanceof Response) {
    return session;
  }

  if (session.role !== role) {
    return authErrorResponse(403, `${role} access is required.`);
  }

  return session;
}
