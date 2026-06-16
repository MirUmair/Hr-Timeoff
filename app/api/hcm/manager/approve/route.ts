import { approveTimeOffRequest } from "@/lib/hcm/mockDb";
import type {
  ApproveTimeOffRequestInput,
  HcmErrorResponse,
} from "@/lib/types/request";

export const dynamic = "force-dynamic";

type ApprovalScenario = NonNullable<ApproveTimeOffRequestInput["scenario"]>;

const approvalScenarios = ["normal", "conflict"] as const satisfies ReadonlyArray<ApprovalScenario>;

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

function isApprovalScenario(value: string): value is ApprovalScenario {
  return approvalScenarios.some((scenario) => scenario === value);
}

function parseInput(body: unknown): ApproveTimeOffRequestInput | Response {
  if (!isRecord(body)) {
    return badRequest("Expected a JSON object.");
  }

  const requestId = optionalString(body.requestId);
  const managerId = optionalString(body.managerId);
  const scenario = optionalString(body.scenario);

  if (!requestId) {
    return badRequest("requestId is required.", "requestId");
  }

  if (!managerId) {
    return badRequest("managerId is required.", "managerId");
  }

  if (scenario && !isApprovalScenario(scenario)) {
    return badRequest("Only normal and conflict scenarios are supported.", "scenario");
  }

  const parsedScenario: ApprovalScenario | undefined =
    scenario && isApprovalScenario(scenario) ? scenario : undefined;

  return {
    requestId,
    managerId,
    expectedRequestVersion: optionalNumber(body.expectedRequestVersion),
    scenario: parsedScenario,
  };
}

export async function POST(request: Request): Promise<Response> {
  const input = parseInput((await request.json()) as unknown);

  if (input instanceof Response) {
    return input;
  }

  const result = approveTimeOffRequest(input);
  return Response.json(result.value, { status: result.status });
}
