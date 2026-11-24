import type { IntegrationStatus } from '../../../shared/types/index.ts';
import type { Store } from '../data/store.ts';
import { log } from '../lib/logger.ts';
import type { SecretBox } from '../lib/secretBox.ts';
import { GOOGLE_SCOPE, GoogleError, type GoogleClient } from '../sources/google/googleClient.ts';
import { logActivity } from './activity.ts';
import { AppError, conflict } from './errors.ts';

const PROVIDER = 'google_calendar' as const;

export type ReminderSync = { added: boolean; note: string };

/**
 * Google Calendar for approved reminders. Reminders are always saved in CampusMate first; Google is
 * an extra copy, so a Google problem never loses a reminder or hides what happened.
 */
export function createCalendarIntegration(deps: {
  store: Store;
  box: SecretBox;
  /** Undefined when the server has no Google credentials: the integration is "not configured". */
  google?: GoogleClient;
  now: () => Date;
}) {
  const { store, box, google, now } = deps;
  // Short-lived access token, kept in memory only.
  let accessToken: string | undefined;

  function status(): IntegrationStatus {
    if (!google) return { provider: PROVIDER, state: 'not_configured' };
    const record = store.getIntegration(PROVIDER);
    if (!record) return { provider: PROVIDER, state: 'disconnected' };
    return { provider: PROVIDER, state: record.status, connectedAt: record.connectedAt };
  }

  function requireGoogle(): GoogleClient {
    if (!google) throw conflict('Google Calendar is not set up on this CampusMate server.');
    return google;
  }

  function markNeedsReconnect() {
    accessToken = undefined;
    store.setIntegrationStatus(PROVIDER, 'needs_reconnect', now().toISOString());
  }

  /** Finishes the OAuth sign-in: checks the granted scope, creates the CampusMate calendar. */
  async function complete(code: string): Promise<void> {
    const client = requireGoogle();
    const tokens = await client.exchangeCode(code);
    if (!tokens.scope.split(' ').includes(GOOGLE_SCOPE)) {
      throw new AppError('forbidden', 403, 'Calendar access was not granted.');
    }
    if (!tokens.refreshToken) {
      throw new AppError(
        'invalid_input',
        400,
        'Google did not return long-term access. Try again.',
      );
    }
    const calendar = await client.createCalendar(tokens.accessToken);
    accessToken = tokens.accessToken;
    const at = now().toISOString();
    store.saveIntegration(
      {
        provider: PROVIDER,
        refreshTokenEnc: box.seal(tokens.refreshToken),
        calendarId: calendar.id,
        status: 'connected',
        connectedAt: at,
      },
      at,
    );
    log.info('integration.connected', { provider: PROVIDER });
  }

  async function freshAccessToken(client: GoogleClient, refreshTokenEnc: string) {
    const tokens = await client.refresh(box.open(refreshTokenEnc));
    accessToken = tokens.accessToken;
    return accessToken;
  }

  /**
   * Adds an approved reminder to the CampusMate Google calendar, if connected. Retries once with a
   * fresh access token; expired or revoked access marks the connection for reconnecting.
   */
  async function pushReminder(reminder: { text: string; remindAt: string }): Promise<ReminderSync> {
    const record = store.getIntegration(PROVIDER);
    if (!google) {
      return {
        added: false,
        note: 'Saved in CampusMate (Google Calendar is not set up on this server).',
      };
    }
    if (!record) {
      return {
        added: false,
        note: 'Saved in CampusMate. Connect Google Calendar to also get it there.',
      };
    }
    if (record.status === 'needs_reconnect') {
      return {
        added: false,
        note: 'Saved in CampusMate. Reconnect Google Calendar to also get it there.',
      };
    }

    try {
      const token = accessToken ?? (await freshAccessToken(google, record.refreshTokenEnc));
      try {
        await google.insertReminder(token, record.calendarId, reminder);
      } catch (error) {
        // An expired access token: get a new one and try once more.
        if (!(error instanceof GoogleError) || error.kind !== 'reauth') throw error;
        const fresh = await freshAccessToken(google, record.refreshTokenEnc);
        await google.insertReminder(fresh, record.calendarId, reminder);
      }
      return { added: true, note: 'Also added to your “CampusMate” Google Calendar.' };
    } catch (error) {
      if (error instanceof GoogleError && error.kind === 'reauth') {
        markNeedsReconnect();
        log.info('integration.needs_reconnect', { provider: PROVIDER });
        return {
          added: false,
          note: 'Saved in CampusMate, but not added to Google Calendar: access expired or was removed. Reconnect it on the Connect page.',
        };
      }
      log.error('integration.push_failed', error, { provider: PROVIDER });
      return {
        added: false,
        note: 'Saved in CampusMate, but Google Calendar could not be reached. It was not added there.',
      };
    }
  }

  /** Records the Google result on the action and in the activity log. */
  async function syncApprovedReminder(
    actionId: string,
    reminder: { text: string; remindAt: string },
  ): Promise<void> {
    const sync = await pushReminder(reminder);
    store.addActionNote(actionId, sync.note);
    if (status().state !== 'not_configured' && store.getIntegration(PROVIDER)) {
      logActivity(store, {
        kind: sync.added ? 'approved' : 'failed',
        tool: 'create_reminder',
        summary: sync.added
          ? `Added “${reminder.text}” to your Google Calendar.`
          : `Not added to Google Calendar: “${reminder.text}”. ${sync.note}`,
        actionId,
      });
    }
  }

  /** Removes the connection here and asks Google to revoke it. */
  async function disconnect(): Promise<void> {
    const record = store.getIntegration(PROVIDER);
    if (!record) return;
    if (google) await google.revoke(box.open(record.refreshTokenEnc));
    store.deleteIntegration(PROVIDER);
    accessToken = undefined;
    log.info('integration.disconnected', { provider: PROVIDER });
  }

  return {
    status,
    authUrl: (state: string) => requireGoogle().authUrl(state),
    complete,
    pushReminder,
    syncApprovedReminder,
    disconnect,
  };
}

export type CalendarIntegration = ReturnType<typeof createCalendarIntegration>;
