import { TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import { BoardDataStatus } from './board-data-status';
import { BoardService } from './board.service';
import { TaskActions } from './store/task.actions';
import { loadBoardsForTests, provideTaskStoreForTests } from './store/testing';

describe('BoardDataStatus', () => {
  const setup = (seeded: boolean) => {
    TestBed.configureTestingModule({ providers: [provideTaskStoreForTests({ seeded })] });
    return {
      status: TestBed.inject(BoardDataStatus),
      boards: TestBed.inject(BoardService),
      store: TestBed.inject(Store),
    };
  };

  it('is loading until both boards and tasks have arrived', async () => {
    const { status } = setup(true);

    expect(status.ready()).toBe(false);
    expect(status.loading()).toBe(true);

    await loadBoardsForTests();

    expect(status.ready()).toBe(true);
    expect(status.loading()).toBe(false);
    expect(status.error()).toBeNull();
  });

  it('stays loading while only the boards are in but the tasks are not', async () => {
    const { status } = setup(false);

    await loadBoardsForTests();

    expect(status.ready()).toBe(false);
    expect(status.loading()).toBe(true);
  });

  it('reports a failed task fetch as an error, and clears it once a retry succeeds', async () => {
    const { status, store } = setup(false);
    await loadBoardsForTests();
    localStorage.setItem('kanban-mock-api-fail', 'true');

    store.dispatch(TaskActions.loadTasks());
    await vi.waitFor(() => expect(status.error()).toContain("Couldn't load tasks"));
    expect(status.loading()).toBe(false);

    localStorage.removeItem('kanban-mock-api-fail');
    status.retry();
    await vi.waitFor(() => expect(status.ready()).toBe(true));
    expect(status.error()).toBeNull();
  });

  it('reports a failed board fetch as an error and retries only the boards', async () => {
    const { status, boards } = setup(true);
    localStorage.setItem('kanban-mock-api-fail', 'true');

    boards.load();
    await vi.waitFor(() => expect(status.error()).toContain("Couldn't load boards"));

    localStorage.removeItem('kanban-mock-api-fail');
    status.retry();
    await vi.waitFor(() => expect(status.ready()).toBe(true));
  });

  it('does not treat a failed write as a load error once tasks are loaded', () => {
    const { status, store } = setup(true);

    store.dispatch(TaskActions.deleteTaskFailure({ error: 'Could not delete.' }));

    expect(status.error()).toBeNull();
  });

  afterEach(() => localStorage.removeItem('kanban-mock-api-fail'));
});
