import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { CopyField } from '@/components/ui/CopyField';
import { RouteErrorPage } from '@/pages/RouteErrorPage';
import { ApiError } from '@/services/apiClient';
import * as fixtures from '@/test/fixtures';
import { ActionDetails } from './ApprovalCard';
import { ClassList } from './ClassList';
import { DeadlineList } from './DeadlineList';
import { ErrorState } from './ErrorState';

const inRouter = (element: React.ReactNode) =>
  render(<RouterProvider router={createMemoryRouter([{ path: '/', element }])} />);

describe('ActionDetails shows exactly what each action will do', () => {
  it('for a new deadline found in a notice', () => {
    render(
      <ActionDetails
        preview={{
          tool: 'add_deadline',
          deadline: {
            subjectCode: 'OS',
            title: 'OS viva',
            dueAt: '2026-11-30T10:00:00+05:30',
            kind: 'exam',
            source: 'notice',
          },
        }}
      />,
    );
    expect(screen.getByText('OS viva')).toBeInTheDocument();
    expect(screen.getByText('exam (found in a notice)')).toBeInTheDocument();
  });

  it('for marking a deadline done', () => {
    render(
      <ActionDetails
        preview={{ tool: 'mark_deadline_done', deadline: fixtures.today.dueSoon[0]! }}
      />,
    );
    expect(screen.getByText('CN: CN Quiz 2 (Units 3–4)')).toBeInTheDocument();
  });
});

describe('empty lists say so', () => {
  it('has a message for no classes and no deadlines', () => {
    render(
      <>
        <ClassList classes={[]} />
        <DeadlineList deadlines={[]} empty="Nothing due soon." />
      </>,
    );
    expect(screen.getByText('No classes today.')).toBeInTheDocument();
    expect(screen.getByText('Nothing due soon.')).toBeInTheDocument();
  });
});

describe('ErrorState', () => {
  it('shows the server message and a working retry for ordinary errors', async () => {
    const retry = vi.fn<() => void>();
    inRouter(
      <ErrorState
        what="Your approvals"
        error={new ApiError(503, 'Database is busy.')}
        onRetry={retry}
      />,
    );
    expect(await screen.findByText("Your approvals couldn't be loaded.")).toBeInTheDocument();
    expect(screen.getByText('Database is busy.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('does not show technical details for non-API errors', async () => {
    inRouter(<ErrorState what="Your day" error={new TypeError('fetch failed at 0x1f')} />);
    expect(await screen.findByText("Your day couldn't be loaded.")).toBeInTheDocument();
    expect(screen.queryByText(/0x1f/)).not.toBeInTheDocument();
  });
});

describe('CopyField', () => {
  it('reveals the value and explains when copying is not allowed', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('denied'));
    render(<CopyField label="Token" value="secret-token-value" secret />);
    expect(screen.queryByText('secret-token-value')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copy token' }));
    expect(await screen.findByText(/Select the text and copy it instead/)).toBeInTheDocument();
    expect(screen.getByText('secret-token-value')).toBeInTheDocument();
  });
});

describe('RouteErrorPage', () => {
  it('shows a friendly page, not the error, when a route crashes', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const router = createMemoryRouter([
      {
        path: '/',
        loader: () => {
          throw new Error('database exploded: SELECT * FROM secrets');
        },
        Component: () => null,
        ErrorBoundary: RouteErrorPage,
      },
    ]);
    render(<RouterProvider router={router} />);
    expect(
      await screen.findByRole('heading', { name: 'Something went wrong' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/database exploded/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the home page' })).toHaveAttribute('href', '/');
  });
});
