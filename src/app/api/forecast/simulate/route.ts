import { z } from "zod";
import {
  errorResponse,
  fieldErrorsFrom,
  forbiddenResponse,
  isForbiddenOrigin,
  jsonResponse,
  readJsonBody,
  serviceErrorResponse,
} from "@/lib/api/respond";
import { simulateDelay } from "@/lib/services/forecast";

export const runtime = "nodejs";

const simulateSchema = z.object({
  invoiceId: z.string().min(1),
  delayDays: z.number().int().min(1).max(365),
  horizonDays: z.union([z.literal(30), z.literal(60), z.literal(90)]),
});

export async function POST(request: Request) {
  try {
    if (isForbiddenOrigin(request)) {
      return forbiddenResponse();
    }
    const body = await readJsonBody(request);
    if (!body.ok) {
      return body.response;
    }
    const parsed = simulateSchema.safeParse(body.body);
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Please correct the highlighted fields.",
        fieldErrorsFrom(parsed.error.issues),
      );
    }
    const { invoiceId, delayDays, horizonDays } = parsed.data;
    const data = await simulateDelay(invoiceId, delayDays, horizonDays);
    return jsonResponse({ success: true, data });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
