import { TestBed } from '@angular/core/testing';
import {
  provideRouter,
  Router,
  withComponentInputBinding,
  withRouterConfig,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Store } from '@ngrx/store';
import { routes } from '../../app.routes';
import { AuthService } from '../../core/auth.service';
import { NotificationService } from '../../core/notification.service';
import { PreferencesService } from '../../core/preferences.service';
import { waitFor } from '../../../testing/wait-for';
import { BoardService } from './board.service';
import { BOARD_TASKS } from './board-data';
import { TaskActions } from './store/task.actions';
import { selectAllTasks } from './store/task.selectors';
import { fixtureTaskValue, loadBoardsForTests, provideTaskStoreForTests } from './store/testing';

// Several real components, the real router config, the real store + effects and the real
// services (talking to the in-memory mock API) wired together exactly as in the app. Each test
// follows one user action and asserts that *every* component showing that data agrees.
describe('Board data flow across components (integration)', () => {
  let harness: RouterTestingHarness;
  let router: Router;

  const el = () => harness.routeNativeElement as HTMLElement;
  const text = (node: Element | null | undefined) => node?.textContent?.replace(/\s+/g, ' ').trim();
  const all = (selector: string) => Array.from(el().querySelectorAll(selector));
  const settle = async () => {
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  };
  const columnHeadings = () => all('.board-column h2').map((heading) => text(heading));
  const cardTitles = () => all('.task-card__title').map((title) => text(title));
  const sidebarBoards = () => all('.board-sidebar__label').map((label) => text(label));
  const boardCardText = (boardId: string) =>
    text(
      all('.board-card').find((card) => text(card.querySelector('.board-card__name')) === boardId),
    );
  const store = () => TestBed.inject(Store);
  const storedTasks = () => store().selectSignal(selectAllTasks)();

  const typeInto = (input: HTMLInputElement, value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  const submit = (form: HTMLFormElement | null) =>
    form!.dispatchEvent(new Event('submit', { cancelable: true }));

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          routes,
          withComponentInputBinding(),
          withRouterConfig({ paramsInheritanceStrategy: 'always' }),
        ),
        provideTaskStoreForTests(),
      ],
    });
    harness = await RouterTestingHarness.create();
    router = TestBed.inject(Router);
    TestBed.inject(AuthService).login('MANNAZ', 'NZIBUKA123');
    await loadBoardsForTests();
  });

  afterEach(() => localStorage.clear());

  describe('boards list and sidebar', () => {
    it('shows every board once, with the task count taken from the store', async () => {
      await harness.navigateByUrl('/boards');
      await settle();

      for (const [boardId, tasks] of Object.entries(BOARD_TASKS)) {
        expect(boardCardText(boardId)).toContain(`${tasks.length} tasks`);
      }
      expect(sidebarBoards()).toEqual(Object.keys(BOARD_TASKS));
    });

    it('moves between boards from the sidebar, keeping the URL, heading and active link in step', async () => {
      await harness.navigateByUrl('/boards/platform-launch');
      await settle();

      (
        all('.board-sidebar__link').find((link) => text(link) === 'marketing-plan') as HTMLElement
      ).click();
      await waitFor(() => expect(router.url).toBe('/boards/marketing-plan'));
      await settle();

      expect(text(el().querySelector('h1'))).toBe('marketing-plan');
      expect(all('.board-sidebar__link--active').map((link) => text(link))).toEqual([
        'marketing-plan',
      ]);
      const expectedTitles = BOARD_TASKS['marketing-plan'].map((task) => task.title).sort();
      expect([...cardTitles()].sort()).toEqual(expectedTitles);
    });
  });

  describe('a task added to the store', () => {
    it('appears in the board columns at once and in the boards-list count after navigating back', async () => {
      await harness.navigateByUrl('/boards/roadmap');
      await settle();
      const before = BOARD_TASKS['roadmap'].length;
      expect(cardTitles()).toHaveLength(before);

      store().dispatch(
        TaskActions.addTask({
          boardId: 'roadmap',
          task: { ...fixtureTaskValue('roadmap', 'q1-goals'), title: 'Flow-added task' },
        }),
      );
      await waitFor(() =>
        expect(storedTasks().some((t) => t.title === 'Flow-added task')).toBe(true),
      );
      await settle();

      expect(cardTitles()).toContain('Flow-added task');
      expect(cardTitles()).toHaveLength(before + 1);

      await harness.navigateByUrl('/boards');
      await settle();
      expect(boardCardText('roadmap')).toContain(`${before + 1} tasks`);
    });
  });

  describe('editing a task through the UI', () => {
    it('saves, returns to the detail page, and every view of the task shows the new title', async () => {
      await harness.navigateByUrl('/boards/roadmap/tasks/q1-goals/edit');
      await settle();

      typeInto(
        el().querySelector<HTMLInputElement>('app-edit-task input[type="text"]')!,
        'Q1 goals (revised)',
      );
      harness.detectChanges();
      submit(el().querySelector('app-edit-task form'));

      await waitFor(() => expect(router.url).toBe('/boards/roadmap/tasks/q1-goals'));
      await settle();

      // TaskDetail (nested route) and BoardDetails' own columns read the same store slice.
      expect(text(el().querySelector('app-task-detail h2'))).toBe('Q1 goals (revised)');
      expect(cardTitles()).toContain('Q1 goals (revised)');
      expect(cardTitles()).not.toContain('Set Q1 goals');
      expect(TestBed.inject(NotificationService).notice()).toEqual({
        message: '"Q1 goals (revised)" was updated.',
        kind: 'success',
      });
    });
  });

  describe('a status change in the store', () => {
    it('moves the card between columns and updates the task detail badge together', async () => {
      await harness.navigateByUrl('/boards/roadmap/tasks/q1-goals');
      await settle();
      expect(text(el().querySelector('.status-badge'))).toBe('In progress');
      const doingBefore = columnHeadings()[1];

      store().dispatch(
        TaskActions.updateTask({
          boardId: 'roadmap',
          taskId: 'q1-goals',
          task: fixtureTaskValue('roadmap', 'q1-goals', { status: 'done' }),
        }),
      );
      await waitFor(() =>
        expect(storedTasks().find((t) => t.id === 'q1-goals')?.status).toBe('done'),
      );
      await settle();

      expect(text(el().querySelector('.status-badge'))).toBe('Done');
      expect(columnHeadings()[1]).not.toBe(doingBefore);
      const doneColumn = all('.board-column').find((column) =>
        text(column.querySelector('h2'))?.startsWith('Done'),
      )!;
      expect(
        Array.from(doneColumn.querySelectorAll('.task-card__title')).map((t) => text(t)),
      ).toContain('Set Q1 goals');
    });
  });

  describe('deleting a task through the UI', () => {
    it('returns to the board with the card gone and the counts reduced everywhere', async () => {
      TestBed.inject(PreferencesService).setConfirmBeforeDelete(false);
      const before = BOARD_TASKS['roadmap'].length;
      await harness.navigateByUrl('/boards/roadmap/tasks/q1-goals');
      await settle();

      el().querySelector<HTMLButtonElement>('app-task-detail .btn-secondary')!.click();
      await waitFor(() => expect(router.url).toBe('/boards/roadmap'));
      await settle();

      expect(cardTitles()).not.toContain('Set Q1 goals');
      expect(cardTitles()).toHaveLength(before - 1);
      expect(TestBed.inject(NotificationService).notice()?.message).toBe(
        '"Set Q1 goals" was deleted.',
      );

      await harness.navigateByUrl('/boards');
      await settle();
      expect(boardCardText('roadmap')).toContain(`${before - 1} tasks`);
    });

    it('does nothing when the user declines the confirmation', async () => {
      jest.spyOn(window, 'confirm').mockReturnValue(false);
      await harness.navigateByUrl('/boards/roadmap/tasks/q1-goals');
      await settle();

      el().querySelector<HTMLButtonElement>('app-task-detail .btn-secondary')!.click();
      await settle();

      expect(router.url).toBe('/boards/roadmap/tasks/q1-goals');
      expect(storedTasks().some((t) => t.id === 'q1-goals')).toBe(true);
    });
  });

  describe('creating and deleting boards', () => {
    it('lists a newly created board in the list and the sidebar, and opens it empty', async () => {
      await harness.navigateByUrl('/boards');
      await settle();

      typeInto(el().querySelector<HTMLInputElement>('.new-board input')!, 'Sprint Planning');
      harness.detectChanges();
      submit(el().querySelector('.new-board'));
      await waitFor(() =>
        expect(TestBed.inject(BoardService).boardExists('sprint-planning')).toBe(true),
      );
      await settle();

      expect(boardCardText('sprint-planning')).toContain('0 tasks');
      expect(sidebarBoards()).toContain('sprint-planning');

      await harness.navigateByUrl('/boards/sprint-planning');
      await settle();
      expect(text(el().querySelector('h1'))).toBe('sprint-planning');
      expect(all('.board-column__empty')).toHaveLength(3);
    });

    it('removes a deleted board, its tasks and its sidebar entry, and then reports it as not found', async () => {
      jest.spyOn(window, 'confirm').mockReturnValue(true);
      await harness.navigateByUrl('/boards/roadmap');
      await settle();

      el().querySelector<HTMLButtonElement>('.board-toolbar .btn-secondary')!.click();
      await waitFor(() => expect(router.url).toBe('/boards'));
      await settle();

      expect(boardCardText('roadmap')).toBeUndefined();
      expect(sidebarBoards()).not.toContain('roadmap');
      expect(storedTasks().some((t) => t.boardId === 'roadmap')).toBe(false);
      expect(storedTasks().some((t) => t.boardId === 'platform-launch')).toBe(true);

      await harness.navigateByUrl('/boards/roadmap');
      await settle();
      expect(el().querySelector('app-not-found')).not.toBeNull();
    });
  });

  describe('filter and sort controls', () => {
    it('shows only the matching column for ?status=, straight from the URL', async () => {
      await harness.navigateByUrl('/boards/platform-launch?status=doing');
      await settle();

      expect(columnHeadings()).toEqual([
        `Doing (${BOARD_TASKS['platform-launch'].filter((t) => t.status === 'doing').length})`,
      ]);
    });

    it('writes the chosen status to the URL and re-renders the columns', async () => {
      await harness.navigateByUrl('/boards/platform-launch');
      await settle();

      el().querySelectorAll<HTMLButtonElement>('.board-toolbar .select-trigger')[0].click();
      harness.detectChanges();
      const options = Array.from(
        el().querySelectorAll<HTMLLIElement>('.board-toolbar .select-option'),
      );
      options.find((option) => text(option) === 'Done')!.click();

      await waitFor(() => expect(router.url).toContain('status=done'));
      await settle();
      expect(columnHeadings()).toHaveLength(1);
      expect(columnHeadings()[0]).toMatch(/^Done/);
    });

    const todoTitles = () =>
      Array.from(all('.board-column')[0].querySelectorAll('.task-card__title')).map((t) => text(t));
    const seededTodo = BOARD_TASKS['platform-launch'].filter((t) => t.status === 'todo');

    it('orders cards by title within each column by default', async () => {
      await harness.navigateByUrl('/boards/platform-launch');
      await settle();

      expect(todoTitles()).toEqual(seededTodo.map((t) => t.title).sort());
    });

    it('keeps the stored order within a column when sorting by status (every card there ties)', async () => {
      await harness.navigateByUrl('/boards/platform-launch?sort=status');
      await settle();

      expect(todoTitles()).toEqual(seededTodo.map((t) => t.title));
    });
  });

  describe('logging in', () => {
    it('sends a visitor who hit a guarded board to the login form, then back to that exact board', async () => {
      TestBed.inject(AuthService).logout();
      await harness.navigateByUrl('/boards/roadmap/tasks/q1-goals');
      await settle();
      expect(router.url).toBe('/login?returnUrl=%2Fboards%2Froadmap%2Ftasks%2Fq1-goals');

      const [username, password] = all('.login-form input') as HTMLInputElement[];
      typeInto(username, 'MANNAZ');
      typeInto(password, 'NZIBUKA123');
      harness.detectChanges();
      submit(el().querySelector('.login-form'));

      await waitFor(() => expect(router.url).toBe('/boards/roadmap/tasks/q1-goals'));
      await settle();
      expect(text(el().querySelector('app-task-detail h2'))).toBe('Set Q1 goals');
    });

    it('keeps the add-board form hidden from visitors who are not logged in', async () => {
      TestBed.inject(AuthService).logout();
      await harness.navigateByUrl('/boards');
      await settle();

      expect(el().querySelector('.new-board')).toBeNull();
      expect(all('.board-card').length).toBeGreaterThan(0);
    });
  });
});

describe('Load failure and retry (integration)', () => {
  let harness: RouterTestingHarness;

  const el = () => harness.routeNativeElement as HTMLElement;
  const settle = async () => {
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  };

  beforeEach(async () => {
    localStorage.setItem('kanban-mock-api-fail', 'true');
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          routes,
          withComponentInputBinding(),
          withRouterConfig({ paramsInheritanceStrategy: 'always' }),
        ),
        provideTaskStoreForTests({ seeded: false }),
      ],
    });
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => localStorage.clear());

  it('shows the error, then recovers through the retry output once the server is back', async () => {
    const boards = TestBed.inject(BoardService);
    boards.load();
    TestBed.inject(Store).dispatch(TaskActions.loadTasks());
    await harness.navigateByUrl('/boards');
    await waitFor(() => expect(boards.error()).not.toBeNull());
    await settle();

    const alert = el().querySelector('.data-state--error');
    expect(alert?.textContent).toContain("Couldn't load boards");
    expect(el().querySelector('.board-list')).toBeNull();

    localStorage.removeItem('kanban-mock-api-fail');
    el().querySelector<HTMLButtonElement>('.data-state button')!.click();
    await waitFor(() => expect(boards.loaded()).toBe(true));
    await waitFor(() => expect(el().querySelector('.board-list')).not.toBeNull());
    await settle();

    expect(el().querySelector('.data-state--error')).toBeNull();
    expect(el().querySelectorAll('.board-card').length).toBeGreaterThan(0);
  });
});
