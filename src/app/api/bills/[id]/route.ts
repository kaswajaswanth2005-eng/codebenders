import {
  errorResponse,
  fieldErrorsFrom,
  forbiddenResponse,
  isForbiddenOrigin,
  jsonResponse,
  readJsonBody,
  serviceErrorResponse,
} from "@/lib/api/respond";
import { billPatchSchema, parseBillRange } from "@/lib/schemas/bills";
import { getBillDetail, updateBill } from "@/lib/services/bills";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const range = parseBillRange(url.searchParams.get("from"), url.searchParams.get("to"));
    if (!range.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Please correct the date range.",
        fieldErrorsFrom(range.error.issues),
      );
    }
    const data = await getBillDetail(id, range.data);
    return jsonResponse({ success: true, data });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

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
    const parsed = billPatchSchema.safeParse(body.body);
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Please correct the highlighted fields.",
        fieldErrorsFrom(parsed.error.issues),
      );
    }
    const data = await updateBill(id, parsed.data);
    return jsonResponse({ success: true, data });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
