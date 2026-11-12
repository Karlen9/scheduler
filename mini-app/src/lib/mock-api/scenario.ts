import type { TMockScenario } from './room-types';

export const MOCK_SCENARIO_STORAGE_KEY = 'mock-scenario';

/***************************************************************************************************
 * Resolves the active mock scenario for the test routes.
 *
 * `?mock=room` on any URL activates the room scenario and remembers it in sessionStorage so that
 * in-app navigation (which drops the query string) keeps it; `?mock=default` clears it. Without
 * the parameter the remembered scenario is used. Storage failures are tolerated.
 ***************************************************************************************************/
export function resolveScenario(): TMockScenario {
  if (typeof window === 'undefined') {
    return 'default';
  }

  let requested: string | null = null;
  try {
    requested = new URLSearchParams(window.location.search).get('mock');
  } catch {
    requested = null;
  }

  try {
    if (requested === 'room') {
      window.sessionStorage.setItem(MOCK_SCENARIO_STORAGE_KEY, 'room');
      return 'room';
    }
    if (requested === 'default') {
      window.sessionStorage.removeItem(MOCK_SCENARIO_STORAGE_KEY);
      return 'default';
    }
    return window.sessionStorage.getItem(MOCK_SCENARIO_STORAGE_KEY) === 'room' ? 'room' : 'default';
  } catch {
    return requested === 'room' ? 'room' : 'default';
  }
}
