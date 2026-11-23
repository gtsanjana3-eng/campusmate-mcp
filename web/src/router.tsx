import type { ComponentType } from 'react';
import { Navigate, type RouteObject } from 'react-router';
import { ROUTES } from '@/config/routes';
import { AuthGate } from '@/layouts/AuthGate';
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
          { path: ROUTES.login, lazy: page(() => import('@/pages/LoginPage')) },
          {
            // Every route below needs a logged-in student.
            Component: AuthGate,
            children: [
              // Until the Today page exists, the home route opens Connect.
              { path: ROUTES.home, element: <Navigate to={ROUTES.connect} replace /> },
              { path: ROUTES.connect, lazy: page(() => import('@/pages/ConnectPage')) },
            ],
          },
          // Not lazy: the error page renders it too, so it's in the main bundle anyway.
          { path: '*', Component: NotFoundPage },
        ],
      },
    ],
  },
];
