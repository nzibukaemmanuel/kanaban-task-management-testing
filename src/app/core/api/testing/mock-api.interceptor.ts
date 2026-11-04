import {
  HttpErrorResponse,
  HttpEvent,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import { MOCK_API_LATENCY_MS } from './mock-api.config';
import { MockApiDb, MockApiError } from './mock-api.db';

// Stands in for a backend: requests under API_BASE_URL are answered from MockApiDb instead of
// going out over the network, with a simulated latency. Anything else passes through untouched.
// The route table mirrors a json-server style REST API, so replacing this with a real backend
// means removing the interceptor — the data services don't change.
export const mockApiInterceptor: HttpInterceptorFn = (req, next) => {
  const baseUrl = inject(API_BASE_URL);
  if (!req.url.startsWith(`${baseUrl}/`)) {
    return next(req);
  }
  const db = inject(MockApiDb);
  const latency = inject(MOCK_API_LATENCY_MS);
  const path = req.url.slice(baseUrl.length + 1);

  let response: Observable<HttpEvent<unknown>>;
  try {
    db.assertAvailable();
    response = of(respond(req, path, db));
  } catch (error) {
    response = throwError(() => toHttpError(req, error));
  }
  return response.pipe(delay(latency));
};

function respond(req: HttpRequest<unknown>, path: string, db: MockApiDb): HttpResponse<unknown> {
  const [collection, id] = path.split('/');
  const ok = (body: unknown, status = 200) => new HttpResponse({ status, body, url: req.url });

  if (collection === 'boards') {
    if (!id && req.method === 'GET') return ok(db.listBoards());
    if (!id && req.method === 'POST') return ok(db.createBoard(req.body as never), 201);
    if (id && req.method === 'DELETE') {
      db.deleteBoard(decodeURIComponent(id));
      return ok(null, 204);
    }
  }

  if (collection === 'tasks') {
    const taskId = id ? decodeURIComponent(id) : null;
    if (!taskId && req.method === 'GET') return ok(db.listTasks(req.params.get('boardId')));
    if (!taskId && req.method === 'POST') return ok(db.createTask(req.body as never), 201);
    if (taskId && req.method === 'GET') return ok(db.getTask(taskId));
    if (taskId && req.method === 'PUT') return ok(db.replaceTask(taskId, req.body as never));
    if (taskId && req.method === 'PATCH') return ok(db.patchTask(taskId, req.body as never));
    if (taskId && req.method === 'DELETE') {
      db.deleteTask(taskId);
      return ok(null, 204);
    }
  }

  throw new MockApiError(404, `No mock route for ${req.method} /${path}.`);
}

function toHttpError(req: HttpRequest<unknown>, error: unknown): HttpErrorResponse {
  const apiError =
    error instanceof MockApiError ? error : new MockApiError(500, 'Mock API crashed.');
  return new HttpErrorResponse({
    status: apiError.status,
    statusText: apiError.message,
    error: { message: apiError.message },
    url: req.url,
  });
}
