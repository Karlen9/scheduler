import { createMockState } from './fixtures';
import { createRoomScenarioState } from './fixtures-room';
import { resolveScenario } from './scenario';

import type { TChangeGroup } from '../types';
import type { TMockScenario } from './room-types';
import type { TMockState } from './types';

let mockState: TMockState | null = null;
let mockScenario: TMockScenario | null = null;

/** Builds a fresh state for a scenario; the default scenario is exactly `createMockState()`. */
export function buildState(scenario: TMockScenario): TMockState {
  const base = createMockState();
  return scenario === 'room' ? createRoomScenarioState(base) : base;
}

export function getState(): TMockState {
  // Switching scenario (`?mock=room` / `?mock=default`) rebuilds the state from scratch.
  const scenario = resolveScenario();
  if (!mockState || mockScenario !== scenario) {
    mockState = buildState(scenario);
    mockScenario = scenario;
  }
  return mockState;
}

export function bumpChangeVersions(state: TMockState, groups: TChangeGroup[]): void {
  for (const group of groups) {
    state.changeVersions[group] = (state.changeVersions[group] ?? 0) + 1;
  }
}
