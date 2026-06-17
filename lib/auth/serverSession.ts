import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  AUTH_COOKIE_NAME,
  type AuthRole,
  type DemoSession,
  getDemoSessionFromToken,
} from "@/lib/auth/demoSession";

export async function getCurrentSession(): Promise<DemoSession | null> {
  const cookieStore = await cookies();
  return getDemoSessionFromToken(cookieStore.get(AUTH_COOKIE_NAME)?.value);
}

export async function requireRole(
  role: AuthRole,
  nextPath: string,
): Promise<DemoSession> {
  const session = await getCurrentSession();

  if (!session) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  if (session.role !== role) {
    redirect(session.role === "manager" ? "/manager" : "/");
  }

  return session;
}

export async function requireEmployeeSession(): Promise<DemoSession> {
  return requireRole("employee", "/");
}

export async function requireManagerSession(): Promise<DemoSession> {
  return requireRole("manager", "/manager");
}
