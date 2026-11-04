import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { MOCK_API_LATENCY_MS } from '../../core/api/testing/mock-api.config';
import { NotificationService } from '../../core/notification.service';
import { AddTask } from './add-task/add-task';
import { BoardService } from './board.service';
import { TaskActions } from './store/task.actions';
import {
  selectAllTasks,
  selectTasksError,
  selectTasksLoaded,
  selectTasksLoading,
  selectTasksSaving,
} from './store/task.selectors';
import { provideTaskStoreForTests } from './store/testing';

const LATENCY = 100;

const newTask = (title: string) => ({
  title,
  description: '',
  status: 'todo' as const,
  dueDate: '',
  subtasks: [],
});

// The mock API answers after MOCK_API_LATENCY_MS. With fake timers the in-flight window becomes
// something a test can step through: assert the "waiting" state, advance the clock, then assert
// the settled state — instead of racing real time.
describe('asynchronous state transitions (fake timers)', () => {
  let store: Store;

  const snapshot = () => ({
    loading: store.selectSignal(selectTasksLoading)(),
    loaded: store.selectSignal(selectTasksLoaded)(),
    saving: store.selectSignal(selectTasksSaving)(),
    error: store.selectSignal(selectTasksError)(),
    ids: store
      .selectSignal(selectAllTasks)()
      .map((task) => task.id),
    titles: store
      .selectSignal(selectAllTasks)()
      .map((task) => task.title),
  });

  function configure(options: { seeded: boolean }) {
    jest.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTaskStoreForTests(options),
        { provide: MOCK_API_LATENCY_MS, useValue: LATENCY },
      ],
    });
    store = TestBed.inject(Store);
  }

  afterEach(() => {
    jest.useRealTimers();
    localStorage.removeItem('kanban-mock-api-fail');
  });

  describe('loading tasks', () => {
    beforeEach(() => configure({ seeded: false }));

    it('is loading, and not loaded, while the request is in flight', async () => {
      store.dispatch(TaskActions.loadTasks());
      await jest.advanceTimersByTimeAsync(LATENCY - 1);

      expect(snapshot()).toMatchObject({ loading: true, loaded: false, ids: [] });
    });

    it('settles to loaded, with every task, once the latency has passed', async () => {
      store.dispatch(TaskActions.loadTasks());
      await jest.advanceTimersByTimeAsync(LATENCY);

      expect(snapshot()).toMatchObject({ loading: false, loaded: true, error: null });
      expect(snapshot().ids).toHaveLength(16);
    });

    it('reports a failure only after the latency, and stays not loaded', async () => {
      localStorage.setItem('kanban-mock-api-fail', 'true');
      store.dispatch(TaskActions.loadTasks());

      await jest.advanceTimersByTimeAsync(LATENCY - 1);
      expect(snapshot().error).toBeNull();

      await jest.advanceTimersByTimeAsync(1);
      expect(snapshot()).toMatchObject({ loading: false, loaded: false });
      expect(snapshot().error).toContain("Couldn't load tasks");
    });

    it('recovers when a retry is dispatched after a failure', async () => {
      localStorage.setItem('kanban-mock-api-fail', 'true');
      store.dispatch(TaskActions.loadTasks());
      await jest.advanceTimersByTimeAsync(LATENCY);
      expect(snapshot().error).not.toBeNull();

      localStorage.removeItem('kanban-mock-api-fail');
      store.dispatch(TaskActions.loadTasks());
      expect(snapshot()).toMatchObject({ loading: true, error: null });
      await jest.advanceTimersByTimeAsync(LATENCY);

      expect(snapshot()).toMatchObject({ loaded: true, loading: false, error: null });
    });

    it('lets a second load supersede the first (switchMap) and still settles once', async () => {
      store.dispatch(TaskActions.loadTasks());
      await jest.advanceTimersByTimeAsync(LATENCY / 2);
      store.dispatch(TaskActions.loadTasks());

      await jest.advanceTimersByTimeAsync(LATENCY / 2);
      expect(snapshot().loaded).toBe(false); // the first response was dropped

      await jest.advanceTimersByTimeAsync(LATENCY / 2);
      expect(snapshot()).toMatchObject({ loaded: true, loading: false });
    });
  });

  describe('loading boards', () => {
    beforeEach(() => configure({ seeded: false }));

    it('reports loading until the boards arrive, then loaded', async () => {
      const boards = TestBed.inject(BoardService);

      boards.load();
      await jest.advanceTimersByTimeAsync(LATENCY - 1);
      expect(boards.loading()).toBe(true);
      expect(boards.loaded()).toBe(false);

      await jest.advanceTimersByTimeAsync(1);
      expect(boards.loading()).toBe(false);
      expect(boards.loaded()).toBe(true);
      expect(boards.boardIds()).toContain('platform-launch');
    });

    it('does not fire a second request while the first is still waiting', async () => {
      const boards = TestBed.inject(BoardService);
      const get = jest.spyOn(TestBed.inject(HttpClient), 'get');

      boards.load();
      boards.load();
      boards.load(true);
      await jest.advanceTimersByTimeAsync(LATENCY);

      expect(get).toHaveBeenCalledTimes(1);
      expect(boards.loaded()).toBe(true);
    });

    it('shows a readable error after the latency when loading boards fails', async () => {
      localStorage.setItem('kanban-mock-api-fail', 'true');
      const boards = TestBed.inject(BoardService);

      boards.load();
      expect(boards.error()).toBeNull();
      await jest.advanceTimersByTimeAsync(LATENCY);

      expect(boards.error()).toContain("Couldn't load boards");
      expect(boards.loading()).toBe(false);
    });
  });

  describe('saving tasks', () => {
    beforeEach(() => configure({ seeded: true }));

    it('raises saving while an add is in flight and only adds the task once the server answers', async () => {
      store.dispatch(TaskActions.addTask({ boardId: 'roadmap', task: newTask('Async add') }));
      await jest.advanceTimersByTimeAsync(LATENCY - 1);

      expect(snapshot().saving).toBe(true);
      expect(snapshot().titles).not.toContain('Async add');

      await jest.advanceTimersByTimeAsync(1);

      expect(snapshot().saving).toBe(false);
      expect(snapshot().titles).toContain('Async add');
    });

    it('keeps the task until the delete is confirmed, then removes it', async () => {
      store.dispatch(TaskActions.deleteTask({ boardId: 'roadmap', taskId: 'q1-goals' }));
      await jest.advanceTimersByTimeAsync(LATENCY - 1);
      expect(snapshot().ids).toContain('q1-goals');
      expect(snapshot().saving).toBe(true);

      await jest.advanceTimersByTimeAsync(1);

      expect(snapshot().ids).not.toContain('q1-goals');
      expect(snapshot().saving).toBe(false);
    });

    it('processes writes one at a time, in dispatch order (concatMap)', async () => {
      store.dispatch(TaskActions.addTask({ boardId: 'roadmap', task: newTask('First') }));
      store.dispatch(TaskActions.addTask({ boardId: 'roadmap', task: newTask('Second') }));

      await jest.advanceTimersByTimeAsync(LATENCY);
      expect(snapshot().titles).toContain('First');
      expect(snapshot().titles).not.toContain('Second');

      await jest.advanceTimersByTimeAsync(LATENCY);
      expect(snapshot().titles).toEqual(expect.arrayContaining(['First', 'Second']));
      expect(snapshot().titles.indexOf('First')).toBeLessThan(snapshot().titles.indexOf('Second'));
    });

    it('records a failed write only after the latency and keeps the existing tasks', async () => {
      const before = snapshot().ids;
      localStorage.setItem('kanban-mock-api-fail', 'true');
      store.dispatch(TaskActions.addTask({ boardId: 'roadmap', task: newTask('Doomed') }));

      await jest.advanceTimersByTimeAsync(LATENCY - 1);
      expect(snapshot().error).toBeNull();

      await jest.advanceTimersByTimeAsync(1);
      expect(snapshot().error).toContain("Couldn't add the task");
      expect(snapshot()).toMatchObject({ saving: false, ids: before });
    });

    it('rejects a duplicate title after the latency with the server message', async () => {
      store.dispatch(TaskActions.addTask({ boardId: 'roadmap', task: newTask('Set Q1 goals') }));

      await jest.advanceTimersByTimeAsync(LATENCY);

      expect(snapshot().error).toContain('already exists');
      expect(snapshot().saving).toBe(false);
    });
  });

  describe('AddTask waiting for the server', () => {
    beforeEach(() => configure({ seeded: true }));

    it('navigates and notifies only after the save has completed', async () => {
      const navigate = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      const notifications = TestBed.inject(NotificationService);
      const fixture = TestBed.createComponent(AddTask);
      fixture.componentRef.setInput('boardId', 'roadmap');
      fixture.detectChanges();

      fixture.componentInstance.onSave({ ...newTask('Awaited'), status: 'todo' });
      await jest.advanceTimersByTimeAsync(LATENCY - 1);

      expect(navigate).not.toHaveBeenCalled();
      expect(notifications.notice()).toBeNull();
      expect(fixture.componentInstance.saving()).toBe(true);

      await jest.advanceTimersByTimeAsync(1);

      expect(navigate).toHaveBeenCalledWith(['/boards', 'roadmap']);
      expect(notifications.notice()).toEqual({ message: '"Awaited" was added.', kind: 'success' });
      expect(fixture.componentInstance.saving()).toBe(false);
    });

    it('stays on the page, with an error shown, when the save fails', async () => {
      localStorage.setItem('kanban-mock-api-fail', 'true');
      const navigate = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      const notifications = TestBed.inject(NotificationService);
      const fixture = TestBed.createComponent(AddTask);
      fixture.componentRef.setInput('boardId', 'roadmap');
      fixture.detectChanges();

      fixture.componentInstance.onSave({ ...newTask('Awaited'), status: 'todo' });
      await jest.advanceTimersByTimeAsync(LATENCY);

      expect(navigate).not.toHaveBeenCalled();
      expect(notifications.notice()?.kind).toBe('error');
    });
  });
});
