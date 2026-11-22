import { errorResponse, jsonResponse, serviceErrorResponse } from "@/lib/api/respond";
import { FORECAST_HORIZONS, getForecast, type ForecastHorizon } from "@/lib/services/forecast";

export const runtime = "nodejs";

function isHorizon(value: number): value is ForecastHorizon {
  return (FORECAST_HORIZONS as readonly number[]).includes(value);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const raw = url.searchParams.get("horizon") ?? "30";
    const horizon = Number(raw);
    if (raw.trim() === "" || !isHorizon(horizon)) {
      return errorResponse("VALIDATION_ERROR", "Choose a forecast horizon of 30, 60 or 90 days.", {
        horizon: ["Horizon must be 30, 60 or 90"],
      });
    }
    const data = await getForecast(horizon);
    return jsonResponse({ success: true, data });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
