import { requireRouteSession } from "@/lib/auth/demoSession";
import {
  listBalances,
  listTimeOffRequests,
  resetMockHcmDb,
} from "@/lib/hcm/mockDb";
import type { HcmResetResponse } from "@/lib/types/request";

export const dynamic = "force-dynamic";

export function POST(request: Request): Response {
  const session = requireRouteSession(request);

  if (session instanceof Response) {
    return session;
  }

  resetMockHcmDb();

  const balancesResponse = listBalances({
    employeeIds: session.role === "employee" ? session.employeeIds : undefined,
  });
  const requestsResponse =
    session.role === "manager"
      ? listTimeOffRequests()
      : listTimeOffRequests(session.userId);
  const payload: HcmResetResponse = {
    balances: balancesResponse.balances,
    requests: requestsResponse.requests,
    generatedAt: balancesResponse.generatedAt,
  };

  return Response.json(payload);
}
