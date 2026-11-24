import type { IntegrationStatus } from '@shared/types';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusMessage } from '@/components/ui/StatusMessage';
import { useAsync } from '@/hooks/useAsync';
import { formatDateTime } from '@/lib/format';
import { redirectTo } from '@/lib/redirect';
import { ApiError } from '@/services/apiClient';
import {
  disconnectCalendar,
  getCalendarStatus,
  startCalendarConnect,
} from '@/services/integrationService';
import styles from './CalendarCard.module.css';

const STATES: Record<IntegrationStatus['state'], { tone: BadgeTone; label: string }> = {
  not_configured: { tone: 'neutral', label: 'Not available' },
  disconnected: { tone: 'neutral', label: 'Not connected' },
  connected: { tone: 'success', label: 'Connected' },
  needs_reconnect: { tone: 'warning', label: 'Reconnect needed' },
};

/** Messages for the result Google's sign-in sends back in the URL (?google=…). */
const RETURN_MESSAGES: Record<string, string> = {
  connected: 'Google Calendar is connected. Approved reminders will also appear there.',
  denied: 'You chose not to connect Google Calendar. Reminders stay in CampusMate.',
  error: "Google Calendar couldn't be connected. Please try again.",
};

/** Google Calendar connection: optional, and only for reminders the student approves. */
export function CalendarCard() {
  const status = useAsync(getCalendarStatus);
  const [params] = useSearchParams();
  const [message, setMessage] = useState(RETURN_MESSAGES[params.get('google') ?? ''] ?? '');
  const [isBusy, setIsBusy] = useState(false);

  const connect = async () => {
    setIsBusy(true);
    try {
      const { authUrl } = await startCalendarConnect();
      redirectTo(authUrl);
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "Couldn't start the connection.");
      setIsBusy(false);
    }
  };

  const disconnect = async () => {
    setIsBusy(true);
    try {
      await disconnectCalendar();
      setMessage('Google Calendar is disconnected. CampusMate no longer has access.');
      status.retry();
    } catch {
      setMessage("Couldn't disconnect. Please try again.");
    } finally {
      setIsBusy(false);
    }
  };

  const state = status.status === 'success' ? status.data?.state : undefined;

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>Google Calendar (optional)</h2>
        {state && <Badge tone={STATES[state].tone}>{STATES[state].label}</Badge>}
      </div>
      <p>
        Add the reminders you approve to a separate <strong>“CampusMate”</strong> calendar in your
        Google account. CampusMate can only create and manage events in that one calendar. It
        can&apos;t see your other calendars or events.
      </p>
      <output className={styles.message}>{message}</output>

      {status.status === 'loading' && <StatusMessage variant="loading" title="Checking…" />}
      {status.status === 'error' && (
        <StatusMessage variant="error" title="Calendar status couldn't be loaded." />
      )}
      {state === 'not_configured' && (
        <p className={styles.muted}>
          This CampusMate server isn&apos;t set up for Google yet, so reminders are kept in
          CampusMate only.
        </p>
      )}
      {(state === 'disconnected' || state === 'needs_reconnect') && (
        <>
          {state === 'needs_reconnect' && (
            <p className={styles.warning}>
              Google access expired or was removed. Reconnect to keep adding reminders there.
            </p>
          )}
          <div className={styles.actions}>
            <Button onClick={() => void connect()} disabled={isBusy}>
              {state === 'needs_reconnect'
                ? 'Reconnect Google Calendar'
                : 'Connect Google Calendar'}
            </Button>
          </div>
        </>
      )}
      {state === 'connected' && (
        <>
          {status.status === 'success' && status.data?.connectedAt && (
            <p className={styles.muted}>Connected {formatDateTime(status.data.connectedAt)}.</p>
          )}
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => void disconnect()} disabled={isBusy}>
              Disconnect Google Calendar
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
