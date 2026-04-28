import { handleDelete } from './delete';
import { handleGet } from './get';
import { handlePost } from './post';
import { handlePut } from './put';
import { findBooking } from './queries';
import { getState } from './state';
import { clone, parseRequestBody } from './utils';

export async function fetchMockAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const state = getState();
  const method = (options?.method ?? 'GET').toUpperCase();
  const path = endpoint.split('?')[0];
  const body = parseRequestBody(options?.body);

  let response: T | undefined;
  switch (method) {
    case 'GET':
      response = handleGet<T>(state, endpoint, path);
      break;
    case 'POST':
      response = handlePost<T>(state, endpoint, path, body);
      break;
    case 'PUT':
      response = handlePut<T>(state, endpoint, path, body);
      break;
    case 'DELETE':
      response = handleDelete<T>(state, endpoint, path, body);
      break;
  }

  if (response !== undefined) {
    return response;
  }

  const fallbackBooking = path.match(/^\/api\/admin\/bookings\/([^/]+)$/);
  if (fallbackBooking) {
    const booking = findBooking(state, fallbackBooking[1]);
    if (booking) {
      return clone(booking) as T;
    }
  }

  throw new Error(`Mock API endpoint not implemented: ${method} ${endpoint}`);
}
