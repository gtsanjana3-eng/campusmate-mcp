import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { routes } from './router';
import * as fixtures from './test/fixtures';
import { mockApi, unauthorizedResponse } from './test/mockApi';

const connectInfo = {
  mcpUrl: 'https://campusmate.example.com/mcp',
  token: 'secret-token-value',
  testPrompt: 'What do I have today?',
};

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('logged out', () => {
  it('sends protected pages to the login page and back after logging in', async () => {
    let loggedIn = false;
    mockApi({
      'GET /api/session': () =>
        loggedIn ? Response.json(fixtures.session) : unauthorizedResponse(),
      'POST /api/session': () => {
        loggedIn = true;
        return new Response(null, { status: 204 });
      },
      'GET /api/connect': () => Response.json(connectInfo),
      'GET /api/integrations': () =>
        Response.json({ integrations: [{ provider: 'google_calendar', state: 'not_configured' }] }),
    });

    const router = renderAt('/connect');
    expect(
      await screen.findByRole('heading', { name: 'Log in to CampusMate' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Passcode'), 'letmein');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(
      await screen.findByRole('heading', { name: 'Connect CampusMate to your AI assistant' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/connect');
  });

  it('shows a clear message for a wrong passcode', async () => {
    mockApi({
      'GET /api/session': unauthorizedResponse,
      'POST /api/session': unauthorizedResponse,
    });
    renderAt('/login');
    await userEvent.type(await screen.findByLabelText('Passcode'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('That passcode is not right');
    expect(screen.getByLabelText('Passcode')).toHaveAttribute('aria-invalid', 'true');
  });

  it('explains what CampusMate is to visitors who are not logged in', async () => {
    mockApi({ 'GET /api/session': unauthorizedResponse });
    renderAt('/login');
    const about = await screen.findByRole('region', { name: 'What is CampusMate?' });
    expect(within(about).getByText(/Only suggests actions/)).toBeInTheDocument();
    expect(
      within(about).getByRole('link', { name: 'Source code and documentation' }),
    ).toHaveAttribute('href', 'https://github.com/gtsanjana3-eng/campusmate-mcp');
  });

  it('asks for a passcode before calling the server', async () => {
    const fetchMock = mockApi({});
    renderAt('/login');
    await userEvent.click(await screen.findByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter your passcode.');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

const loggedInApi = () =>
  mockApi({
    'GET /api/session': () => Response.json(fixtures.session),
    'GET /api/connect': () => Response.json(connectInfo),
    'GET /api/integrations': () =>
      Response.json({ integrations: [{ provider: 'google_calendar', state: 'not_configured' }] }),
    'DELETE /api/session': () => new Response(null, { status: 204 }),
  });

describe('logged in', () => {
  it('opens Today from the home route, with every page in the navigation', async () => {
    loggedInApi();
    renderAt('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Today', 'Approvals', 'Activity', 'Permissions', 'Connect']);
    expect(within(nav).getByRole('link', { name: 'Today' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main');
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('keeps the token hidden until the student chooses to show it', async () => {
    loggedInApi();
    renderAt('/connect');
    expect(await screen.findByText(connectInfo.mcpUrl)).toBeInTheDocument();
    expect(screen.queryByText(connectInfo.token)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Show token' }));
    expect(screen.getByText(connectInfo.token)).toBeInTheDocument();
  });

  it('offers a Claude Code command as well, with the token hidden until shown', async () => {
    loggedInApi();
    const user = userEvent.setup();
    renderAt('/connect');
    expect(await screen.findByText(/Request headers are still in beta/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copy claude code command' }));
    expect(await navigator.clipboard.readText()).toBe(
      `claude mcp add --transport http campusmate ${connectInfo.mcpUrl} --header "Authorization: Bearer ${connectInfo.token}"`,
    );
    expect(screen.queryByText(/claude mcp add/)).not.toBeInTheDocument();
  });

  it('explains how CampusMate works before the connection steps', async () => {
    loggedInApi();
    renderAt('/connect');
    expect(
      await screen.findByRole('heading', { name: 'How CampusMate works' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/checks your Permissions switch/)).toBeInTheDocument();
  });

  it('copies values and announces it', async () => {
    loggedInApi();
    const user = userEvent.setup();
    renderAt('/connect');
    await user.click(await screen.findByRole('button', { name: 'Copy mcp url' }));
    expect(await navigator.clipboard.readText()).toBe(connectInfo.mcpUrl);
    expect(screen.getByText('MCP URL copied.')).toBeInTheDocument();
  });

  it('logs out and returns to the login page', async () => {
    const fetchMock = loggedInApi();
    const router = renderAt('/connect');
    await userEvent.click(await screen.findByRole('button', { name: 'Log out' }));
    expect(
      await screen.findByRole('heading', { name: 'Log in to CampusMate' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/session',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('shows the 404 page for unknown URLs', async () => {
    loggedInApi();
    renderAt('/does-not-exist');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('toggles the mobile menu and closes it with Escape', async () => {
    loggedInApi();
    renderAt('/connect');
    const menuButton = await screen.findByRole('button', { name: 'Open menu' });
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(menuButton);
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{Escape}');
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('login lockout', () => {
  it('shows how long to wait after too many wrong passcodes', async () => {
    mockApi({
      'GET /api/session': unauthorizedResponse,
      'POST /api/session': () =>
        Response.json(
          {
            error: {
              code: 'too_many_attempts',
              message: 'Too many wrong passcodes. Try again in 15 minutes.',
            },
          },
          { status: 429, headers: { 'Retry-After': '900' } },
        ),
    });
    renderAt('/login');
    await userEvent.type(await screen.findByLabelText('Passcode'), 'another-guess');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Try again in 15 minutes');
  });
});
