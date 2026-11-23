import { isRouteErrorResponse, useRouteError } from 'react-router';
import { env } from '@/config/env';
import { pageTitle } from '@/lib/pageTitle';
import NotFoundPage from './NotFoundPage';

/** Shown when a route throws while rendering or loading. Not lazy: it must work when chunks fail. */
export function RouteErrorPage() {
  const error = useRouteError();

  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  if (env.isDev) console.error(error);

  return (
    <div className="container stack">
      <title>{pageTitle('Something went wrong')}</title>
      <h1>Something went wrong</h1>
      <p>Please reload the page. If the problem continues, try again later.</p>
      <p>
        <a href="/">Go to the home page</a>
      </p>
    </div>
  );
}
