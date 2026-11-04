import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

// Every data service builds its URLs from these tokens instead of importing `environment`
// directly, so a spec (or a future per-feature config) can override them with a plain provider.
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => environment.apiUrl,
});

export const API_ENDPOINTS = {
  boards: 'boards',
  tasks: 'tasks',
} as const;
