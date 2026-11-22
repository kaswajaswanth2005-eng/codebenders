export type ServiceErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "DOMAIN_RULE"
  | "SERVICE_UNAVAILABLE";

/**
 * Expected, user-facing failure raised by services. Routes map it to the response envelope.
 */
export class ServiceError extends Error {
  readonly code: ServiceErrorCode;
  readonly fields?: Record<string, string[]>;

  constructor(code: ServiceErrorCode, message: string, fields?: Record<string, string[]>) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    this.fields = fields;
  }
}

export function notFound(entity: string): ServiceError {
  return new ServiceError("NOT_FOUND", `${entity} was not found`);
}
