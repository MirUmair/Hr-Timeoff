"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  AUTH_COOKIE_NAME,
  type DemoSession,
  getDemoSessionFromAccountId,
  getDemoSessionFromCredentials,
} from "@/lib/auth/demoSession";

const sessionMaxAgeSeconds = 60 * 60 * 8;

function sanitizeNextPath(value: FormDataEntryValue | null): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

function targetPathForSession(session: DemoSession, nextPath: string): string {
  if (session.role === "manager") {
    return nextPath === "/" ? "/manager" : nextPath;
  }

  return nextPath.startsWith("/manager") ? "/" : nextPath;
}

function loginErrorPath(nextPath: string): string {
  const params = new URLSearchParams({
    error: "invalid-credentials",
    next: nextPath,
  });

  return `/login?${params.toString()}`;
}

async function setSessionCookie(session: DemoSession): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set({
    name: AUTH_COOKIE_NAME,
    value: session.token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionMaxAgeSeconds,
  });
}

export async function signInWithCredentials(formData: FormData): Promise<void> {
  const username = formData.get("username");
  const password = formData.get("password");
  const nextPath = sanitizeNextPath(formData.get("next"));

  const session = getDemoSessionFromCredentials(
    typeof username === "string" ? username : null,
    typeof password === "string" ? password : null,
  );

  if (!session) {
    redirect(loginErrorPath(nextPath));
  }

  await setSessionCookie(session);
  redirect(targetPathForSession(session, nextPath));
}

export async function signInDemoAccount(formData: FormData): Promise<void> {
  const accountId = formData.get("accountId");
  const nextPath = sanitizeNextPath(formData.get("next"));

  const session = getDemoSessionFromAccountId(
    typeof accountId === "string" ? accountId : null,
  );

  if (!session) {
    redirect(loginErrorPath(nextPath));
  }

  await setSessionCookie(session);
  redirect(targetPathForSession(session, nextPath));
}
