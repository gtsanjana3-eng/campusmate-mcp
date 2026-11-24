import type {
  ConnectIntegrationResponse,
  IntegrationStatus,
  IntegrationsResponse,
} from '@shared/types';
import { apiRequest } from './apiClient';

export const getCalendarStatus = async (): Promise<IntegrationStatus | undefined> =>
  (await apiRequest<IntegrationsResponse>('/api/integrations')).integrations.find(
    (i) => i.provider === 'google_calendar',
  );

/** Returns Google's consent page; the browser then leaves CampusMate and comes back to /connect. */
export const startCalendarConnect = () =>
  apiRequest<ConnectIntegrationResponse>('/api/integrations/google/connect', {
    method: 'POST',
    body: '{}',
  });

export const disconnectCalendar = () =>
  apiRequest<void>('/api/integrations/google', { method: 'DELETE' });
