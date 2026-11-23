import type { AttendanceResponse, TodayResponse } from '@shared/types';
import { apiRequest } from './apiClient';

export const getToday = () => apiRequest<TodayResponse>('/api/today');

export const getAttendance = () => apiRequest<AttendanceResponse>('/api/attendance');
