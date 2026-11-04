import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import { BoardDto, TaskDto } from '../api.models';
import { MOCK_API_LATENCY_MS } from './mock-api.config';
import { mockApiInterceptor } from './mock-api.interceptor';

describe('mockApiInterceptor', () => {
  let http: HttpClient;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([mockApiInterceptor])),
        { provide: API_BASE_URL, useValue: '/api' },
        { provide: MOCK_API_LATENCY_MS, useValue: 0 },
      ],
    });
    http = TestBed.inject(HttpClient);
  });

  afterEach(() => localStorage.removeItem('kanban-mock-api-fail'));

  const failureOf = async (request: Promise<unknown>) => {
    try {
      await request;
    } catch (error) {
      return error as HttpErrorResponse;
    }
    throw new Error('expected the request to fail');
  };

  it('lists the seeded boards', async () => {
    const boards = await firstValueFrom(http.get<BoardDto[]>('/api/boards'));
    expect(boards.map((board) => board.id)).toContain('platform-launch');
  });

  it('filters tasks by boardId', async () => {
    const tasks = await firstValueFrom(
      http.get<TaskDto[]>('/api/tasks', { params: { boardId: 'platform-launch' } }),
    );
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.every((task) => task.boardId === 'platform-launch')).toBe(true);
  });

  it('creates, updates and deletes a task', async () => {
    const created = await firstValueFrom(
      http.post<TaskDto>('/api/tasks', {
        boardId: 'platform-launch',
        title: 'Write release notes',
        description: '',
        status: 'todo',
        dueDate: '',
        subtasks: [],
      }),
    );
    expect(created.id).toContain('write-release-notes');

    const updated = await firstValueFrom(
      http.patch<TaskDto>(`/api/tasks/${created.id}`, { status: 'done' }),
    );
    expect(updated.status).toBe('done');
    expect(updated.title).toBe('Write release notes');

    await firstValueFrom(http.delete(`/api/tasks/${created.id}`));
    const after = await failureOf(firstValueFrom(http.get(`/api/tasks/${created.id}`)));
    expect(after.status).toBe(404);
  });

  it('PUT replaces the whole task, clearing fields the body leaves out', async () => {
    const replaced = await firstValueFrom(
      http.put<TaskDto>('/api/tasks/define-scope', {
        id: 'define-scope',
        boardId: 'platform-launch',
        title: 'Define MVP scope (final)',
        status: 'done',
      }),
    );

    expect(replaced).toMatchObject({
      id: 'define-scope',
      title: 'Define MVP scope (final)',
      description: '',
    });
    expect(replaced.subtasks).toEqual([]);
    const stored = await firstValueFrom(http.get<TaskDto>('/api/tasks/define-scope'));
    expect(stored).toEqual(replaced);
  });

  it('PUT validates the body and the target', async () => {
    const tooShort = await failureOf(
      firstValueFrom(
        http.put('/api/tasks/define-scope', { boardId: 'platform-launch', title: 'ab' }),
      ),
    );
    expect(tooShort.status).toBe(400);
    const missing = await failureOf(
      firstValueFrom(
        http.put('/api/tasks/ghost', { boardId: 'platform-launch', title: 'Valid title' }),
      ),
    );
    expect(missing.status).toBe(404);
    const duplicate = await failureOf(
      firstValueFrom(
        http.put('/api/tasks/define-scope', { boardId: 'platform-launch', title: 'Design review' }),
      ),
    );
    expect(duplicate.status).toBe(409);
  });

  it('rejects a duplicate title on the same board with 409', async () => {
    const error = await failureOf(
      firstValueFrom(
        http.post('/api/tasks', {
          boardId: 'platform-launch',
          title: 'Define MVP scope',
          status: 'todo',
          description: '',
          dueDate: '',
          subtasks: [],
        }),
      ),
    );
    expect(error.status).toBe(409);
    expect(error.error.message).toContain('already exists');
  });

  it('rejects an invalid title with 400', async () => {
    const error = await failureOf(
      firstValueFrom(http.post('/api/tasks', { boardId: 'platform-launch', title: 'ab' })),
    );
    expect(error.status).toBe(400);
  });

  it('answers 404 for a task on a missing board and for unknown routes', async () => {
    const missingBoard = await failureOf(
      firstValueFrom(http.post('/api/tasks', { boardId: 'nope', title: 'Valid title' })),
    );
    expect(missingBoard.status).toBe(404);
    const unknownRoute = await failureOf(firstValueFrom(http.get('/api/widgets')));
    expect(unknownRoute.status).toBe(404);
  });

  it('creates and deletes a board, removing its tasks with it', async () => {
    await firstValueFrom(http.post('/api/boards', { id: 'sandbox' }));
    await firstValueFrom(
      http.post('/api/tasks', { boardId: 'sandbox', title: 'Temp task', status: 'todo' }),
    );
    await firstValueFrom(http.delete('/api/boards/sandbox'));
    const tasks = await firstValueFrom(
      http.get<TaskDto[]>('/api/tasks', { params: { boardId: 'sandbox' } }),
    );
    expect(tasks).toEqual([]);
    const duplicate = await failureOf(
      firstValueFrom(http.post('/api/boards', { id: 'platform-launch' })),
    );
    expect(duplicate.status).toBe(409);
  });

  it('answers 500 for every request while the failure flag is set', async () => {
    localStorage.setItem('kanban-mock-api-fail', 'true');
    const error = await failureOf(firstValueFrom(http.get('/api/boards')));
    expect(error.status).toBe(500);
  });
});

describe('mockApiInterceptor — simulated latency', () => {
  const LATENCY = 250;
  let http: HttpClient;

  beforeEach(() => {
    jest.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([mockApiInterceptor])),
        { provide: API_BASE_URL, useValue: '/api' },
        { provide: MOCK_API_LATENCY_MS, useValue: LATENCY },
      ],
    });
    http = TestBed.inject(HttpClient);
  });

  afterEach(() => {
    jest.useRealTimers();
    localStorage.removeItem('kanban-mock-api-fail');
  });

  it('holds a response back until the latency has elapsed', async () => {
    const received = jest.fn();
    http.get<BoardDto[]>('/api/boards').subscribe(received);

    await jest.advanceTimersByTimeAsync(LATENCY - 1);
    expect(received).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    expect(received).toHaveBeenCalledTimes(1);
    expect(received.mock.calls[0][0].map((board: BoardDto) => board.id)).toContain(
      'platform-launch',
    );
  });

  it('delays failures by the same latency, so errors feel like real round-trips', async () => {
    const failed = jest.fn();
    http.get('/api/tasks/does-not-exist').subscribe({ error: failed });

    await jest.advanceTimersByTimeAsync(LATENCY - 1);
    expect(failed).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    expect(failed).toHaveBeenCalledTimes(1);
    expect((failed.mock.calls[0][0] as HttpErrorResponse).status).toBe(404);
  });

  it('delays the simulated 500 when the failure flag is set', async () => {
    localStorage.setItem('kanban-mock-api-fail', 'true');
    const failed = jest.fn();
    http.get('/api/boards').subscribe({ error: failed });

    await jest.advanceTimersByTimeAsync(LATENCY - 1);
    expect(failed).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    expect((failed.mock.calls[0][0] as HttpErrorResponse).status).toBe(500);
  });

  it('answers concurrent requests independently on the same timeline', async () => {
    const boards = jest.fn();
    const tasks = jest.fn();
    http.get('/api/boards').subscribe(boards);
    await jest.advanceTimersByTimeAsync(100);
    http.get('/api/tasks').subscribe(tasks);

    await jest.advanceTimersByTimeAsync(LATENCY - 100);
    expect(boards).toHaveBeenCalledTimes(1);
    expect(tasks).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(100);
    expect(tasks).toHaveBeenCalledTimes(1);
  });

  it('applies the change at request time but reports it only after the latency', async () => {
    const created = jest.fn();
    http
      .post<TaskDto>('/api/tasks', {
        boardId: 'roadmap',
        title: 'Async created',
        description: '',
        status: 'todo',
        dueDate: '',
        subtasks: [],
      })
      .subscribe(created);
    expect(created).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(LATENCY);

    expect(created).toHaveBeenCalledTimes(1);
    expect(created.mock.calls[0][0]).toMatchObject({ title: 'Async created', boardId: 'roadmap' });
  });

  it('cancels cleanly: an unsubscribed request never delivers', async () => {
    const received = jest.fn();
    const subscription = http.get('/api/boards').subscribe(received);

    subscription.unsubscribe();
    await jest.advanceTimersByTimeAsync(LATENCY * 2);

    expect(received).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });
});
