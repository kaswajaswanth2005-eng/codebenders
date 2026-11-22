import {
  errorResponse,
  fieldErrorsFrom,
  forbiddenResponse,
  isForbiddenOrigin,
  jsonResponse,
  readJsonBody,
  serviceErrorResponse,
} from "@/lib/api/respond";
import { invoicePaymentSchema } from "@/lib/schemas/invoices";
import { recordPayment } from "@/lib/services/invoices";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * 201 for a newly recorded payment; 200 when the idempotency key replays an identical payment.
 */
export async function POST(request: Request, { params }: RouteContext) {
  try {
    if (isForbiddenOrigin(request)) {
      return forbiddenResponse();
    }
    const { id } = await params;
    const body = await readJsonBody(request);
    if (!body.ok) {
      return body.response;
    }
    const parsed = invoicePaymentSchema.safeParse(body.body);
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Please correct the highlighted fields.",
        fieldErrorsFrom(parsed.error.issues),
      );
    }
    const result = await recordPayment(id, parsed.data);
    return jsonResponse({ success: true, data: result }, result.replayed ? 200 : 201);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
