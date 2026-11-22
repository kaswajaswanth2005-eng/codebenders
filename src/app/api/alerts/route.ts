import { jsonResponse, serviceErrorResponse } from "@/lib/api/respond";
import { getDashboardData } from "@/lib/services/dashboard";

export const runtime = "nodejs";

export async function GET() {
  try {
    const dashboard = await getDashboardData(30);
    return jsonResponse({ success: true, data: dashboard.alerts });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
