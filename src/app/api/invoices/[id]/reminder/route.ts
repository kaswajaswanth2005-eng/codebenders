import { jsonResponse, serviceErrorResponse } from "@/lib/api/respond";
import { buildReminderText } from "@/lib/services/invoices";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Returns a draft reminder text. Read-only: nothing is sent or stored.
 * text is null when nothing is outstanding.
 */
export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const text = await buildReminderText(id);
    return jsonResponse({ success: true, data: { text } });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
