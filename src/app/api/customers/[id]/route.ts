import {
  errorResponse,
  fieldErrorsFrom,
  forbiddenResponse,
  isForbiddenOrigin,
  jsonResponse,
  readJsonBody,
  serviceErrorResponse,
} from "@/lib/api/respond";
import { customerInputSchema } from "@/lib/schemas/customers";
import { getCustomerDetail, updateCustomer } from "@/lib/services/customers";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const data = await getCustomerDetail(id);
    return jsonResponse({ success: true, data });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

/**
 * PATCH takes the full customer form (same shape as create); empty optional fields are cleared.
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    if (isForbiddenOrigin(request)) {
      return forbiddenResponse();
    }
    const { id } = await params;
    const body = await readJsonBody(request);
    if (!body.ok) {
      return body.response;
    }
    const parsed = customerInputSchema.safeParse(body.body);
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Please correct the highlighted fields.",
        fieldErrorsFrom(parsed.error.issues),
      );
    }
    const data = await updateCustomer(id, parsed.data);
    return jsonResponse({ success: true, data });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
