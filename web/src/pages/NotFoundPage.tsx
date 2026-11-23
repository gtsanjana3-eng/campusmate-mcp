import { Link } from 'react-router';
import { ROUTES } from '@/config/routes';
import { pageTitle } from '@/lib/pageTitle';

export default function NotFoundPage() {
  return (
    <div className="container stack">
      <title>{pageTitle('Page not found')}</title>
      <h1>Page not found</h1>
      <p>The page you're looking for doesn't exist or has moved.</p>
      <p>
        <Link to={ROUTES.home}>Go to the home page</Link>
      </p>
    </div>
  );
}
