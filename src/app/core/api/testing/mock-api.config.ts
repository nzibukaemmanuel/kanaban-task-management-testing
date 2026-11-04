import { InjectionToken } from '@angular/core';

// Test-only: simulated round-trip for the in-memory backend in mock-api.interceptor.ts.
export const MOCK_API_LATENCY_MS = new InjectionToken<number>('MOCK_API_LATENCY_MS', {
  providedIn: 'root',
  factory: () => 0,
});
