import {
  errorResponse,
  fieldErrorsFrom,
  forbiddenResponse,
  isForbiddenOrigin,
  jsonResponse,
  readJsonBody,
  serviceErrorResponse,
} from "@/lib/api/respond";
import { assistantConfirmSchema } from "@/lib/schemas/assistant-actions";
import { confirmInvoiceCommand } from "@/lib/services/assistant-actions";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (isForbiddenOrigin(request)) {
      return forbiddenResponse();
    }
    const body = await readJsonBody(request);
    if (!body.ok) {
      return body.response;
    }
    const parsed = assistantConfirmSchema.safeParse(body.body);
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Please correct the highlighted fields.",
        fieldErrorsFrom(parsed.error.issues),
      );
    }
    const data = await confirmInvoiceCommand(parsed.data);
    return jsonResponse({ success: true, data }, 201);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
