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
