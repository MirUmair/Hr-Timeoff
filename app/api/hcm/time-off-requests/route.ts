import {
  createTimeOffRequest,
  isLeaveType,
  listTimeOffRequests,
} from "@/lib/hcm/mockDb";
import type { EmployeeId } from "@/lib/types/balance";
import type {
  CreateTimeOffRequestInput,
  HcmErrorResponse,
  TimeOffMutationScenario,
} from "@/lib/types/request";

export const dynamic = "force-dynamic";

const mutationScenarios = [
  "normal",
  "insufficient-balance",
  "conflict",
  "silent-wrong-mutation",
] as const satisfies ReadonlyArray<TimeOffMutationScenario>;

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

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isMutationScenario(value: string): value is TimeOffMutationScenario {
  return mutationScenarios.some((scenario) => scenario === value);
}

function parseInput(body: unknown): CreateTimeOffRequestInput | Response {
  if (!isRecord(body)) {
    return badRequest("Expected a JSON object.");
  }

  const employeeId = optionalString(body.employeeId);
  const rawLeaveType = optionalString(body.leaveType);
  const startDate = optionalString(body.startDate);
  const endDate = optionalString(body.endDate);
  const requestedAmount = optionalNumber(body.requestedAmount);
  const reason = optionalString(body.reason);
  const rawScenario = optionalString(body.scenario);

  if (!employeeId) {
    return badRequest("employeeId is required.", "employeeId");
  }

  if (!rawLeaveType || !isLeaveType(rawLeaveType)) {
    return badRequest("A supported leaveType is required.", "leaveType");
  }

  if (!startDate) {
    return badRequest("startDate is required.", "startDate");
  }

  if (!endDate) {
    return badRequest("endDate is required.", "endDate");
  }

  if (requestedAmount === undefined) {
    return badRequest("requestedAmount must be a number.", "requestedAmount");
  }

  if (!reason) {
    return badRequest("reason is required.", "reason");
  }

  if (rawScenario && !isMutationScenario(rawScenario)) {
    return badRequest("scenario is not supported.", "scenario");
  }

  const scenario: TimeOffMutationScenario | undefined =
    rawScenario && isMutationScenario(rawScenario) ? rawScenario : undefined;

  return {
    employeeId,
    leaveType: rawLeaveType,
    startDate,
    endDate,
    requestedAmount,
    reason,
    expectedBalanceVersion: optionalNumber(body.expectedBalanceVersion),
    clientMutationId: optionalString(body.clientMutationId),
    scenario,
  };
}

export function GET(request: Request): Response {
  const url = new URL(request.url);
  const employeeId = url.searchParams.get("employeeId") as EmployeeId | null;

  return Response.json(listTimeOffRequests(employeeId ?? undefined));
}

export async function POST(request: Request): Promise<Response> {
  const input = parseInput((await request.json()) as unknown);

  if (input instanceof Response) {
    return input;
  }

  const result = createTimeOffRequest(input);
  return Response.json(result.value, { status: result.status });
}
