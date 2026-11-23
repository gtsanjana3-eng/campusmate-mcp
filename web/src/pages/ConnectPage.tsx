import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CopyField } from '@/components/ui/CopyField';
import { StatusMessage } from '@/components/ui/StatusMessage';
import { useAsync } from '@/hooks/useAsync';
import { pageTitle } from '@/lib/pageTitle';
import { getConnectInfo } from '@/services/connectService';
import styles from './ConnectPage.module.css';

/** Step-by-step guide to adding CampusMate to Claude (journey J0). */
export default function ConnectPage() {
  const info = useAsync(getConnectInfo);

  return (
    <div className={`container ${styles.page}`}>
      <title>{pageTitle('Connect')}</title>
      <h1 className={styles.heading}>Connect CampusMate to your AI assistant</h1>
      <p className={styles.lead}>
        Add CampusMate once as a connector. Your assistant can then read your college day, and
        anything it wants to <em>do</em> waits for your approval here.
      </p>

      {info.status === 'loading' && (
        <StatusMessage variant="loading" title="Loading your connection details…" />
      )}

      {info.status === 'error' && (
        <StatusMessage variant="error" title="Connection details couldn't be loaded.">
          <Button variant="secondary" onClick={info.retry}>
            Try again
          </Button>
        </StatusMessage>
      )}

      {info.status === 'success' && (
        <ol className={styles.steps}>
          <li>
            <Card className={styles.step}>
              <h2 className={styles.stepTitle}>Copy your connector details</h2>
              <CopyField label="MCP URL" value={info.data.mcpUrl} />
              <CopyField label="Token" value={info.data.token} secret />
              <p className={styles.note}>
                Keep the token private. Anyone with it can ask CampusMate to read your data.
              </p>
            </Card>
          </li>
          <li>
            <Card className={styles.step}>
              <h2 className={styles.stepTitle}>Add the connector in Claude</h2>
              <p>
                In Claude, open <strong>Customize → Connectors → Add custom connector</strong>.
                Paste the MCP URL, then add a request header named <code>Authorization</code> with
                the value <code>Bearer</code> followed by a space and your token.
              </p>
            </Card>
          </li>
          <li>
            <Card className={styles.step}>
              <h2 className={styles.stepTitle}>Try it</h2>
              <CopyField label="Test prompt" value={info.data.testPrompt} />
            </Card>
          </li>
        </ol>
      )}
    </div>
  );
}
