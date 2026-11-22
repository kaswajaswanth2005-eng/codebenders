import {
  forbiddenResponse,
  isForbiddenOrigin,
  jsonResponse,
  serviceErrorResponse,
} from "@/lib/api/respond";
import { issueInvoice } from "@/lib/services/invoices";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    if (isForbiddenOrigin(request)) {
      return forbiddenResponse();
    }
    const { id } = await params;
    const data = await issueInvoice(id);
    return jsonResponse({ success: true, data });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
