import type {
  AbilitiesResponse,
  AbilityName,
  AbilityResponse,
  UpdateAbilityRequest,
} from '@shared/types';
import { apiRequest } from './apiClient';

export const listAbilities = () => apiRequest<AbilitiesResponse>('/api/abilities');

export const setAbility = (name: AbilityName, enabled: boolean) => {
  const body: UpdateAbilityRequest = { enabled };
  return apiRequest<AbilityResponse>(`/api/abilities/${encodeURIComponent(name)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
};
