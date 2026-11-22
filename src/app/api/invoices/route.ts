import {
  errorResponse,
  fieldErrorsFrom,
  forbiddenResponse,
  isForbiddenOrigin,
  jsonResponse,
  readJsonBody,
  serviceErrorResponse,
} from "@/lib/api/respond";
import { invoiceDraftSchema } from "@/lib/schemas/invoices";
import { isValidISODate } from "@/lib/financial/dates";
import { createDraft, listInvoices, type InvoiceListFilters } from "@/lib/services/invoices";

export const runtime = "nodejs";

const STATUS_FILTERS = ["DRAFT", "ISSUED_UNPAID", "PARTIALLY_PAID", "PAID", "OVERDUE"] as const;

function isStatusFilter(value: string): value is (typeof STATUS_FILTERS)[number] {
  return (STATUS_FILTERS as readonly string[]).includes(value);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const statusParam = url.searchParams.get("status") ?? "";
    if (statusParam !== "" && !isStatusFilter(statusParam)) {
      return errorResponse("VALIDATION_ERROR", "Choose a valid status filter.", {
        status: ["Status must be one of DRAFT, ISSUED_UNPAID, PARTIALLY_PAID, PAID, OVERDUE"],
      });
    }
    const dueFrom = url.searchParams.get("dueFrom") || undefined;
    const dueTo = url.searchParams.get("dueTo") || undefined;
    if ((dueFrom && !isValidISODate(dueFrom)) || (dueTo && !isValidISODate(dueTo))) {
      return errorResponse("VALIDATION_ERROR", "Enter valid due-date filters.", {
        dueDate: ["Due dates must use valid YYYY-MM-DD dates"],
      });
    }
    if (dueFrom && dueTo && dueFrom > dueTo) {
      return errorResponse("VALIDATION_ERROR", "Due-from date must be on or before due-to date.", {
        dueTo: ["Due-to date must be on or after due-from date"],
      });
    }

    const filters: InvoiceListFilters = {
      status: statusParam === "" ? undefined : statusParam,
      customerId: url.searchParams.get("customerId") || undefined,
      search: url.searchParams.get("search") || undefined,
      dueFrom,
      dueTo,
    };
    const data = await listInvoices(filters);
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
    const parsed = invoiceDraftSchema.safeParse(body.body);
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Please correct the highlighted fields.",
        fieldErrorsFrom(parsed.error.issues),
      );
    }
    const data = await createDraft(parsed.data);
    return jsonResponse({ success: true, data }, 201);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
