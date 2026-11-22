import {
  errorResponse,
  fieldErrorsFrom,
  forbiddenResponse,
  isForbiddenOrigin,
  jsonResponse,
  readJsonBody,
  serviceErrorResponse,
} from "@/lib/api/respond";
import { billInputSchema, parseBillRange } from "@/lib/schemas/bills";
import { createBill, listBillOccurrences } from "@/lib/services/bills";
import { addDaysISO, type OccurrenceStatus } from "@/lib/financial/bills";
import { todayKolkata } from "@/lib/financial/dates";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const statusParam = url.searchParams.get("status") ?? "";
    const statuses: readonly OccurrenceStatus[] = ["PAID", "OVERDUE", "UPCOMING"];
    if (statusParam !== "" && !statuses.includes(statusParam as OccurrenceStatus)) {
      return errorResponse("VALIDATION_ERROR", "Choose a valid bill status.", {
        status: ["Status must be PAID, OVERDUE or UPCOMING"],
      });
    }
    const defaultFrom = statusParam === "OVERDUE" ? addDaysISO(todayKolkata(), -365) : null;
    const defaultTo = statusParam === "OVERDUE" ? todayKolkata() : null;
    const range = parseBillRange(
      url.searchParams.get("from") ?? defaultFrom,
      url.searchParams.get("to") ?? defaultTo,
    );
    if (!range.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Please correct the date range.",
        fieldErrorsFrom(range.error.issues),
      );
    }
    const data = await listBillOccurrences(
      range.data,
      statusParam === "" ? undefined : (statusParam as OccurrenceStatus),
    );
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
    const parsed = billInputSchema.safeParse(body.body);
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Please correct the highlighted fields.",
        fieldErrorsFrom(parsed.error.issues),
      );
    }
    const data = await createBill(parsed.data);
    return jsonResponse({ success: true, data }, 201);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
