import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest } from './apiClient';

function mockFetch(response: Response) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiRequest', () => {
  it('returns parsed JSON for a successful response', async () => {
    mockFetch(Response.json({ id: 1 }));
    await expect(apiRequest('/things/1')).resolves.toEqual({ id: 1 });
  });

  it('keeps JSON headers when the caller passes its own headers', async () => {
    const fetchMock = mockFetch(Response.json({}));
    await apiRequest('/things', {
      method: 'POST',
      body: JSON.stringify({ a: 1 }),
      headers: { 'X-Trace': 'abc' },
    });

    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('X-Trace')).toBe('abc');
  });

  it('resolves to undefined for 204 No Content', async () => {
    mockFetch(new Response(null, { status: 204 }));
    await expect(apiRequest('/things/1', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it('throws ApiError with the status for non-2xx responses', async () => {
    mockFetch(new Response('Not found', { status: 404, statusText: 'Not Found' }));
    const error = await apiRequest('/missing').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, message: 'Not found' });
  });
});
