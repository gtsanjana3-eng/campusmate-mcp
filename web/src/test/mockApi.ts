import { vi } from 'vitest';

type Handler = (init: RequestInit | undefined) => Response;

/**
 * Stubs `fetch` with per-route handlers keyed by "METHOD /path". Unknown routes return 404,
 * so a test fails loudly if a page calls an endpoint it didn't expect.
 */
export function mockApi(routes: Record<string, Handler>) {
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input), 'http://localhost');
    const key = `${init?.method ?? 'GET'} ${url.pathname}`;
    const handler = routes[key];
    return handler
      ? handler(init)
      : Response.json(
          { error: { code: 'not_found', message: `No mock for ${key}` } },
          { status: 404 },
        );
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export const unauthorizedResponse = () =>
  Response.json(
    { error: { code: 'unauthorized', message: 'Please log in again.' } },
    { status: 401 },
  );
