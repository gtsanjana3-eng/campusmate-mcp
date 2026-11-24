import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { routes } from '@/router';
import { APPROVALS_CHANGED } from '@/services/approvalService';
import * as fixtures from '@/test/fixtures';
import { mockApi, unauthorizedResponse } from '@/test/mockApi';

type Routes = Parameters<typeof mockApi>[0];

/** Logged-in API with sensible defaults; tests override the routes they care about. */
function api(overrides: Routes = {}) {
  return mockApi({
    'GET /api/session': () => Response.json({ authenticated: true }),
    'GET /api/today': () => Response.json(fixtures.today),
    'GET /api/attendance': () => Response.json(fixtures.attendance),
    'GET /api/approvals': () => Response.json({ actions: [] }),
    'GET /api/activity': () => Response.json({ entries: fixtures.activity }),
    'GET /api/abilities': () => Response.json({ abilities: fixtures.abilities }),
    ...overrides,
  });
}

function renderAt(path: string) {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
}

const calls = (fetchMock: ReturnType<typeof mockApi>, method: string, path: string) =>
  fetchMock.mock.calls.filter(
    ([url, init]) => String(url).startsWith(path) && (init?.method ?? 'GET') === method,
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Today page', () => {
  it('shows classes, what is due and exact attendance advice', async () => {
    api();
    renderAt('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument();
    // Listed under both Classes and Attendance.
    expect(await screen.findAllByText('Operating Systems')).toHaveLength(2);
    expect(screen.getByText('CN Quiz 2 (Units 3–4)')).toBeInTheDocument();
    expect(screen.getByText('Can miss 1 more')).toBeInTheDocument();
    expect(screen.getByText('Attend the next 6 classes')).toBeInTheDocument();
    expect(screen.getByText(/Demo data/)).toBeInTheDocument();
  });

  it('points to approvals when something is waiting', async () => {
    api({ 'GET /api/today': () => Response.json({ ...fixtures.today, pendingCount: 2 }) });
    renderAt('/');
    expect(await screen.findByText('2 actions are waiting for your approval.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Review them' })).toHaveAttribute('href', '/approvals');
  });

  it('asks the student to log in again when the session expired', async () => {
    api({ 'GET /api/today': unauthorizedResponse });
    renderAt('/');
    expect(await screen.findByText('Your session has ended.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log in again' })).toBeInTheDocument();
  });
});

const pendingApi = (overrides: Routes = {}) =>
  api({
    'GET /api/approvals': () => Response.json({ actions: [fixtures.emailAction()] }),
    ...overrides,
  });

describe('Approvals page', () => {
  it('shows exactly what will be sent and why, before anything happens', async () => {
    pendingApi();
    renderAt('/approvals');
    expect(await screen.findByText('Student asked for a two-day extension.')).toBeInTheDocument();
    expect(screen.getByText('Prof. K. Rao <k.rao@college.example.edu>')).toBeInTheDocument();
    expect(screen.getByText(/Could I have two more days\?/)).toBeInTheDocument();
    expect(screen.getByText(/it goes to the CampusMate demo outbox/)).toBeInTheDocument();
  });

  it('shows the pending count in the header', async () => {
    pendingApi();
    renderAt('/approvals');
    const nav = await screen.findByRole('navigation', { name: 'Primary' });
    expect(
      await within(nav).findByRole('link', { name: 'Approvals, 1 waiting' }),
    ).toBeInTheDocument();
    // Phones see the count on the closed menu button too.
    const menu = screen.getByRole('button', { name: 'Open menu, 1 waiting for approval' });
    expect(menu).toHaveTextContent('1');
    await userEvent.click(menu);
    expect(screen.getByRole('button', { name: 'Close menu' })).not.toHaveTextContent('1');
  });

  it('announces approvals that arrive in the background, but not the ones already there', async () => {
    let actions = [fixtures.emailAction()];
    pendingApi({ 'GET /api/approvals': () => Response.json({ actions }) });
    renderAt('/');
    const nav = await screen.findByRole('navigation', { name: 'Primary' });
    await within(nav).findByRole('link', { name: 'Approvals, 1 waiting' });
    const live = screen.getAllByRole('status').find((el) => el.closest('header'));
    expect(live).toHaveTextContent('');

    actions = [fixtures.emailAction(), fixtures.emailAction({ id: 'act-2' })];
    window.dispatchEvent(new Event(APPROVALS_CHANGED));
    await waitFor(() =>
      expect(live).toHaveTextContent('1 new approval waiting for you, 2 in total.'),
    );
  });

  it('moves focus to the new page heading after navigating', async () => {
    pendingApi();
    renderAt('/');
    const nav = await screen.findByRole('navigation', { name: 'Primary' });
    await userEvent.click(within(nav).getByRole('link', { name: /^Activity/ }));
    const heading = await screen.findByRole('heading', { level: 1, name: 'Activity' });
    await waitFor(() => expect(heading).toHaveFocus());
  });

  it('asks for confirmation; Cancel sends nothing', async () => {
    const fetchMock = pendingApi();
    renderAt('/approvals');
    await userEvent.click(await screen.findByRole('button', { name: /^Approve:/ }));
    const dialog = screen.getByRole('dialog', { name: 'Approve this action?' });
    expect(within(dialog).getByText(/can't be unsent/)).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(calls(fetchMock, 'POST', '/api/approvals/act-1/approve')).toHaveLength(0);
  });

  it('reports success only after the server confirms the action is done', async () => {
    let decided = false;
    const current = () =>
      fixtures.emailAction(
        decided ? { status: 'done', decidedAt: '2026-11-24T05:02:00.000Z' } : {},
      );
    const fetchMock = pendingApi({
      'GET /api/approvals': (_init, url) =>
        Response.json({
          actions: [current()].filter(
            (a) => url.searchParams.get('status') !== 'pending' || a.status === 'pending',
          ),
        }),
      'POST /api/approvals/act-1/approve': () => {
        decided = true;
        return Response.json({ action: fixtures.emailAction({ status: 'done' }) });
      },
    });
    renderAt('/approvals');
    const nav = await screen.findByRole('navigation', { name: 'Primary' });
    await within(nav).findByRole('link', { name: 'Approvals, 1 waiting' });

    await userEvent.click(await screen.findByRole('button', { name: /^Approve:/ }));
    expect(screen.queryByText(/^Done:/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Yes, approve' }));

    const outcome = await screen.findByText(/^Done: Email to Prof\. K\. Rao/);
    expect(calls(fetchMock, 'POST', '/api/approvals/act-1/approve')[0]?.[1]?.body).toBe('{}');
    // Focus moves to the outcome, because the card (and its button) is gone.
    expect(outcome).toHaveFocus();
    expect(await screen.findByText('Nothing waiting for your approval.')).toBeInTheDocument();
    // The header badge updates straight away, not on the next 5-second poll.
    expect(await within(nav).findByRole('link', { name: 'Approvals' })).toBeInTheDocument();
  });

  it('never shows success when the server reports a failure', async () => {
    pendingApi({
      'POST /api/approvals/act-1/approve': () =>
        Response.json({
          action: fixtures.emailAction({
            status: 'failed',
            error: 'You turned this off before approving.',
          }),
        }),
    });
    renderAt('/approvals');
    await userEvent.click(await screen.findByRole('button', { name: /^Approve:/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, approve' }));
    expect(
      await screen.findByText(/^Couldn't complete: .*You turned this off/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^Done:/)).not.toBeInTheDocument();
  });

  it('shows the server message when the action was already decided elsewhere', async () => {
    pendingApi({
      'POST /api/approvals/act-1/approve': () =>
        Response.json(
          { error: { code: 'conflict', message: 'This action is already rejected.' } },
          { status: 409 },
        ),
    });
    renderAt('/approvals');
    await userEvent.click(await screen.findByRole('button', { name: /^Approve:/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, approve' }));
    expect(await screen.findByText('This action is already rejected.')).toBeInTheDocument();
  });

  it('rejects (cancels) a pending action', async () => {
    const fetchMock = pendingApi({
      'POST /api/approvals/act-1/reject': () =>
        Response.json({ action: fixtures.emailAction({ status: 'rejected' }) }),
    });
    renderAt('/approvals');
    await userEvent.click(await screen.findByRole('button', { name: /^Reject:/ }));
    expect(await screen.findByText(/^Rejected: .*Nothing was done\./)).toBeInTheDocument();
    expect(calls(fetchMock, 'POST', '/api/approvals/act-1/reject')).toHaveLength(1);
  });

  it('edits an email before approving it', async () => {
    const fetchMock = pendingApi({
      'PATCH /api/approvals/act-1': () => Response.json({ action: fixtures.emailAction() }),
    });
    renderAt('/approvals');
    await userEvent.click(await screen.findByRole('button', { name: /^Edit email:/ }));
    const subject = screen.getByLabelText('Subject');
    await userEvent.clear(subject);
    await userEvent.type(subject, 'Request for a short extension');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText(/still waiting for your approval/)).toBeInTheDocument();
    const body = JSON.parse(
      String(calls(fetchMock, 'PATCH', '/api/approvals/act-1')[0]?.[1]?.body),
    );
    expect(body.subject).toBe('Request for a short extension');
  });

  it('shows a helpful empty state', async () => {
    api();
    renderAt('/approvals');
    expect(await screen.findByText('Nothing waiting for your approval.')).toBeInTheDocument();
  });
});

describe('Activity page', () => {
  it('lists what the assistant did, with a status for each entry', async () => {
    api();
    renderAt('/activity');
    expect(await screen.findByText('Read your attendance for OS.')).toBeInTheDocument();
    expect(screen.getByText('Blocked')).toBeInTheDocument();
  });

  it('explains an empty log', async () => {
    api({ 'GET /api/activity': () => Response.json({ entries: [] }) });
    renderAt('/activity');
    expect(await screen.findByText('No activity yet.')).toBeInTheDocument();
  });
});

describe('Permissions page', () => {
  it('moves a switch only after the server confirms the change', async () => {
    const fetchMock = api({
      'PUT /api/abilities/draft_faculty_email': () =>
        Response.json({ ability: { ...fixtures.abilities[1], enabled: false } }),
    });
    renderAt('/permissions');
    const toggle = await screen.findByRole('switch', { name: 'Draft emails to faculty' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');

    await userEvent.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'));
    expect(screen.getByText('“Draft emails to faculty” is now off.')).toBeInTheDocument();
    expect(
      JSON.parse(
        String(calls(fetchMock, 'PUT', '/api/abilities/draft_faculty_email')[0]?.[1]?.body),
      ),
    ).toEqual({
      enabled: false,
    });
  });

  it('keeps the old value and explains when saving fails', async () => {
    api({
      'PUT /api/abilities/draft_faculty_email': () =>
        Response.json(
          { error: { code: 'internal', message: 'Something went wrong.' } },
          { status: 500 },
        ),
    });
    renderAt('/permissions');
    const toggle = await screen.findByRole('switch', { name: 'Draft emails to faculty' });
    await userEvent.click(toggle);
    expect(
      await screen.findByText(/Couldn't change “Draft emails to faculty”/),
    ).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });
});

describe('Approvals page with Google Calendar', () => {
  it('shows what the server reports about Google Calendar after approving a reminder', async () => {
    const reminder = fixtures.emailAction({
      summary: 'Reminder “Submit the OS lab record” at Fri, 27 Nov, 18:00',
      preview: {
        tool: 'create_reminder',
        reminder: { text: 'Submit the OS lab record', remindAt: '2026-11-27T18:00:00+05:30' },
      },
    });
    api({
      'GET /api/approvals': () => Response.json({ actions: [reminder] }),
      'POST /api/approvals/act-1/approve': () =>
        Response.json({
          action: {
            ...reminder,
            status: 'done',
            note: 'Saved in CampusMate, but not added to Google Calendar: access expired or was removed. Reconnect it on the Connect page.',
          },
        }),
    });
    renderAt('/approvals');
    await userEvent.click(await screen.findByRole('button', { name: /^Approve:/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, approve' }));
    expect(
      await screen.findByText(/not added to Google Calendar: access expired/),
    ).toBeInTheDocument();
  });
});
