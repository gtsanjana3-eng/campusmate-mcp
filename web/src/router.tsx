import type { ComponentType } from 'react';
import type { RouteObject } from 'react-router';
import { ROUTES } from '@/config/routes';
import { MainLayout } from '@/layouts/MainLayout';
import NotFoundPage from '@/pages/NotFoundPage';
import { RouteErrorPage } from '@/pages/RouteErrorPage';

/** Code-splits a page: its module loads only when the route is first visited. */
const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({
  Component: (await load()).default,
});

export const routes: RouteObject[] = [
  {
    Component: MainLayout,
    ErrorBoundary: RouteErrorPage,
    // Shown for the few milliseconds the first page chunk takes to load; blank avoids a flash.
    HydrateFallback: () => null,
    children: [
      {
        // Errors inside a page render here, keeping the header and footer visible.
        ErrorBoundary: RouteErrorPage,
        children: [
          { path: ROUTES.home, lazy: page(() => import('@/pages/HomePage')) },
          { path: ROUTES.items, lazy: page(() => import('@/pages/ItemsPage')) },
          // Not lazy: the error page renders it too, so it's in the main bundle anyway.
          { path: '*', Component: NotFoundPage },
        ],
      },
    ],
  },
];
