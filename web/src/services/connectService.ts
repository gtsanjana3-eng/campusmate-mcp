import type { ConnectResponse } from '@shared/types';
import { apiRequest } from './apiClient';

export function getConnectInfo(): Promise<ConnectResponse> {
  return apiRequest<ConnectResponse>('/api/connect');
}
