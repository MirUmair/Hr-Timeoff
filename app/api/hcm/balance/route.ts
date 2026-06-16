import {
  defaultMockEmployeeId,
  getAuthoritativeBalance,
  isLeaveType,
} from "@/lib/hcm/mockDb";
import type { EmployeeId } from "@/lib/types/balance";
import type { HcmErrorResponse } from "@/lib/types/request";

export const dynamic = "force-dynamic";

function badRequest(message: string, field?: string): Response {
  const payload: HcmErrorResponse = {
    error: {
      code: "BAD_REQUEST",
      message,
      field,
    },
  };

  return Response.json(payload, { status: 400 });
}

export function GET(request: Request): Response {
  const url = new URL(request.url);
  const employeeId = (url.searchParams.get("employeeId") ??
    defaultMockEmployeeId()) as EmployeeId;
  const rawLeaveType = url.searchParams.get("leaveType");

  if (!rawLeaveType || !isLeaveType(rawLeaveType)) {
    return badRequest("A supported leaveType query parameter is required.", "leaveType");
  }

  const result = getAuthoritativeBalance(
    employeeId,
    rawLeaveType,
    url.searchParams.get("trigger") === "anniversary-bonus",
  );

  return Response.json(result.value, { status: result.status });
}
