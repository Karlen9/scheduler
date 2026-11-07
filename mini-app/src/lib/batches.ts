import type { TClientBatch, TSessionType } from './types';

/***************************************************************************************************
 * Returns the active batch (package) of a client that can still pay for a session of the given
 * service, or null when there is none.
 *
 * Parameters:
 * - serviceId: Id of the batch service.
 * - batches: All batches of the relevant client (may be undefined while loading).
 ***************************************************************************************************/
export function findActiveBatch(
  serviceId: string,
  batches: TClientBatch[] | undefined,
): TClientBatch | null {
  return (
    batches?.find(
      (batch) =>
        batch.serviceId === serviceId && batch.status === 'active' && batch.remainingSessions > 0,
    ) ?? null
  );
}

/***************************************************************************************************
 * Whether a service can be booked for the relevant client right now.
 *
 * Common services are always bookable. A batch service is bookable only while the client has an
 * active batch with remaining sessions for it; otherwise it stays visible but disabled in the UI.
 ***************************************************************************************************/
export function isServiceBookable(
  service: Pick<TSessionType, 'id' | 'type'>,
  batches: TClientBatch[] | undefined,
): boolean {
  return service.type !== 'batch' || findActiveBatch(service.id, batches) !== null;
}
