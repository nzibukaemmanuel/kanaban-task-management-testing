import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Store } from '@ngrx/store';
import { throwError } from 'rxjs';
import { NotificationService } from '../../../core/notification.service';
import { BoardService } from '../board.service';
import { selectAllTasks } from '../store/task.selectors';
import { BoardDetails } from './board-details';
import { TaskActions } from '../store/task.actions';
import { fixtureTaskValue, loadBoardsForTests, provideTaskStoreForTests } from '../store/testing';

describe('BoardDetails', () => {
  let component: BoardDetails;
  let fixture: ComponentFixture<BoardDetails>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BoardDetails],
      providers: [provideRouter([]), provideTaskStoreForTests()],
    }).compileComponents();

    fixture = TestBed.createComponent(BoardDetails);
    component = fixture.componentInstance;
    await loadBoardsForTests();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('navigates back to /boards', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    component.goBack();

    expect(navigateSpy).toHaveBeenCalledWith(['/boards']);
  });

  it("lists all of a board's tasks sorted by title by default", () => {
    fixture.componentRef.setInput('boardId', 'platform-launch');

    expect(component.tasks().map((t) => t.title)).toEqual([
      'Define MVP scope',
      'Design review',
      'Prepare press kit',
      'QA sign-off',
      'Run beta testing',
      'Write launch docs',
    ]);
  });

  it('filters tasks by the status query param', () => {
    fixture.componentRef.setInput('boardId', 'platform-launch');
    fixture.componentRef.setInput('status', 'todo');

    expect(component.tasks().map((t) => t.id)).toEqual(['press-kit', 'qa-signoff', 'write-docs']);
  });

  it('sorts tasks by status when the sort query param is "status"', () => {
    fixture.componentRef.setInput('boardId', 'platform-launch');
    fixture.componentRef.setInput('sort', 'status');

    expect(component.tasks().map((t) => t.status)).toEqual([
      'doing',
      'doing',
      'done',
      'todo',
      'todo',
      'todo',
    ]);
  });

  it('falls back to defaults when the router clears status/sort inputs to undefined (e.g. after a child-route nav that drops query params)', () => {
    fixture.componentRef.setInput('boardId', 'platform-launch');
    fixture.componentRef.setInput('status', undefined);
    fixture.componentRef.setInput('sort', undefined);

    expect(component.tasks().map((t) => t.title)).toEqual([
      'Define MVP scope',
      'Design review',
      'Prepare press kit',
      'QA sign-off',
      'Run beta testing',
      'Write launch docs',
    ]);
  });

  it('returns no tasks for an unknown board', () => {
    fixture.componentRef.setInput('boardId', 'does-not-exist');

    expect(component.tasks()).toEqual([]);
  });

  it('flags an unknown board id as not existing', () => {
    fixture.componentRef.setInput('boardId', 'does-not-exist');

    expect(component.boardExists()).toBe(false);
  });

  it('flags a real board id as existing', () => {
    fixture.componentRef.setInput('boardId', 'platform-launch');

    expect(component.boardExists()).toBe(true);
  });

  it('reflects an update dispatched through the store without needing a reload', async () => {
    fixture.componentRef.setInput('boardId', 'platform-launch');
    const store = TestBed.inject(Store);

    store.dispatch(
      TaskActions.updateTask({
        boardId: 'platform-launch',
        taskId: 'write-docs',
        task: fixtureTaskValue('platform-launch', 'write-docs', {
          title: 'Write launch docs (v2)',
        }),
      }),
    );

    await vi.waitFor(() =>
      expect(component.tasks().map((t) => t.title)).toContain('Write launch docs (v2)'),
    );
  });

  it('is unaffected by an edit made to a task on a different board', () => {
    fixture.componentRef.setInput('boardId', 'platform-launch');
    const store = TestBed.inject(Store);
    const before = component.tasks();

    store.dispatch(
      TaskActions.updateTask({
        boardId: 'roadmap',
        taskId: 'q1-goals',
        task: fixtureTaskValue('roadmap', 'q1-goals', { title: 'Renamed elsewhere' }),
      }),
    );

    expect(component.tasks()).toEqual(before);
  });

  it('merges new query params onto the current route when filtering/sorting', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const route = TestBed.inject(ActivatedRoute);

    component.updateQueryParams({ status: 'done' });

    expect(navigateSpy).toHaveBeenCalledWith([], {
      relativeTo: route,
      queryParams: { status: 'done' },
      queryParamsHandling: 'merge',
    });
  });
});

describe('BoardDetails — deleting a board', () => {
  let component: BoardDetails;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [BoardDetails],
      providers: [provideRouter([]), provideTaskStoreForTests()],
    });
    const fixture = TestBed.createComponent(BoardDetails);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('boardId', 'roadmap');
    await loadBoardsForTests();
  });

  const boards = () => TestBed.inject(BoardService);
  const roadmapTasks = () =>
    TestBed.inject(Store)
      .selectSignal(selectAllTasks)()
      .filter((task) => task.boardId === 'roadmap');

  it('asks for confirmation naming the board and how many tasks go with it', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    component.deleteBoard();

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('"roadmap" and its 4 tasks'));
  });

  it('does nothing when the user declines', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    component.deleteBoard();

    expect(boards().boardExists('roadmap')).toBe(true);
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('deletes via the API, drops the board and its tasks locally, and returns to the list', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    component.deleteBoard();

    await vi.waitFor(() => expect(navigateSpy).toHaveBeenCalledWith(['/boards']));
    expect(boards().boardExists('roadmap')).toBe(false);
    expect(roadmapTasks()).toEqual([]);
    expect(TestBed.inject(NotificationService).notice()?.message).toBe(
      'Board "roadmap" was deleted.',
    );
  });

  it('keeps the board and its tasks and shows the error when the server fails', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    vi.spyOn(boards(), 'delete').mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );

    component.deleteBoard();

    await vi.waitFor(() =>
      expect(TestBed.inject(NotificationService).notice()?.kind).toBe('error'),
    );
    expect(boards().boardExists('roadmap')).toBe(true);
    expect(roadmapTasks().length).toBe(4);
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
