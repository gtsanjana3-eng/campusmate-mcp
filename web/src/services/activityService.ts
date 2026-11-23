import type { ActivityResponse } from '@shared/types';
import { apiRequest } from './apiClient';

export const listActivity = () => apiRequest<ActivityResponse>('/api/activity?limit=50');
