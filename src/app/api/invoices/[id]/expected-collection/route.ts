import {
  errorResponse,
  fieldErrorsFrom,
  forbiddenResponse,
  isForbiddenOrigin,
  jsonResponse,
  readJsonBody,
  serviceErrorResponse,
} from "@/lib/api/respond";
import { expectedCollectionUpdateSchema } from "@/lib/schemas/invoices";
import { updateExpectedCollectionDate } from "@/lib/services/invoices";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: RouteContext) {
  if (isForbiddenOrigin(request)) return forbiddenResponse();
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const parsed = expectedCollectionUpdateSchema.safeParse(body.body);
  if (!parsed.success) {
    return errorResponse(
      "VALIDATION_ERROR",
      "Enter a valid expected collection date.",
      fieldErrorsFrom(parsed.error.issues),
    );
  }
  try {
    const { id } = await params;
    return jsonResponse({ success: true, data: await updateExpectedCollectionDate(id, parsed.data) });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
