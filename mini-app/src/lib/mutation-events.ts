export type TMutationEvent = {
  method: string;
  endpoint: string;
};

type TMutationListener = (event: TMutationEvent) => void;

const mutationListeners = new Set<TMutationListener>();

/***************************************************************************************************
 * Emits a completed mutation request to the cache sync layer.
 ***************************************************************************************************/
export function emitMutation(event: TMutationEvent): void {
  mutationListeners.forEach((listener) => listener(event));
}

/***************************************************************************************************
 * Subscribes to completed mutation requests.
 ***************************************************************************************************/
export function subscribeMutation(listener: TMutationListener): () => void {
  mutationListeners.add(listener);
  return () => mutationListeners.delete(listener);
}
