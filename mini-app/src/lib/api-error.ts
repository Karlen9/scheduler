/***************************************************************************************************
 * Error thrown by the API client when the backend answers with a non-2xx status.
 *
 * Keeps the backend message as `message` (so existing callers keep working) and exposes the HTTP
 * status so UI code can tell "the booking changed under me" from a generic failure.
 ***************************************************************************************************/
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/***************************************************************************************************
 * Returns true when a failed booking action most likely failed because the booking was already
 * processed elsewhere (e.g. via the Telegram bot): the record is gone, in conflict, or no longer
 * in the state the action requires.
 *
 * Parameters:
 * - err: The thrown value.
 * - options.includeBadRequest: Also treat HTTP 400 as a state error (confirm/decline endpoints
 *   answer 400 when the booking is no longer pending).
 ***************************************************************************************************/
export function isStaleStateError(
  err: unknown,
  options?: { includeBadRequest?: boolean },
): boolean {
  if (!(err instanceof ApiError)) {
    return false;
  }
  if (err.status === 404 || err.status === 409) {
    return true;
  }
  return Boolean(options?.includeBadRequest) && err.status === 400;
}
