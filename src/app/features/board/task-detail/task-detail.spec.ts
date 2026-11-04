import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, throwError } from 'rxjs';
import { NotificationService } from '../../../core/notification.service';
import { PreferencesService } from '../../../core/preferences.service';
import { TaskDetail } from './task-detail';
import { TaskService } from '../task.service';
import { TaskActions } from '../store/task.actions';
import { fixtureTaskValue, provideTaskStoreForTests } from '../store/testing';

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
    vi.restoreAllMocks();
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

    await vi.waitFor(() => expect(component.task()?.status).toBe('done'));
  });

  it('navigates back to the parent board', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
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
      const confirmSpy = vi.spyOn(window, 'confirm');
      const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      open();

      component.deleteTask();

      await vi.waitFor(() => expect(navigateSpy).toHaveBeenCalledWith(['/boards', 'roadmap']));
      expect(confirmSpy).not.toHaveBeenCalled();
      expect(await exists()).toBe(false);
    });

    it('asks for confirmation first and deletes when the user accepts', async () => {
      TestBed.inject(PreferencesService).setConfirmBeforeDelete(true);
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      open();

      component.deleteTask();

      expect(confirmSpy).toHaveBeenCalledOnce();
      await vi.waitFor(() => expect(navigateSpy).toHaveBeenCalled());
      expect(await exists()).toBe(false);
    });

    it('does nothing when the user declines the confirmation prompt', async () => {
      TestBed.inject(PreferencesService).setConfirmBeforeDelete(true);
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      open();

      component.deleteTask();

      expect(await exists()).toBe(true);
      expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('stays on the task and shows the error when the server fails the delete', async () => {
      TestBed.inject(PreferencesService).setConfirmBeforeDelete(false);
      const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      vi.spyOn(TestBed.inject(TaskService), 'delete').mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 500 })),
      );
      const notificationService = TestBed.inject(NotificationService);
      open();

      component.deleteTask();

      await vi.waitFor(() => expect(notificationService.notice()?.kind).toBe('error'));
      expect(navigateSpy).not.toHaveBeenCalled();
      expect(component.task()).toBeDefined();
    });
  });
});
