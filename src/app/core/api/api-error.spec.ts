import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
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
});
