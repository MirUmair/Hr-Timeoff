import { authErrorResponse, requireRouteRole } from "@/lib/auth/demoSession";
import { denyTimeOffRequest } from "@/lib/hcm/mockDb";
import type {
  DenyTimeOffRequestInput,
  HcmErrorResponse,
} from "@/lib/types/request";

export const dynamic = "force-dynamic";

type DenialScenario = NonNullable<DenyTimeOffRequestInput["scenario"]>;

const denialScenarios = ["normal", "conflict"] as const satisfies ReadonlyArray<DenialScenario>;

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

function isDenialScenario(value: string): value is DenialScenario {
  return denialScenarios.some((scenario) => scenario === value);
}

function parseInput(body: unknown): DenyTimeOffRequestInput | Response {
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

  if (scenario && !isDenialScenario(scenario)) {
    return badRequest("Only normal and conflict scenarios are supported.", "scenario");
  }

  const parsedScenario: DenialScenario | undefined =
    scenario && isDenialScenario(scenario) ? scenario : undefined;

  return {
    requestId,
    managerId,
    expectedRequestVersion: optionalNumber(body.expectedRequestVersion),
    reason: optionalString(body.reason),
    scenario: parsedScenario,
  };
}

export async function POST(request: Request): Promise<Response> {
  const session = requireRouteRole(request, "manager");

  if (session instanceof Response) {
    return session;
  }

  const input = parseInput((await request.json()) as unknown);

  if (input instanceof Response) {
    return input;
  }

  if (input.managerId !== session.userId) {
    return authErrorResponse(403, "Manager ID must match the signed-in manager session.");
  }

  const result = denyTimeOffRequest(input);
  return Response.json(result.value, { status: result.status });
}
