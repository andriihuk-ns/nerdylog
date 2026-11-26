/** Shared service-layer errors. Callers map them to HTTP 403/404 or a Slack ephemeral. */

/** Amendment A5: the actor may not act on another user's data. */
export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** The requested row does not exist. */
export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

/** Field path ("hours", "members.2.slackUserId", or "_" for form-level) → messages. */
export type FieldErrors = Record<string, string[]>;

/** Input failed Zod or business validation. Callers map it to HTTP 400 or modal field errors. */
export class InvalidInputError extends Error {
  readonly fieldErrors: FieldErrors;

  constructor(fieldErrors: FieldErrors, message?: string) {
    super(message ?? summarize(fieldErrors));
    this.name = "InvalidInputError";
    this.fieldErrors = fieldErrors;
  }

  /** Shorthand for a single field message. */
  static field(field: string, message: string): InvalidInputError {
    return new InvalidInputError({ [field]: [message] });
  }
}

function summarize(fieldErrors: FieldErrors): string {
  const parts = Object.entries(fieldErrors).map(([field, msgs]) => `${field}: ${msgs.join(", ")}`);
  return parts.length > 0 ? `Invalid input (${parts.join("; ")})` : "Invalid input";
}
