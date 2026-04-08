/***************************************************************************************************
 * Defines the in flight requests value used by the shared utility layer.
 *
 * Usage context:
 * - Reused by the shared utility layer to keep shared values centralized.
 ***************************************************************************************************/
const inFlightRequests = new Map<string, Promise<unknown>>();

/***************************************************************************************************
 * Implements the dedupe request logic used by this module.
 *
 * Parameters:
 * - key: Key used by the current operation.
 * - request: Request used by the current operation.
 *
 * Returns:
 * - A promise that resolves with T.
 *
 * Side effects:
 * - May read browser state, call shared helpers, or perform network requests.
 ***************************************************************************************************/
export async function dedupeRequest<T>(key: string, request: () => Promise<T>): Promise<T> {
  /***************************************************************************************************
   * Defines the existing value used by the shared utility layer.
   *
   * Usage context:
   * - Reused by the shared utility layer to keep shared values centralized.
   ***************************************************************************************************/
  const existing = inFlightRequests.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  /***************************************************************************************************
   * Defines the next value used by the shared utility layer.
   *
   * Usage context:
   * - Reused by the shared utility layer to keep shared values centralized.
   ***************************************************************************************************/
  const next = request().finally(() => {
    inFlightRequests.delete(key);
  });

  inFlightRequests.set(key, next as Promise<unknown>);
  return next;
}
