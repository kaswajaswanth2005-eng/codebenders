import { jsonResponse, serviceErrorResponse } from "@/lib/api/respond";
import { getDashboardData } from "@/lib/services/dashboard";

export const runtime = "nodejs";

export async function GET() {
  try {
    return jsonResponse({ success: true, data: await getDashboardData(30) });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
