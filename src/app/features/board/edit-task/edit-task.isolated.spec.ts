import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { Actions } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { Subject } from 'rxjs';
import { NotificationService } from '../../../core/notification.service';
import { createMockStore } from '../../../../testing/mock-store';
import { TaskActions } from '../store/task.actions';
import { TaskEntity } from '../store/task.model';
import { selectAllTasks, selectTasksSaving } from '../store/task.selectors';
import { TaskForm, TaskFormValue } from '../task-form/task-form';
import { EditTask } from './edit-task';

// Every collaborator of EditTask is a Jest mock, so these tests exercise only EditTask's own
// logic: which task it shows, what it dispatches, and how it reacts to the outcome.
describe('EditTask (isolated from its services)', () => {
  const task = (id: string, boardId: string, title: string): TaskEntity => ({
    id,
    boardId,
    title,
    description: 'Original',
    status: 'doing',
    dueDate: '2026-09-15',
    subtasks: [],
  });
  const value: TaskFormValue = {
    title: 'Renamed',
    description: 'Original',
    status: 'doing',
    dueDate: '2026-09-15',
    subtasks: [],
  };

  let fixture: ComponentFixture<EditTask>;
  let component: EditTask;
  let store: ReturnType<typeof createMockStore>;
  let actions$: Subject<unknown>;
  const router = { navigate: jest.fn() };
  const notifications = { success: jest.fn(), error: jest.fn() };

  const el = () => fixture.nativeElement as HTMLElement;
  const form = () =>
    fixture.debugElement.query(By.directive(TaskForm)).componentInstance as TaskForm;

  function setup(boardId = 'roadmap', taskId = 'target') {
    store = createMockStore([
      [
        selectAllTasks,
        [
          task('target', 'roadmap', 'Target task'),
          task('sibling', 'roadmap', 'Sibling task'),
          task('target', 'other', 'Same id, other board'),
        ],
      ],
      [selectTasksSaving, false],
    ]);
    actions$ = new Subject();
    TestBed.configureTestingModule({
      imports: [EditTask],
      providers: [
        { provide: Store, useValue: store },
        { provide: Actions, useValue: actions$ },
        { provide: Router, useValue: router },
        { provide: NotificationService, useValue: notifications },
      ],
    });
    fixture = TestBed.createComponent(EditTask);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('boardId', boardId);
    fixture.componentRef.setInput('taskId', taskId);
    fixture.detectChanges();
  }

  describe('with an existing task', () => {
    beforeEach(() => setup());

    it('finds the task by board and id, not by id alone', () => {
      expect(component.task()?.title).toBe('Target task');
    });

    it("excludes the task's own title from the duplicate check but keeps its siblings'", () => {
      expect(component.existingTitles()).toEqual(['Sibling task']);
    });

    it('prefills the form with the task', () => {
      expect(form().initialTask()?.title).toBe('Target task');
    });

    it('dispatches Update Task with the board id, task id and form value', () => {
      component.onSave(value);

      expect(store.dispatch).toHaveBeenCalledTimes(1);
      expect(store.dispatch).toHaveBeenCalledWith(
        TaskActions.updateTask({ boardId: 'roadmap', taskId: 'target', task: value }),
      );
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('on success: marks the form saved, notifies and goes to the task detail page', () => {
      const markSaved = jest.spyOn(form(), 'markSaved');
      component.onSave(value);

      actions$.next(
        TaskActions.updateTaskSuccess({ update: { id: 'target', changes: { title: 'Renamed' } } }),
      );

      expect(markSaved).toHaveBeenCalledTimes(1);
      expect(notifications.success).toHaveBeenCalledWith('"Renamed" was updated.');
      expect(router.navigate).toHaveBeenCalledWith(['/boards', 'roadmap', 'tasks', 'target']);
    });

    it('on failure: shows the error and keeps the user on the form', () => {
      const markSaved = jest.spyOn(form(), 'markSaved');
      component.onSave(value);

      actions$.next(TaskActions.updateTaskFailure({ error: 'Server is down.' }));

      expect(notifications.error).toHaveBeenCalledWith('Server is down.');
      expect(notifications.success).not.toHaveBeenCalled();
      expect(markSaved).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('ignores add/delete outcomes while waiting for its update', () => {
      component.onSave(value);

      actions$.next(TaskActions.addTaskSuccess({ task: task('x', 'roadmap', 'X') }));
      actions$.next(TaskActions.deleteTaskSuccess({ taskId: 'sibling' }));

      expect(router.navigate).not.toHaveBeenCalled();
      expect(notifications.success).not.toHaveBeenCalled();
    });

    it('cancel returns to the task without dispatching', () => {
      component.onCancel();

      expect(router.navigate).toHaveBeenCalledWith(['/boards', 'roadmap', 'tasks', 'target']);
      expect(store.dispatch).not.toHaveBeenCalled();
    });

    it('follows the store when the task changes underneath it', () => {
      store.set(selectAllTasks, [task('target', 'roadmap', 'Renamed elsewhere')]);

      expect(component.task()?.title).toBe('Renamed elsewhere');
      expect(component.existingTitles()).toEqual([]);
    });

    it('shows the saving state from the store on the form button', () => {
      store.set(selectTasksSaving, true);
      fixture.detectChanges();

      const submit = el().querySelector<HTMLButtonElement>('button[type="submit"]')!;
      expect(submit.disabled).toBe(true);
      expect(submit.textContent?.trim()).toBe('Saving…');
    });
  });

  describe('when the task does not exist', () => {
    beforeEach(() => setup('roadmap', 'ghost'));

    it('shows a not-found message instead of a form', () => {
      expect(component.task()).toBeUndefined();
      expect(el().querySelector('.empty-state')?.textContent).toContain('Task not found.');
      expect(el().querySelector('app-task-form')).toBeNull();
    });

    it('sends the user straight to the board, not to the missing task', () => {
      el().querySelector<HTMLButtonElement>('button')!.click();

      expect(router.navigate).toHaveBeenCalledWith(['/boards', 'roadmap']);
    });

    it('does not report unsaved changes without a form', () => {
      expect(component.hasUnsavedChanges()).toBe(false);
    });
  });
});
