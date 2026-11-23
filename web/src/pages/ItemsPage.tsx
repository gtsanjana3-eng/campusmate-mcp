import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusMessage } from '@/components/ui/StatusMessage';
import { useAsync } from '@/hooks/useAsync';
import { pageTitle } from '@/lib/pageTitle';
import { getItems } from '@/services/itemService';
import styles from './ItemsPage.module.css';

/** Reference page: data from a service, with loading, error, empty and success states. */
export default function ItemsPage() {
  const items = useAsync(getItems);

  return (
    <div className="container">
      <title>{pageTitle('Items')}</title>
      <h1 className={styles.heading}>Items</h1>

      {items.status === 'loading' && <StatusMessage variant="loading" title="Loading items…" />}

      {items.status === 'error' && (
        <StatusMessage variant="error" title="Items couldn't be loaded.">
          <Button variant="secondary" onClick={items.retry}>
            Try again
          </Button>
        </StatusMessage>
      )}

      {items.status === 'success' && items.data.length === 0 && (
        <StatusMessage variant="empty" title="No items yet." />
      )}

      {items.status === 'success' && items.data.length > 0 && (
        <ul className={styles.grid}>
          {items.data.map((item) => (
            <li key={item.id}>
              <Card className={styles.card}>
                <h2 className={styles.cardTitle}>{item.title}</h2>
                <p className={styles.cardText}>{item.description}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
