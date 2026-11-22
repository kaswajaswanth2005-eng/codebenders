import {
  errorResponse,
  fieldErrorsFrom,
  forbiddenResponse,
  isForbiddenOrigin,
  jsonResponse,
  readJsonBody,
  serviceErrorResponse,
} from "@/lib/api/respond";
import { assistantQuerySchema } from "@/lib/schemas/assistant";
import { askAssistant } from "@/lib/services/assistant";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (isForbiddenOrigin(request)) return forbiddenResponse();
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const parsed = assistantQuerySchema.safeParse(body.body);
  if (!parsed.success) {
    return errorResponse(
      "VALIDATION_ERROR",
      "Enter a valid financial question.",
      fieldErrorsFrom(parsed.error.issues),
    );
  }
  try {
    return jsonResponse({
      success: true,
      data: await askAssistant(parsed.data.message, parsed.data.history ?? []),
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
