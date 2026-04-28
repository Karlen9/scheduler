import { createMockState } from './fixtures';

import type { TChangeGroup } from '../types';
import type { TMockState } from './types';

let mockState: TMockState | null = null;

export function getState(): TMockState {
  mockState ??= createMockState();
  return mockState;
}

export function bumpChangeVersions(state: TMockState, groups: TChangeGroup[]): void {
  for (const group of groups) {
    state.changeVersions[group] = (state.changeVersions[group] ?? 0) + 1;
  }
}
