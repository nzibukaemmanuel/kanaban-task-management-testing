import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Store } from '@ngrx/store';
import { Subject, throwError } from 'rxjs';
import { NotificationService } from '../../../core/notification.service';
import { BoardService } from '../board.service';
import { selectAllTasks } from '../store/task.selectors';
import { BoardDetails } from './board-details';
import { TaskActions } from '../store/task.actions';
import { fixtureTaskValue, loadBoardsForTests, provideTaskStoreForTests } from '../store/testing';
import { waitFor } from '../../../../testing/wait-for';

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
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

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

    await waitFor(() =>
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
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
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
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);

    component.deleteBoard();

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('"roadmap" and its 4 tasks'));
  });

  it('does nothing when the user declines', () => {
    jest.spyOn(window, 'confirm').mockReturnValue(false);
    const navigateSpy = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    component.deleteBoard();

    expect(boards().boardExists('roadmap')).toBe(true);
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('deletes via the API, drops the board and its tasks locally, and returns to the list', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    const navigateSpy = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    component.deleteBoard();

    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith(['/boards']));
    expect(boards().boardExists('roadmap')).toBe(false);
    expect(roadmapTasks()).toEqual([]);
    expect(TestBed.inject(NotificationService).notice()?.message).toBe(
      'Board "roadmap" was deleted.',
    );
  });

  it('keeps the board and its tasks and shows the error when the server fails', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    const navigateSpy = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    jest
      .spyOn(boards(), 'delete')
      .mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

    component.deleteBoard();

    await waitFor(() => expect(TestBed.inject(NotificationService).notice()?.kind).toBe('error'));
    expect(boards().boardExists('roadmap')).toBe(true);
    expect(roadmapTasks().length).toBe(4);
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});

describe('BoardDetails — template', () => {
  let fixture: ComponentFixture<BoardDetails>;

  const el = () => fixture.nativeElement as HTMLElement;
  const text = (node: Element | null | undefined) => node?.textContent?.replace(/\s+/g, ' ').trim();
  const columns = () => Array.from(el().querySelectorAll('.board-column'));
  const headings = () => columns().map((column) => text(column.querySelector('h2')));
  const titlesIn = (column: Element) =>
    Array.from(column.querySelectorAll('.task-card__title')).map((title) => text(title));
  const render = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };

  async function setup(inputs: Record<string, unknown> = { boardId: 'platform-launch' }) {
    TestBed.configureTestingModule({
      imports: [BoardDetails],
      providers: [provideRouter([]), provideTaskStoreForTests()],
    });
    fixture = TestBed.createComponent(BoardDetails);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await loadBoardsForTests();
    await render();
  }

  it('shows the board id as the page heading', async () => {
    await setup({ boardId: 'roadmap' });

    expect(text(el().querySelector('h1'))).toBe('roadmap');
  });

  it('renders a column per status with the number of tasks in it', async () => {
    await setup();

    expect(headings()).toEqual(['Todo (3)', 'Doing (2)', 'Done (1)']);
  });

  it('places each task card in the column of its status, sorted by title', async () => {
    await setup();

    const [todo, doing, done] = columns();
    expect(titlesIn(todo)).toEqual(['Prepare press kit', 'QA sign-off', 'Write launch docs']);
    expect(titlesIn(doing)).toEqual(['Design review', 'Run beta testing']);
    expect(titlesIn(done)).toEqual(['Define MVP scope']);
  });

  it('links each card to its task detail route', async () => {
    await setup();

    const card = el().querySelector<HTMLAnchorElement>('.task-card')!;
    expect(card.getAttribute('href')).toMatch(/\/tasks\/[a-z0-9-]+$/);
  });

  it('summarises subtask progress on a card via the subtaskProgress pipe', async () => {
    await setup();

    const meta = Array.from(el().querySelectorAll('.task-card__meta')).map((node) => text(node));
    expect(meta).toContain('3 of 3 subtasks');
  });

  it('omits the progress line for a task with no subtasks', async () => {
    await setup({ boardId: 'roadmap' });
    TestBed.inject(Store).dispatch(
      TaskActions.updateTask({
        boardId: 'roadmap',
        taskId: 'q1-goals',
        task: fixtureTaskValue('roadmap', 'q1-goals', { subtasks: [] }),
      }),
    );
    await waitFor(() =>
      expect(fixture.componentInstance.tasks().find((t) => t.id === 'q1-goals')?.subtasks).toEqual(
        [],
      ),
    );
    await render();

    const card = Array.from(el().querySelectorAll('.task-card')).find(
      (node) => text(node.querySelector('.task-card__title')) === 'Set Q1 goals',
    );
    expect(card).toBeDefined();
    expect(card?.querySelector('.task-card__meta')).toBeNull();
  });

  it('narrows the board to the single matching column when a status filter is set', async () => {
    await setup({ boardId: 'platform-launch', status: 'doing' });

    expect(headings()).toEqual(['Doing (2)']);
  });

  it('updates the columns when the status input changes', async () => {
    await setup();

    fixture.componentRef.setInput('status', 'done');
    await render();

    expect(headings()).toEqual(['Done (1)']);
  });

  it('shows "No tasks" in a column that has none', async () => {
    await setup({ boardId: 'platform-launch' });
    TestBed.inject(Store).dispatch(
      TaskActions.deleteTask({ boardId: 'platform-launch', taskId: 'define-scope' }),
    );
    await waitFor(() => expect(fixture.componentInstance.tasks().length).toBe(5));
    await render();

    expect(text(columns()[2].querySelector('.board-column__empty'))).toBe('No tasks');
    expect(headings()[2]).toBe('Done (0)');
  });

  it('reflects a task moved to another status without a reload', async () => {
    await setup();

    TestBed.inject(Store).dispatch(
      TaskActions.updateTask({
        boardId: 'platform-launch',
        taskId: 'press-kit',
        task: fixtureTaskValue('platform-launch', 'press-kit', { status: 'done' }),
      }),
    );
    await waitFor(() =>
      expect(fixture.componentInstance.tasks().find((t) => t.id === 'press-kit')?.status).toBe(
        'done',
      ),
    );
    await render();

    expect(headings()).toEqual(['Todo (2)', 'Doing (2)', 'Done (2)']);
    expect(titlesIn(columns()[2])).toContain('Prepare press kit');
  });

  it('wires the Add New Task link and the Delete board button into the toolbar', async () => {
    await setup();

    const add = el().querySelector<HTMLAnchorElement>('.board-toolbar a.btn');
    expect(text(add)).toBe('+ Add New Task');
    expect(add?.getAttribute('href')).toContain('new-task');
    expect(text(el().querySelector('.btn-secondary'))).toBe('Delete board');
  });

  it('disables the Delete board button and relabels it while a delete is in flight', async () => {
    await setup({ boardId: 'roadmap' });
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    jest.spyOn(TestBed.inject(BoardService), 'delete').mockReturnValue(new Subject<void>());

    fixture.componentInstance.deleteBoard();
    await render();

    const button = el().querySelector<HTMLButtonElement>('.btn-secondary')!;
    expect(button.disabled).toBe(true);
    expect(text(button)).toBe('Deleting…');
  });

  it('navigates back to the board list from the footer button', async () => {
    await setup();
    const navigateSpy = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    el().querySelector<HTMLButtonElement>('.page-nav button')!.click();

    expect(navigateSpy).toHaveBeenCalledWith(['/boards']);
  });

  it('shows the not-found page instead of an empty board for an unknown board id', async () => {
    await setup({ boardId: 'does-not-exist' });

    expect(el().querySelector('app-not-found')).not.toBeNull();
    expect(el().querySelector('.board-page')).toBeNull();
  });

  it('shows a loading indicator, not the board, until the data has loaded', async () => {
    TestBed.configureTestingModule({
      imports: [BoardDetails],
      providers: [provideRouter([]), provideTaskStoreForTests({ seeded: false })],
    });
    fixture = TestBed.createComponent(BoardDetails);
    fixture.componentRef.setInput('boardId', 'platform-launch');
    await render();

    expect(text(el().querySelector('.data-state'))).toContain('Loading board…');
    expect(el().querySelector('.board-page')).toBeNull();
  });
});
