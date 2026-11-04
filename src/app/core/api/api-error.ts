import { HttpErrorResponse } from '@angular/common/http';

// Turns whatever a failed request threw into one sentence a user can act on. Kept free of Angular
// DI so effects, services and specs can all call it the same way.
export function describeHttpError(error: unknown, action: string): string {
  if (!(error instanceof HttpErrorResponse)) {
    return `Couldn't ${action}. Something unexpected went wrong.`;
  }
  // The server's own message wins when it sent one (e.g. "A task titled … already exists").
  const serverMessage = typeof error.error?.message === 'string' ? error.error.message : null;
  switch (true) {
    case error.status === 0:
      return `Couldn't ${action}. The server can't be reached — check your connection and try again.`;
    case error.status === 404:
      return serverMessage ?? `Couldn't ${action}. That item no longer exists.`;
    case error.status === 400 || error.status === 409 || error.status === 422:
      return serverMessage ?? `Couldn't ${action}. The server rejected the request.`;
    case error.status >= 500:
      return `Couldn't ${action}. The server ran into a problem — please try again in a moment.`;
    default:
      return serverMessage ?? `Couldn't ${action}. Unexpected response (${error.status}).`;
  }
}
