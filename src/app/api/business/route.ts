import {
  errorResponse,
  fieldErrorsFrom,
  forbiddenResponse,
  isForbiddenOrigin,
  jsonResponse,
  readJsonBody,
  serviceErrorResponse,
} from "@/lib/api/respond";
import { prisma } from "@/lib/db/client";
import { businessInputSchema, toBusinessWriteData } from "@/lib/schemas/business";

export const runtime = "nodejs";

const BUSINESS_ID = "local-business";

function withRupees<T extends { openingCashPaise: number }>(row: T) {
  return { ...row, openingCashRupees: row.openingCashPaise / 100 };
}

export async function GET() {
  try {
    const row = await prisma.businessProfile.findUnique({ where: { id: BUSINESS_ID } });
    return jsonResponse({ success: true, data: row ? withRupees(row) : null });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  if (isForbiddenOrigin(request)) return forbiddenResponse();
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const parsed = businessInputSchema.safeParse(body.body);
  if (!parsed.success) {
    return errorResponse(
      "VALIDATION_ERROR",
      "Please correct the highlighted fields.",
      fieldErrorsFrom(parsed.error.issues),
    );
  }
  try {
    const data = toBusinessWriteData(parsed.data);
    const row = await prisma.businessProfile.upsert({
      where: { id: BUSINESS_ID },
      create: { id: BUSINESS_ID, ...data },
      update: data,
    });
    return jsonResponse({ success: true, data: withRupees(row) });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
