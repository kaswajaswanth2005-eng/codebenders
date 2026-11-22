import { jsonResponse, serviceErrorResponse } from "@/lib/api/respond";
import { getAssistantStatus } from "@/lib/services/assistant";

export const runtime = "nodejs";

export async function GET() {
  try {
    return jsonResponse({ success: true, data: await getAssistantStatus() });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
