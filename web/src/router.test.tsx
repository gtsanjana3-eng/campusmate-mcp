import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { routes } from './router';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe('app routes', () => {
  it('renders the home page inside the shared layout', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main');
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('navigates to the items page and lists items from the service', async () => {
    renderAt('/');
    const nav = await screen.findByRole('navigation', { name: 'Primary' });
    await userEvent.click(within(nav).getByRole('link', { name: 'Items' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Items' })).toBeInTheDocument();
    expect(await screen.findAllByRole('listitem')).not.toHaveLength(0);
    expect(within(nav).getByRole('link', { name: 'Items' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('shows the 404 page for unknown URLs', async () => {
    renderAt('/does-not-exist');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('toggles the mobile menu and closes it with Escape', async () => {
    renderAt('/');
    const menuButton = await screen.findByRole('button', { name: 'Open menu' });
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(menuButton);
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');

    await userEvent.keyboard('{Escape}');
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  });
});
