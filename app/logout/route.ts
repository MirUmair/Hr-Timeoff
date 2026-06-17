import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth/demoSession";

function clearSession(request: Request): Response {
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}

export function GET(request: Request): Response {
  return clearSession(request);
}

export function POST(request: Request): Response {
  return clearSession(request);
}
