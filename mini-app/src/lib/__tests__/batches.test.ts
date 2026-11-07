import { describe, expect, it } from 'vitest';

import { findActiveBatch, isServiceBookable } from '../batches';

import type { TClientBatch } from '../types';

function batch(overrides: Partial<TClientBatch>): TClientBatch {
  return {
    id: 'b1',
    clientId: 'c1',
    serviceId: 's1',
    totalSessions: 10,
    remainingSessions: 5,
    createdAt: '2026-01-01T00:00:00Z',
    status: 'active',
    ...overrides,
  };
}

describe('isServiceBookable', () => {
  const batchService = { id: 's1', type: 'batch' };

  it('always allows common services', () => {
    expect(isServiceBookable({ id: 'x', type: 'common' }, [])).toBe(true);
    expect(isServiceBookable({ id: 'x', type: 'common' }, undefined)).toBe(true);
  });

  it('disables batch services until the client has an active batch with sessions left', () => {
    expect(isServiceBookable(batchService, undefined)).toBe(false);
    expect(isServiceBookable(batchService, [])).toBe(false);
    expect(isServiceBookable(batchService, [batch({ serviceId: 'other' })])).toBe(false);
    expect(isServiceBookable(batchService, [batch({ remainingSessions: 0 })])).toBe(false);
    expect(isServiceBookable(batchService, [batch({ status: 'exhausted' })])).toBe(false);
    expect(isServiceBookable(batchService, [batch({})])).toBe(true);
  });

  it('findActiveBatch returns the usable batch', () => {
    const usable = batch({ id: 'b2' });
    expect(findActiveBatch('s1', [batch({ remainingSessions: 0 }), usable])).toBe(usable);
  });
});
