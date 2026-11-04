import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, Subject, throwError } from 'rxjs';
import { NotificationService } from '../../../core/notification.service';
import { PreferencesService } from '../../../core/preferences.service';
import { TaskDetail } from './task-detail';
import { TaskService } from '../task.service';
import { TaskActions } from '../store/task.actions';
import { fixtureTaskValue, provideTaskStoreForTests } from '../store/testing';
import { waitFor } from '../../../../testing/wait-for';

describe('TaskDetail', () => {
  let component: TaskDetail;
  let fixture: ComponentFixture<TaskDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaskDetail],
      providers: [provideRouter([]), provideTaskStoreForTests()],
    }).compileComponents();

    fixture = TestBed.createComponent(TaskDetail);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('resolves the task matching boardId + taskId', () => {
    fixture.componentRef.setInput('boardId', 'roadmap');
    fixture.componentRef.setInput('taskId', 'q1-goals');

    expect(component.task()?.title).toBe('Set Q1 goals');
  });

  it('returns undefined when the task does not exist on that board', () => {
    fixture.componentRef.setInput('boardId', 'roadmap');
    fixture.componentRef.setInput('taskId', 'not-a-real-task');

    expect(component.task()).toBeUndefined();
  });

  it('reflects an update dispatched through the store without needing a reload', async () => {
    fixture.componentRef.setInput('boardId', 'roadmap');
    fixture.componentRef.setInput('taskId', 'q1-goals');
    const store = TestBed.inject(Store);

    store.dispatch(
      TaskActions.updateTask({
        boardId: 'roadmap',
        taskId: 'q1-goals',
        task: fixtureTaskValue('roadmap', 'q1-goals', { status: 'done' }),
      }),
    );

    await waitFor(() => expect(component.task()?.status).toBe('done'));
  });

  it('navigates back to the parent board', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.componentRef.setInput('boardId', 'roadmap');

    component.goToBoard();

    expect(navigateSpy).toHaveBeenCalledWith(['/boards', 'roadmap']);
  });

  describe('deleteTask', () => {
    const open = (taskId = 'q1-goals') => {
      fixture.componentRef.setInput('boardId', 'roadmap');
      fixture.componentRef.setInput('taskId', taskId);
    };
    const exists = async () =>
      (await firstValueFrom(TestBed.inject(TaskService).list('roadmap'))).some(
        (t) => t.id === 'q1-goals',
      );

    it('deletes the task on the server and navigates back to the board when confirmation is off', async () => {
      TestBed.inject(PreferencesService).setConfirmBeforeDelete(false);
      const confirmSpy = jest.spyOn(window, 'confirm');
      const navigateSpy = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      open();

      component.deleteTask();

      await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith(['/boards', 'roadmap']));
      expect(confirmSpy).not.toHaveBeenCalled();
      expect(await exists()).toBe(false);
    });

    it('asks for confirmation first and deletes when the user accepts', async () => {
      TestBed.inject(PreferencesService).setConfirmBeforeDelete(true);
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
      const navigateSpy = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      open();

      component.deleteTask();

      expect(confirmSpy).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(navigateSpy).toHaveBeenCalled());
      expect(await exists()).toBe(false);
    });

    it('does nothing when the user declines the confirmation prompt', async () => {
      TestBed.inject(PreferencesService).setConfirmBeforeDelete(true);
      jest.spyOn(window, 'confirm').mockReturnValue(false);
      const navigateSpy = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      open();

      component.deleteTask();

      expect(await exists()).toBe(true);
      expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('stays on the task and shows the error when the server fails the delete', async () => {
      TestBed.inject(PreferencesService).setConfirmBeforeDelete(false);
      const navigateSpy = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      jest
        .spyOn(TestBed.inject(TaskService), 'delete')
        .mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
      const notificationService = TestBed.inject(NotificationService);
      open();

      component.deleteTask();

      await waitFor(() => expect(notificationService.notice()?.kind).toBe('error'));
      expect(navigateSpy).not.toHaveBeenCalled();
      expect(component.task()).toBeDefined();
    });
  });
});

describe('TaskDetail — template', () => {
  let fixture: ComponentFixture<TaskDetail>;

  const el = () => fixture.nativeElement as HTMLElement;
  const text = (node: Element | null | undefined) => node?.textContent?.replace(/\s+/g, ' ').trim();
  const render = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };

  async function open(boardId = 'roadmap', taskId = 'q1-goals') {
    TestBed.configureTestingModule({
      imports: [TaskDetail],
      providers: [provideRouter([]), provideTaskStoreForTests()],
    });
    fixture = TestBed.createComponent(TaskDetail);
    fixture.componentRef.setInput('boardId', boardId);
    fixture.componentRef.setInput('taskId', taskId);
    await render();
  }

  afterEach(() => localStorage.clear());

  it('shows the task title as a heading', async () => {
    await open();

    expect(text(el().querySelector('h2'))).toBe('Set Q1 goals');
  });

  it('shows the status as a readable label, keeping the raw key for styling', async () => {
    await open();

    const badge = el().querySelector('.status-badge');
    expect(text(badge)).toBe('In progress');
    expect(badge?.getAttribute('data-status')).toBe('doing');
  });

  it('shows the description and a formatted due date', async () => {
    await open();

    expect(text(el().querySelector('.task-detail-card__description'))).toBe(
      'Set and align on Q1 OKRs across teams.',
    );
    expect(text(el().querySelector('.task-detail-card__due-date'))).toBe('Due Sep 15, 2026');
  });

  it('lists subtasks as disabled checkboxes that reflect their completion', async () => {
    await open();

    const rows = Array.from(el().querySelectorAll('.task-detail-card__subtask-list li'));
    expect(rows.map((row) => text(row))).toEqual(['Review last quarter results', 'Draft OKRs']);
    const boxes = rows.map((row) => row.querySelector<HTMLInputElement>('input')!);
    expect(boxes.map((box) => box.checked)).toEqual([true, false]);
    expect(boxes.every((box) => box.disabled)).toBe(true);
    expect(boxes.map((box) => box.getAttribute('aria-label'))).toEqual([
      'Review last quarter results',
      'Draft OKRs',
    ]);
  });

  it('strikes through only the completed subtasks', async () => {
    await open();

    const labels = Array.from(el().querySelectorAll('.task-detail-card__subtask-list span'));
    expect(labels.map((label) => label.classList.contains('done'))).toEqual([true, false]);
  });

  it('summarises completed subtasks out of the total', async () => {
    await open();

    expect(text(el().querySelector('.task-detail-card__subtasks-summary'))).toBe('Subtasks (1/2)');
  });

  it('hides the optional description, due date and subtasks when the task has none', async () => {
    await open();
    TestBed.inject(Store).dispatch(
      TaskActions.updateTask({
        boardId: 'roadmap',
        taskId: 'q1-goals',
        task: fixtureTaskValue('roadmap', 'q1-goals', {
          description: '',
          dueDate: '',
          subtasks: [],
        }),
      }),
    );
    await waitFor(() => expect(fixture.componentInstance.task()?.subtasks).toEqual([]));
    await render();

    expect(el().querySelector('.task-detail-card__description')).toBeNull();
    expect(el().querySelector('.task-detail-card__due-date')).toBeNull();
    expect(el().querySelector('.task-detail-card__subtasks')).toBeNull();
  });

  it('updates the status badge and subtask summary when the task changes in the store', async () => {
    await open();

    TestBed.inject(Store).dispatch(
      TaskActions.updateTask({
        boardId: 'roadmap',
        taskId: 'q1-goals',
        task: fixtureTaskValue('roadmap', 'q1-goals', {
          status: 'done',
          subtasks: [
            { id: 'q1-goals-1', title: 'Review last quarter results', completed: true },
            { id: 'q1-goals-2', title: 'Draft OKRs', completed: true },
          ],
        }),
      }),
    );
    await waitFor(() => expect(fixture.componentInstance.task()?.status).toBe('done'));
    await render();

    expect(text(el().querySelector('.status-badge'))).toBe('Done');
    expect(text(el().querySelector('.task-detail-card__subtasks-summary'))).toBe('Subtasks (2/2)');
  });

  it('links Edit task to the edit route', async () => {
    await open();

    const edit = el().querySelector<HTMLAnchorElement>('.task-detail-card__actions a.btn');
    expect(text(edit)).toBe('Edit task');
    expect(edit?.getAttribute('href')).toContain('edit');
  });

  it('disables the delete button and relabels it while a delete is in flight', async () => {
    await open();
    // Hold the request open so the task is still on screen while the delete is pending.
    jest.spyOn(TestBed.inject(TaskService), 'delete').mockReturnValue(new Subject<void>());
    TestBed.inject(Store).dispatch(
      TaskActions.deleteTask({ boardId: 'roadmap', taskId: 'q1-goals' }),
    );
    await render();

    const button = el().querySelector<HTMLButtonElement>('.btn-secondary')!;
    expect(button.disabled).toBe(true);
    expect(text(button)).toBe('Deleting…');
  });

  it('shows the delete button enabled when nothing is being saved', async () => {
    await open();

    const button = el().querySelector<HTMLButtonElement>('.btn-secondary')!;
    expect(button.disabled).toBe(false);
    expect(text(button)).toBe('Delete task');
  });

  it('returns to the board from the back button', async () => {
    await open();
    const navigateSpy = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    el().querySelector<HTMLButtonElement>('.btn-tertiary')!.click();

    expect(navigateSpy).toHaveBeenCalledWith(['/boards', 'roadmap']);
  });

  it('shows a not-found message with only a back button for an unknown task', async () => {
    await open('roadmap', 'ghost');

    expect(text(el().querySelector('.empty-state'))).toBe('Task not found.');
    expect(el().querySelector('h2')).toBeNull();
    expect(el().querySelector('a.btn')).toBeNull();
    expect(el().querySelectorAll('button')).toHaveLength(1);
  });

  it('does not show the same task id under a different board', async () => {
    await open('marketing-plan', 'q1-goals');

    expect(text(el().querySelector('.empty-state'))).toBe('Task not found.');
  });

  it('switches to another task when the taskId input changes', async () => {
    await open();

    fixture.componentRef.setInput('taskId', 'prioritize-features');
    await render();

    expect(text(el().querySelector('h2'))).toBe('Prioritize features');
  });
});

describe('TaskDetail — deleting when there is no task to delete', () => {
  it('does not prompt, dispatch or navigate', async () => {
    TestBed.configureTestingModule({
      imports: [TaskDetail],
      providers: [provideRouter([]), provideTaskStoreForTests()],
    });
    const fixture = TestBed.createComponent(TaskDetail);
    fixture.componentRef.setInput('boardId', 'roadmap');
    fixture.componentRef.setInput('taskId', 'ghost');
    await fixture.whenStable();
    const confirmSpy = jest.spyOn(window, 'confirm');
    const dispatchSpy = jest.spyOn(TestBed.inject(Store), 'dispatch');
    const navigateSpy = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    fixture.componentInstance.deleteTask();

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(dispatchSpy).not.toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
