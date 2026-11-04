import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  Router,
  provideRouter,
  withComponentInputBinding,
  withRouterConfig,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { AuthService } from '../../core/auth.service';
import { AddTask } from './add-task/add-task';
import { BoardDetails } from './board-details/board-details';
import { EditTask } from './edit-task/edit-task';
import { TaskDetail } from './task-detail/task-detail';
import { loadBoardsForTests, provideTaskStoreForTests } from './store/testing';

// Exercises Add/Edit Task through the *real* router config (the same one main.ts boots),
// rather than the per-component/per-route-array unit specs elsewhere. Those confirm each piece
// in isolation; this confirms the pieces actually cooperate — auth redirects, the router
// resolving to the right component for a URL, and canDeactivate genuinely blocking/allowing
// navigation depending on what the user chooses in the confirm dialog.
describe('Task form navigation (integration)', () => {
  let harness: RouterTestingHarness;
  let authService: AuthService;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter(
          routes,
          withComponentInputBinding(),
          withRouterConfig({ paramsInheritanceStrategy: 'always' }),
        ),
        provideTaskStoreForTests(),
      ],
    }).compileComponents();

    harness = await RouterTestingHarness.create();
    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  // BoardDetails owns its own nested <router-outlet> for new-task/edit/tasks/:id, so it — not
  // the nested child — is what the harness's outermost outlet resolves to for any
  // /boards/:boardId/... URL. This drills into that nested outlet for the real child instance.
  function findComponent<T>(type: Type<T>): T | undefined {
    return harness.routeDebugElement?.query(By.directive(type))?.componentInstance as T | undefined;
  }

  // BoardDetails also renders its own "Status"/"Sort by" filter dropdowns (built from the same
  // SelectField) above the nested outlet, so an unscoped querySelector('.select-trigger') can
  // grab the wrong one. Scoping to the nested component's own element avoids that entirely.
  function findElement<T>(type: Type<T>): HTMLElement {
    const el = harness.routeDebugElement?.query(By.directive(type))?.nativeElement as
      HTMLElement | undefined;
    if (!el) {
      throw new Error(`Expected to find a rendered ${type.name} in the current route.`);
    }
    return el;
  }

  it('redirects an unauthenticated visitor away from /boards/:boardId/new-task, to /login with a returnUrl', async () => {
    await harness.navigateByUrl('/boards/roadmap/new-task');

    expect(router.url).toBe('/login?returnUrl=%2Fboards%2Froadmap%2Fnew-task');
  });

  it('redirects an unauthenticated visitor away from an edit-task route too', async () => {
    await harness.navigateByUrl('/boards/roadmap/tasks/q1-goals/edit');

    expect(router.url).toBe('/login?returnUrl=%2Fboards%2Froadmap%2Ftasks%2Fq1-goals%2Fedit');
  });

  it('leaves the boards list open to everyone, but still guards a specific board', async () => {
    await harness.navigateByUrl('/boards');
    expect(router.url).toBe('/boards');

    await harness.navigateByUrl('/boards/roadmap');
    expect(router.url).toContain('/login');
  });

  describe('once authenticated', () => {
    beforeEach(async () => {
      authService.login('MANNAZ', 'NZIBUKA123');
      await loadBoardsForTests();
    });

    it('resolves /boards/:boardId/new-task to the AddTask component', async () => {
      await harness.navigateByUrl('/boards/roadmap/new-task', BoardDetails);

      const addTask = findComponent(AddTask);
      expect(addTask).toBeTruthy();
      expect(addTask?.boardId()).toBe('roadmap');
    });

    it('resolves /boards/:boardId/tasks/:taskId/edit to the EditTask component, prefilled with that task', async () => {
      await harness.navigateByUrl('/boards/roadmap/tasks/q1-goals/edit', BoardDetails);

      const editTask = findComponent(EditTask);
      expect(editTask?.task()?.title).toBe('Set Q1 goals');
    });

    it('resolves /boards/:boardId to BoardDetails', async () => {
      const component = await harness.navigateByUrl('/boards/roadmap', BoardDetails);

      expect(component).toBeInstanceOf(BoardDetails);
    });

    it('resolves /boards/:boardId/tasks/:taskId to TaskDetail', async () => {
      await harness.navigateByUrl('/boards/roadmap/tasks/q1-goals', BoardDetails);

      const taskDetail = findComponent(TaskDetail);
      expect(taskDetail?.task()?.title).toBe('Set Q1 goals');
    });

    it('navigating from the board to "new-task" and back leaves the task list showing the new task', async () => {
      await harness.navigateByUrl('/boards/roadmap/new-task', BoardDetails);
      const addTaskEl = findElement(AddTask);

      const titleInput = addTaskEl.querySelector('input[type="text"]') as HTMLInputElement;
      titleInput.value = 'Integration-tested task';
      titleInput.dispatchEvent(new Event('input'));
      harness.detectChanges();

      // Status is required too — without picking one, the form stays invalid and submit()
      // never emits save/navigates at all. Options render placeholder, todo, doing, done —
      // index 1 ("todo") is the first real choice.
      (addTaskEl.querySelector('.select-trigger') as HTMLButtonElement).click();
      harness.detectChanges();
      (addTaskEl.querySelectorAll('.select-option')[1] as HTMLLIElement).click();
      harness.detectChanges();

      const form = addTaskEl.querySelector('form') as HTMLFormElement;
      form.dispatchEvent(new Event('submit', { cancelable: true }));
      harness.detectChanges();
      await harness.fixture.whenStable();

      expect(router.url).toBe('/boards/roadmap');
      const boardDetails = await harness.navigateByUrl('/boards/roadmap', BoardDetails);
      expect(boardDetails.tasks().map((t) => t.title)).toContain('Integration-tested task');
    });

    it('blocks navigating away from a dirty Add Task form when the user cancels the confirm dialog', async () => {
      await harness.navigateByUrl('/boards/roadmap/new-task', BoardDetails);

      const titleInput = findElement(AddTask).querySelector(
        'input[type="text"]',
      ) as HTMLInputElement;
      titleInput.value = 'Draft, not saved';
      titleInput.dispatchEvent(new Event('input'));
      harness.detectChanges();

      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

      await router.navigateByUrl('/boards/roadmap');

      expect(confirmSpy).toHaveBeenCalled();
      expect(router.url).toBe('/boards/roadmap/new-task');
    });

    it('allows navigating away from a dirty Add Task form when the user confirms', async () => {
      await harness.navigateByUrl('/boards/roadmap/new-task', BoardDetails);

      const titleInput = findElement(AddTask).querySelector(
        'input[type="text"]',
      ) as HTMLInputElement;
      titleInput.value = 'Draft, not saved';
      titleInput.dispatchEvent(new Event('input'));
      harness.detectChanges();

      vi.spyOn(window, 'confirm').mockReturnValue(true);

      await router.navigateByUrl('/boards/roadmap');

      expect(router.url).toBe('/boards/roadmap');
    });
  });
});
