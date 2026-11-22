import {
  fieldErrorsFrom,
  forbiddenResponse,
  isForbiddenOrigin,
  jsonResponse,
  readJsonBody,
  serviceErrorResponse,
  errorResponse,
} from "@/lib/api/respond";
import { assistantConsentSchema } from "@/lib/schemas/assistant";
import { setAssistantConsent } from "@/lib/services/assistant";

export const runtime = "nodejs";

export async function PUT(request: Request) {
  if (isForbiddenOrigin(request)) return forbiddenResponse();
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const parsed = assistantConsentSchema.safeParse(body.body);
  if (!parsed.success) {
    return errorResponse(
      "VALIDATION_ERROR",
      "Please correct the highlighted fields.",
      fieldErrorsFrom(parsed.error.issues),
    );
  }
  try {
    return jsonResponse({ success: true, data: await setAssistantConsent(parsed.data.consent) });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
