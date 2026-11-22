import { forbiddenResponse, isForbiddenOrigin, jsonResponse, serviceErrorResponse } from "@/lib/api/respond";
import { archiveBill } from "@/lib/services/bills";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    if (isForbiddenOrigin(request)) {
      return forbiddenResponse();
    }
    const { id } = await params;
    const data = await archiveBill(id);
    return jsonResponse({ success: true, data });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
