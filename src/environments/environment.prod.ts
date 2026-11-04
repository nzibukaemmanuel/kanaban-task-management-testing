import type { Environment } from './environment.model';

// Production build — swapped in for environment.ts by the `fileReplacements` entry in angular.json.
// Set `apiUrl` to the URL of the deployed REST API (same routes as server/db.json: /boards, /tasks).
export const environment: Environment = {
  production: true,
  apiUrl: 'https://kanban-api-h8q1.onrender.com',
};
