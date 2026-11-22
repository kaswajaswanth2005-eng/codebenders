import { NextResponse } from "next/server";
import { ServiceError, type ServiceErrorCode } from "@/lib/services/errors";

export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

type EnvelopeCode =
  | ServiceErrorCode
  | "FORBIDDEN"
  | "BAD_REQUEST"
  | "PAYLOAD_TOO_LARGE"
  | "INTERNAL_ERROR";

const STATUS_BY_CODE: Record<EnvelopeCode, number> = {
  VALIDATION_ERROR: 400,
  BAD_REQUEST: 400,
  PAYLOAD_TOO_LARGE: 413,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  DOMAIN_RULE: 422,
  SERVICE_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};

export function jsonResponse(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    },
  });
}

export function errorResponse(
  code: EnvelopeCode,
  message: string,
  fields?: Record<string, string[]>,
): NextResponse {
  return jsonResponse(
    {
      success: false,
      error: fields ? { code, message, fields } : { code, message },
    },
    STATUS_BY_CODE[code],
  );
}

/**
 * Maps any thrown value to the envelope. Unknown errors become a generic 500 with no detail.
 */
export function serviceErrorResponse(error: unknown): NextResponse {
  if (error instanceof ServiceError) {
    return errorResponse(error.code, error.message, error.fields);
  }
  return errorResponse("INTERNAL_ERROR", GENERIC_ERROR_MESSAGE);
}

function isLocalOrigin(origin: string): boolean {
  try {
    const { protocol, hostname, port } = new URL(origin);
    return (
      protocol === "http:" &&
      port === "3000" &&
      (hostname === "localhost" || hostname === "127.0.0.1")
    );
  } catch {
    return false;
  }
}

/**
 * True when the request carries an Origin header that is not localhost or 127.0.0.1.
 */
export function isForbiddenOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && !isLocalOrigin(origin);
}

export function forbiddenResponse(): NextResponse {
  return errorResponse("FORBIDDEN", "Request origin is not allowed.");
}

export type JsonBodyResult = { ok: true; body: unknown } | { ok: false; response: NextResponse };

export async function readJsonBody(request: Request): Promise<JsonBodyResult> {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > 1_000_000) {
      return {
        ok: false,
        response: errorResponse("PAYLOAD_TOO_LARGE", "Request body must be 1 MB or smaller."),
      };
    }
    const text = await request.text();
    if (text.length > 1_000_000) {
      return {
        ok: false,
        response: errorResponse("PAYLOAD_TOO_LARGE", "Request body must be 1 MB or smaller."),
      };
    }
    return { ok: true, body: JSON.parse(text) as unknown };
  } catch {
    return {
      ok: false,
      response: errorResponse("BAD_REQUEST", "Request body must be valid JSON."),
    };
  }
}

/**
 * Converts Zod issues into a field -> messages map for the VALIDATION_ERROR envelope.
 */
export function fieldErrorsFrom(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".") || "_";
    (fields[key] ??= []).push(issue.message);
  }
  return fields;
}
