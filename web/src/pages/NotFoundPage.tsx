import { Link } from 'react-router';
import { ROUTES } from '@/config/routes';
import { pageTitle } from '@/lib/pageTitle';
import { PageHeader } from '@/components/ui/PageHeader';

export default function NotFoundPage() {
  return (
    <div className="container">
      <title>{pageTitle('Page not found')}</title>
      <PageHeader
        title="Page not found"
        description="The page you're looking for doesn't exist or has moved."
      />
      <p>
        <Link to={ROUTES.home}>Go to the home page</Link>
      </p>
    </div>
  );
}
