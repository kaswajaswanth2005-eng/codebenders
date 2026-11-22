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
import { createCustomer, listCustomers } from "@/lib/services/customers";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const search = url.searchParams.get("search") ?? undefined;
    const includeArchived = url.searchParams.get("includeArchived") === "true";
    const data = await listCustomers({ search, includeArchived });
    return jsonResponse({ success: true, data });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    if (isForbiddenOrigin(request)) {
      return forbiddenResponse();
    }
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
    const customer = await createCustomer(parsed.data);
    return jsonResponse({ success: true, data: customer }, 201);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
