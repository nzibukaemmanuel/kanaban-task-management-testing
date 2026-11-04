import { provideHttpClient } from '@angular/common/http';
import { EnvironmentProviders, Provider } from '@angular/core';
import type { Environment } from '../../../environments/environment.model';
import { API_BASE_URL } from './api.config';

// The one place the active environment decides where data comes from: every request goes over
// the network to `apiUrl`.
export function provideApi(env: Pick<Environment, 'apiUrl'>): (Provider | EnvironmentProviders)[] {
  return [{ provide: API_BASE_URL, useValue: env.apiUrl }, provideHttpClient()];
}
