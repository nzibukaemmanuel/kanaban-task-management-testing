import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { firstValueFrom, ReplaySubject, throwError } from 'rxjs';
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
    vi.spyOn(taskService, 'list').mockReturnValue(serverError());
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
    vi.spyOn(taskService, 'delete').mockReturnValue(serverError());
    actions$.next(TaskActions.deleteTask({ boardId: 'roadmap', taskId: 'q1-goals' }));

    const result = await firstValueFrom(effects.deleteTask$);

    expect(result.type).toBe(TaskActions.deleteTaskFailure.type);
    if (result.type === TaskActions.deleteTaskFailure.type) {
      expect(result.error).toContain("Couldn't delete the task");
    }
  });
});
