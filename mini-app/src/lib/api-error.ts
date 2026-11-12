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

/***************************************************************************************************
 * Thrown by the work-dates update when the backend refuses to close dates that still have active
 * bookings (HTTP 409). Carries the conflicting dates (YYYY-MM-DD) so the UI can list them.
 ***************************************************************************************************/
export class WorkDatesConflictError extends ApiError {
  readonly dates: string[];

  constructor(message: string, dates: string[]) {
    super(message, 409);
    this.name = 'WorkDatesConflictError';
    this.dates = dates;
  }
}

/***************************************************************************************************
 * Thrown by the room endpoints for 409 (day taken / not yours / has bookings) and 403 (forbidden)
 * answers. The backend body is `{error, message, dates}`; `dates` lists the conflicting dates
 * (YYYY-MM-DD), `code` is the backend error key and `message` the localized text.
 ***************************************************************************************************/
export class RoomError extends ApiError {
  readonly dates: string[];
  readonly code: string;

  constructor(message: string, status: number, dates: string[], code = '') {
    super(message, status);
    this.name = 'RoomError';
    this.dates = dates;
    this.code = code;
  }
}

/** Converts a 403/409 ApiError into a RoomError, tolerating non-JSON bodies. */
export function toRoomError(err: ApiError): RoomError {
  try {
    const body = JSON.parse(err.message) as { error?: string; message?: string; dates?: string[] };
    return new RoomError(body.message ?? err.message, err.status, body.dates ?? [], body.error);
  } catch {
    return new RoomError(err.message, err.status, []);
  }
}
