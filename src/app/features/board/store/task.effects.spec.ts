import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { firstValueFrom, ReplaySubject, Subject, throwError } from 'rxjs';
import { waitFor } from '../../../../testing/wait-for';
import { TaskDto } from '../../../core/api/api.models';
import { MOCK_API_LATENCY_MS } from '../../../core/api/testing/mock-api.config';
import { mockApiInterceptor } from '../../../core/api/testing/mock-api.interceptor';
import { TaskService } from '../task.service';
import { TaskActions } from './task.actions';
import { fixtureTaskValue } from './testing';
import { TaskEffects } from './task.effects';

// Each effect runs against the real TaskService and the in-memory mock API (zero latency), so
// these cover the whole action → HTTP request → result action leg of the flow. Failure paths
// swap the service call for an error to prove the stream turns it into a Failure action.
describe('TaskEffects', () => {
  let actions$: ReplaySubject<unknown>;
  let effects: TaskEffects;
  let taskService: TaskService;

  const newTask = {
    title: 'Effect-added task',
    description: '',
    status: 'todo' as const,
    dueDate: '',
    subtasks: [],
  };
  const dtoFor = (title: string): TaskDto => ({
    ...newTask,
    id: title.toLowerCase(),
    boardId: 'roadmap',
    title,
  });
  const serverError = () => throwError(() => new HttpErrorResponse({ status: 500 }));

  beforeEach(() => {
    actions$ = new ReplaySubject(1);
    TestBed.configureTestingModule({
      providers: [
        TaskEffects,
        provideMockActions(() => actions$),
        provideHttpClient(withInterceptors([mockApiInterceptor])),
        { provide: MOCK_API_LATENCY_MS, useValue: 0 },
      ],
    });
    effects = TestBed.inject(TaskEffects);
    taskService = TestBed.inject(TaskService);
  });

  it('loadTasks$ fetches every task from the API, each tagged with its board id', async () => {
    actions$.next(TaskActions.loadTasks());

    const result = await firstValueFrom(effects.loadTasks$);

    expect(result.type).toBe(TaskActions.loadTasksSuccess.type);
    if (result.type === TaskActions.loadTasksSuccess.type) {
      expect(result.tasks.find((t) => t.id === 'q1-goals')?.boardId).toBe('roadmap');
      expect(result.tasks.length).toBe(16);
    }
  });

  it('loadTasks$ reports a readable failure instead of erroring the stream', async () => {
    jest.spyOn(taskService, 'list').mockReturnValue(serverError());
    actions$.next(TaskActions.loadTasks());

    const result = await firstValueFrom(effects.loadTasks$);

    expect(result.type).toBe(TaskActions.loadTasksFailure.type);
    if (result.type === TaskActions.loadTasksFailure.type) {
      expect(result.error).toContain("Couldn't load tasks");
    }
  });

  it('addTask$ creates the task on the server and reports it back with its board id', async () => {
    actions$.next(TaskActions.addTask({ boardId: 'roadmap', task: newTask }));

    const result = await firstValueFrom(effects.addTask$);

    expect(result.type).toBe(TaskActions.addTaskSuccess.type);
    if (result.type === TaskActions.addTaskSuccess.type) {
      expect(result.task.boardId).toBe('roadmap');
      expect(result.task.title).toBe('Effect-added task');
      expect(result.task.id).toBeTruthy();
    }
  });

  it('addTask$ surfaces a server rejection (duplicate title) as a Failure with the server message', async () => {
    actions$.next(
      TaskActions.addTask({ boardId: 'roadmap', task: { ...newTask, title: 'Set Q1 goals' } }),
    );

    const result = await firstValueFrom(effects.addTask$);

    expect(result.type).toBe(TaskActions.addTaskFailure.type);
    if (result.type === TaskActions.addTaskFailure.type) {
      expect(result.error).toContain('already exists');
    }
  });

  it('updateTask$ replaces the task (PUT) and reports an Update<TaskEntity>', async () => {
    actions$.next(
      TaskActions.updateTask({
        boardId: 'roadmap',
        taskId: 'q1-goals',
        task: fixtureTaskValue('roadmap', 'q1-goals', { status: 'done' }),
      }),
    );

    const result = await firstValueFrom(effects.updateTask$);

    expect(result.type).toBe(TaskActions.updateTaskSuccess.type);
    if (result.type === TaskActions.updateTaskSuccess.type) {
      expect(result.update.id).toBe('q1-goals');
      expect(result.update.changes).toMatchObject({ status: 'done', boardId: 'roadmap' });
    }
  });

  it('updateTask$ reports a Failure when the task no longer exists', async () => {
    actions$.next(
      TaskActions.updateTask({
        boardId: 'roadmap',
        taskId: 'ghost',
        task: fixtureTaskValue('roadmap', 'q1-goals'),
      }),
    );

    const result = await firstValueFrom(effects.updateTask$);

    expect(result.type).toBe(TaskActions.updateTaskFailure.type);
  });

  it('deleteTask$ deletes the task and reports its id', async () => {
    actions$.next(TaskActions.deleteTask({ boardId: 'roadmap', taskId: 'q1-goals' }));

    const result = await firstValueFrom(effects.deleteTask$);

    expect(result).toEqual(TaskActions.deleteTaskSuccess({ taskId: 'q1-goals' }));
    const remaining = await firstValueFrom(taskService.list('roadmap'));
    expect(remaining.some((t) => t.id === 'q1-goals')).toBe(false);
  });

  it('deleteTask$ reports a readable Failure when the server errors', async () => {
    jest.spyOn(taskService, 'delete').mockReturnValue(serverError());
    actions$.next(TaskActions.deleteTask({ boardId: 'roadmap', taskId: 'q1-goals' }));

    const result = await firstValueFrom(effects.deleteTask$);

    expect(result.type).toBe(TaskActions.deleteTaskFailure.type);
    if (result.type === TaskActions.deleteTaskFailure.type) {
      expect(result.error).toContain("Couldn't delete the task");
    }
  });

  it('addTask$ keeps working after a failure — the stream is not killed', async () => {
    const results: { type: string }[] = [];
    const subscription = effects.addTask$.subscribe((action) => results.push(action));

    actions$.next(
      TaskActions.addTask({ boardId: 'roadmap', task: { ...newTask, title: 'Set Q1 goals' } }),
    );
    await waitFor(() => expect(results).toHaveLength(1));
    actions$.next(TaskActions.addTask({ boardId: 'roadmap', task: newTask }));
    await waitFor(() => expect(results).toHaveLength(2));
    subscription.unsubscribe();

    expect(results.map((r) => r.type)).toEqual([
      TaskActions.addTaskFailure.type,
      TaskActions.addTaskSuccess.type,
    ]);
  });

  it('addTask$ hands the board id and task to the service', async () => {
    const createSpy = jest.spyOn(taskService, 'create');
    actions$.next(TaskActions.addTask({ boardId: 'roadmap', task: newTask }));

    await firstValueFrom(effects.addTask$);

    expect(createSpy).toHaveBeenCalledWith('roadmap', newTask);
  });

  it('updateTask$ hands the board id, task id and task to the service', async () => {
    const updateSpy = jest.spyOn(taskService, 'update');
    const task = fixtureTaskValue('roadmap', 'q1-goals', { status: 'done' });
    actions$.next(TaskActions.updateTask({ boardId: 'roadmap', taskId: 'q1-goals', task }));

    await firstValueFrom(effects.updateTask$);

    expect(updateSpy).toHaveBeenCalledWith('roadmap', 'q1-goals', task);
  });

  it('addTask$ and updateTask$ report readable failures on a server error', async () => {
    jest.spyOn(taskService, 'create').mockReturnValue(serverError());
    jest.spyOn(taskService, 'update').mockReturnValue(serverError());

    actions$.next(TaskActions.addTask({ boardId: 'roadmap', task: newTask }));
    const added = await firstValueFrom(effects.addTask$);
    actions$.next(
      TaskActions.updateTask({ boardId: 'roadmap', taskId: 'q1-goals', task: newTask }),
    );
    const updated = await firstValueFrom(effects.updateTask$);

    expect(added).toMatchObject({ type: TaskActions.addTaskFailure.type });
    expect((added as { error: string }).error).toContain("Couldn't add the task");
    expect(updated).toMatchObject({ type: TaskActions.updateTaskFailure.type });
    expect((updated as { error: string }).error).toContain("Couldn't update the task");
  });

  it('writes run one at a time, in dispatch order (concatMap)', () => {
    const first = new Subject<TaskDto>();
    const second = new Subject<TaskDto>();
    const createSpy = jest
      .spyOn(taskService, 'create')
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second);
    const results: string[] = [];
    const subscription = effects.addTask$.subscribe((action) => {
      if (action.type === TaskActions.addTaskSuccess.type) {
        results.push(action.task.title);
      }
    });

    actions$.next(TaskActions.addTask({ boardId: 'roadmap', task: { ...newTask, title: 'A' } }));
    actions$.next(TaskActions.addTask({ boardId: 'roadmap', task: { ...newTask, title: 'B' } }));
    // B is queued behind A: its request is not sent until A has finished.
    expect(createSpy).toHaveBeenCalledTimes(1);

    first.next(dtoFor('A'));
    first.complete();
    expect(createSpy).toHaveBeenCalledTimes(2);
    second.next(dtoFor('B'));
    second.complete();
    subscription.unsubscribe();

    expect(results).toEqual(['A', 'B']);
  });

  it('loadTasks$ drops a pending load when a newer one starts (switchMap)', () => {
    const stale = new Subject<TaskDto[]>();
    const fresh = new Subject<TaskDto[]>();
    jest.spyOn(taskService, 'list').mockReturnValueOnce(stale).mockReturnValueOnce(fresh);
    const results: unknown[] = [];
    const subscription = effects.loadTasks$.subscribe((action) => results.push(action));

    actions$.next(TaskActions.loadTasks());
    actions$.next(TaskActions.loadTasks());
    stale.next([dtoFor('stale')]);
    fresh.next([dtoFor('fresh')]);
    subscription.unsubscribe();

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ tasks: [dtoFor('fresh')] });
  });

  it('ignores actions it does not handle', () => {
    const results: unknown[] = [];
    const subscription = effects.deleteTask$.subscribe((action) => results.push(action));

    actions$.next(TaskActions.boardRemoved({ boardId: 'roadmap' }));
    subscription.unsubscribe();

    expect(results).toEqual([]);
  });
});
