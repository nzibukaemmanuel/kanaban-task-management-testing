// Development build — talks to the json-server REST API from `npm run api` (server/db.json).
// Start the API first; json-server answers CORS requests for any origin.
import type { Environment } from './environment.model';

export const environment: Environment = {
  production: false,
  apiUrl: 'http://localhost:3000',
};
