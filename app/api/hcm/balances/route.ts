import { isLeaveType, listBalances } from "@/lib/hcm/mockDb";
import type { BatchBalancesRequest, EmployeeId, LeaveType } from "@/lib/types/balance";
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readStringArray(value: unknown): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    return undefined;
  }

  return value;
}

function parseLeaveTypes(value: unknown): LeaveType[] | undefined {
  const rawValues = readStringArray(value);

  if (!rawValues) {
    return undefined;
  }

  if (!rawValues.every(isLeaveType)) {
    return undefined;
  }

  return rawValues;
}

function parseCsv(value: string | null): string[] | undefined {
  if (!value) {
    return undefined;
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function GET(request: Request): Response {
  const url = new URL(request.url);
  const employeeIds = parseCsv(url.searchParams.get("employeeIds"));
  const rawLeaveTypes = parseCsv(url.searchParams.get("leaveTypes"));
  const leaveTypes = rawLeaveTypes?.filter(isLeaveType);

  if (rawLeaveTypes && rawLeaveTypes.length !== leaveTypes?.length) {
    return badRequest("One or more leave types are not supported.", "leaveTypes");
  }

  return Response.json(
    listBalances({
      employeeIds,
      leaveTypes,
    }),
  );
}

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as unknown;

  if (!isRecord(body)) {
    return badRequest("Expected a JSON object.");
  }

  const employeeIds = readStringArray(body.employeeIds);

  if (!employeeIds || employeeIds.length === 0) {
    return badRequest("employeeIds must be a non-empty string array.", "employeeIds");
  }

  const leaveTypes = parseLeaveTypes(body.leaveTypes);

  if (body.leaveTypes !== undefined && !leaveTypes) {
    return badRequest("leaveTypes must contain only supported leave types.", "leaveTypes");
  }

  const input: BatchBalancesRequest = {
    employeeIds: employeeIds as EmployeeId[],
    leaveTypes,
  };

  return Response.json(listBalances(input));
}
