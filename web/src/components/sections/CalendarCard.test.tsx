import type { IntegrationStatus } from '@shared/types';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { redirectTo } from '@/lib/redirect';
import { mockApi } from '@/test/mockApi';
import { CalendarCard } from './CalendarCard';

vi.mock('@/lib/redirect', () => ({ redirectTo: vi.fn<(url: string) => void>() }));

function renderCard(state: IntegrationStatus['state'], path = '/connect') {
  const fetchMock = mockApi({
    'GET /api/integrations': () =>
      Response.json({
        integrations: [
          {
            provider: 'google_calendar',
            state,
            ...(state === 'connected' ? { connectedAt: '2026-11-24T05:00:00.000Z' } : {}),
          },
        ],
      }),
    'POST /api/integrations/google/connect': () =>
      Response.json({ authUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=abc' }),
    'DELETE /api/integrations/google': () => new Response(null, { status: 204 }),
  });
  const router = createMemoryRouter([{ path: '/connect', element: <CalendarCard /> }], {
    initialEntries: [path],
  });
  render(<RouterProvider router={router} />);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(redirectTo).mockClear();
});

describe('CalendarCard', () => {
  it('explains exactly what access is asked for', async () => {
    renderCard('disconnected');
    expect(await screen.findByText(/can't see your other calendars or events/)).toBeInTheDocument();
  });

  it('says when the server has no Google set-up, with no connect button', async () => {
    renderCard('not_configured');
    expect(await screen.findByText('Not available')).toBeInTheDocument();
    expect(screen.getByText(/reminders are kept in CampusMate only/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Connect/ })).not.toBeInTheDocument();
  });

  it('starts the Google sign-in when connecting', async () => {
    renderCard('disconnected');
    await userEvent.click(await screen.findByRole('button', { name: 'Connect Google Calendar' }));
    expect(redirectTo).toHaveBeenCalledWith(
      'https://accounts.google.com/o/oauth2/v2/auth?state=abc',
    );
  });

  it('asks to reconnect when access expired or was removed', async () => {
    renderCard('needs_reconnect');
    expect(await screen.findByText('Reconnect needed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reconnect Google Calendar' })).toBeInTheDocument();
  });

  it('disconnects when connected', async () => {
    const fetchMock = renderCard('connected');
    await userEvent.click(
      await screen.findByRole('button', { name: 'Disconnect Google Calendar' }),
    );
    expect(await screen.findByText(/no longer has access/)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(true);
  });

  it('shows the result of returning from Google', async () => {
    renderCard('connected', '/connect?google=connected');
    expect(await screen.findByText(/Google Calendar is connected/)).toBeInTheDocument();
  });
});
