import { HttpErrorResponse } from '@angular/common/http';
import { describeHttpError } from './api-error';

const failure = (status: number, error?: unknown) => new HttpErrorResponse({ status, error });

describe('describeHttpError', () => {
  it('explains an unreachable server for status 0', () => {
    expect(describeHttpError(failure(0), 'load tasks')).toContain("can't be reached");
  });

  it('prefers the message the server sent for client errors', () => {
    expect(describeHttpError(failure(409, { message: 'Title taken.' }), 'save the task')).toBe(
      'Title taken.',
    );
  });

  it('falls back to a generic message for a 404 with no body', () => {
    expect(describeHttpError(failure(404), 'load the task')).toBe(
      "Couldn't load the task. That item no longer exists.",
    );
  });

  it('hides server internals behind a retry hint for 5xx', () => {
    const message = describeHttpError(failure(500, { message: 'stack trace' }), 'delete the task');
    expect(message).toContain('try again');
    expect(message).not.toContain('stack trace');
  });

  it('handles non-HTTP errors', () => {
    expect(describeHttpError(new Error('boom'), 'load tasks')).toBe(
      "Couldn't load tasks. Something unexpected went wrong.",
    );
  });

  it.each([400, 409, 422])('uses a generic "rejected" message for a %i without a server message', (status) => {
    expect(describeHttpError(failure(status), 'save the task')).toBe(
      "Couldn't save the task. The server rejected the request.",
    );
  });

  it('reports the status code for an unexpected one with no server message', () => {
    expect(describeHttpError(failure(418), 'brew')).toBe("Couldn't brew. Unexpected response (418).");
  });

  it('still prefers the server message for an unexpected status', () => {
    expect(describeHttpError(failure(418, { message: "I'm a teapot." }), 'brew')).toBe("I'm a teapot.");
  });

  it('prefers the server message for a 404 too', () => {
    expect(describeHttpError(failure(404, { message: 'Task "x" doesn\'t exist.' }), 'load')).toBe(
      'Task "x" doesn\'t exist.',
    );
  });

  it('ignores a server message that is not a string', () => {
    expect(describeHttpError(failure(409, { message: 42 }), 'save')).toContain('rejected the request');
  });

  it('never leaks a server message for a 5xx', () => {
    expect(describeHttpError(failure(503, { message: 'db password is hunter2' }), 'load')).not.toContain(
      'hunter2',
    );
  });
});
