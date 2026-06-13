import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../api';
import { ProRequiredError } from '../api/shared';

const telegramMock = vi.hoisted(() => ({
  initData: 'mock-init-data',
  specialistId: 'mock-specialist-id' as string | null,
}));

vi.mock('../telegram', () => ({
  getInitData: () => telegramMock.initData,
  getSpecialistId: () => telegramMock.specialistId,
  waitForInitData: async () => Promise.resolve(telegramMock.initData),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  telegramMock.initData = 'mock-init-data';
  telegramMock.specialistId = 'mock-specialist-id';
});

describe('ProRequiredError', () => {
  it('is thrown when the server returns HTTP 402', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 402,
      text: async () => Promise.resolve('Error.ProRequired'),
    });

    await expect(api.getSpecialist()).rejects.toBeInstanceOf(ProRequiredError);
  });

  it('carries the expected code property', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 402,
      text: async () => Promise.resolve('Error.ProRequired'),
    });

    const err = await api.getSpecialist().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProRequiredError);
    expect((err as ProRequiredError).code).toBe('Error.ProRequired');
    expect((err as ProRequiredError).name).toBe('ProRequiredError');
  });

  it('does NOT become ProRequiredError for a generic 400 error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => Promise.resolve('Bad request'),
    });

    const err = await api.getSpecialist().catch((e: unknown) => e);
    expect(err).not.toBeInstanceOf(ProRequiredError);
    expect((err as Error).message).toBe('Bad request');
  });

  it('does NOT become ProRequiredError for a 500 error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => Promise.resolve(''),
    });

    const err = await api.getSpecialist().catch((e: unknown) => e);
    expect(err).not.toBeInstanceOf(ProRequiredError);
    expect((err as Error).message).toBe('HTTP 500');
  });
});
