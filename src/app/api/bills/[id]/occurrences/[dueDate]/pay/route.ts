import {
  errorResponse,
  fieldErrorsFrom,
  forbiddenResponse,
  isForbiddenOrigin,
  jsonResponse,
  readJsonBody,
  serviceErrorResponse,
} from "@/lib/api/respond";
import { billPayOccurrenceSchema } from "@/lib/schemas/bills";
import { payOccurrence } from "@/lib/services/bills";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; dueDate: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    if (isForbiddenOrigin(request)) {
      return forbiddenResponse();
    }
    const { id, dueDate } = await params;
    const body = await readJsonBody(request);
    if (!body.ok) {
      return body.response;
    }
    // The due date comes from the URL and overrides any dueDate in the body.
    const candidate =
      typeof body.body === "object" && body.body !== null ? { ...body.body, dueDate } : { dueDate };
    const parsed = billPayOccurrenceSchema.safeParse(candidate);
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Please correct the highlighted fields.",
        fieldErrorsFrom(parsed.error.issues),
      );
    }
    const data = await payOccurrence(id, parsed.data.dueDate, parsed.data);
    return jsonResponse({ success: true, data }, 201);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
