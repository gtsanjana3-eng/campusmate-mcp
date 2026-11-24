import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CalendarCard } from '@/components/sections/CalendarCard';
import { CopyField } from '@/components/ui/CopyField';
import { StatusMessage } from '@/components/ui/StatusMessage';
import { useAsync } from '@/hooks/useAsync';
import { pageTitle } from '@/lib/pageTitle';
import { getConnectInfo } from '@/services/connectService';
import styles from './ConnectPage.module.css';
import { PageHeader } from '@/components/ui/PageHeader';

/** Step-by-step guide to adding CampusMate to Claude (journey J0). */
export default function ConnectPage() {
  const info = useAsync(getConnectInfo);

  return (
    <div className={`container ${styles.page}`}>
      <title>{pageTitle('Connect')}</title>
      <PageHeader
        title="Connect CampusMate to your AI assistant"
        description={
          <>
            Add CampusMate once as a connector. Your assistant can then read your college day, and
            anything it wants to <em>do</em> waits for your approval here.
          </>
        }
      />

      <Card className={styles.how}>
        <h2 className={styles.stepTitle}>How CampusMate works</h2>
        <ol className={styles.flow}>
          <li>
            <strong>You ask your assistant</strong>, for example “Can I skip OS tomorrow?”. It picks
            a CampusMate tool over MCP.
          </li>
          <li>
            <strong>CampusMate checks your Permissions switch</strong> for that tool. If it&apos;s
            off, the assistant is told no, and you see “Blocked” in Activity.
          </li>
          <li>
            <strong>Reading tools answer straight away</strong> and change nothing. Acting tools
            only create a card on Approvals.
          </li>
          <li>
            <strong>You decide.</strong> Approve, edit or reject each card. Every step is listed in
            Activity, with the tool that was used.
          </li>
        </ol>
      </Card>

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
              <h3 className={styles.option}>Claude app or claude.ai</h3>
              <p>
                Open <strong>Connectors → Add custom connector</strong> and paste the MCP URL. Under{' '}
                <strong>Request headers</strong>, choose <code>authorization</code> and enter{' '}
                <code>Bearer</code>, a space, then your token.
              </p>
              <p className={styles.note}>
                Request headers are still in beta and not every account has them. If you don&apos;t
                see that section, use Claude Code instead.
              </p>
              <h3 className={styles.option}>Claude Code</h3>
              <p>
                Run this command once in a terminal. It contains your token, so keep it private.
              </p>
              <CopyField
                label="Claude Code command"
                value={`claude mcp add --transport http campusmate ${info.data.mcpUrl} --header "Authorization: Bearer ${info.data.token}"`}
                secret
              />
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

      <div className={styles.extra}>
        <CalendarCard />
      </div>
    </div>
  );
}
