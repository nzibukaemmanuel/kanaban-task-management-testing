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
import { AddTask } from './add-task';

// Every collaborator of AddTask is replaced by a Jest mock: no real store, effects, router, HTTP
// or notification state is involved, so a failure here can only come from AddTask itself.
describe('AddTask (isolated from its services)', () => {
  const task = (id: string, boardId: string, title: string): TaskEntity => ({
    id,
    boardId,
    title,
    description: '',
    status: 'todo',
    dueDate: '',
    subtasks: [],
  });
  const value: TaskFormValue = {
    title: 'New task',
    description: 'Details',
    status: 'todo',
    dueDate: '',
    subtasks: [],
  };

  let fixture: ComponentFixture<AddTask>;
  let component: AddTask;
  let store: ReturnType<typeof createMockStore>;
  let actions$: Subject<unknown>;
  const router = { navigate: jest.fn() };
  const notifications = { success: jest.fn(), error: jest.fn() };

  beforeEach(() => {
    store = createMockStore([
      [
        selectAllTasks,
        [
          task('a', 'roadmap', 'Existing A'),
          task('b', 'roadmap', 'Existing B'),
          task('c', 'other', 'Elsewhere'),
        ],
      ],
      [selectTasksSaving, false],
    ]);
    actions$ = new Subject();
    TestBed.configureTestingModule({
      imports: [AddTask],
      providers: [
        { provide: Store, useValue: store },
        { provide: Actions, useValue: actions$ },
        { provide: Router, useValue: router },
        { provide: NotificationService, useValue: notifications },
      ],
    });
    fixture = TestBed.createComponent(AddTask);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('boardId', 'roadmap');
    fixture.detectChanges();
  });

  const form = () =>
    fixture.debugElement.query(By.directive(TaskForm)).componentInstance as TaskForm;

  it('creates without touching any real service', () => {
    expect(component).toBeTruthy();
    expect(store.dispatch).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('reads its state only through the task selectors', () => {
    expect(store.selectSignal).toHaveBeenCalledWith(selectAllTasks);
    expect(store.selectSignal).toHaveBeenCalledWith(selectTasksSaving);
  });

  it("offers only the current board's titles to the duplicate check", () => {
    expect(component.existingTitles()).toEqual(['Existing A', 'Existing B']);
  });

  it('recomputes those titles when the store state changes', () => {
    store.set(selectAllTasks, [task('a', 'roadmap', 'Only one')]);

    expect(component.existingTitles()).toEqual(['Only one']);
  });

  it('passes the saving flag through to the form', () => {
    const submit = () =>
      fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submit().disabled).toBe(false);

    store.set(selectTasksSaving, true);
    fixture.detectChanges();

    expect(submit().disabled).toBe(true);
  });

  describe('onSave', () => {
    it('dispatches Add Task with the board id and the form value, and nothing else yet', () => {
      component.onSave(value);

      expect(store.dispatch).toHaveBeenCalledTimes(1);
      expect(store.dispatch).toHaveBeenCalledWith(
        TaskActions.addTask({ boardId: 'roadmap', task: value }),
      );
      expect(router.navigate).not.toHaveBeenCalled();
      expect(notifications.success).not.toHaveBeenCalled();
    });

    it('on success: marks the form saved, notifies, and goes back to the board', () => {
      const markSaved = jest.spyOn(form(), 'markSaved');
      component.onSave(value);

      actions$.next(TaskActions.addTaskSuccess({ task: task('new', 'roadmap', 'New task') }));

      expect(markSaved).toHaveBeenCalledTimes(1);
      expect(notifications.success).toHaveBeenCalledWith('"New task" was added.');
      expect(router.navigate).toHaveBeenCalledWith(['/boards', 'roadmap']);
      expect(notifications.error).not.toHaveBeenCalled();
    });

    it('on failure: shows the error and stays put, leaving the form untouched', () => {
      const markSaved = jest.spyOn(form(), 'markSaved');
      component.onSave(value);

      actions$.next(
        TaskActions.addTaskFailure({ error: 'A task titled "New task" already exists.' }),
      );

      expect(notifications.error).toHaveBeenCalledWith('A task titled "New task" already exists.');
      expect(notifications.success).not.toHaveBeenCalled();
      expect(markSaved).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('ignores outcomes of other task actions while waiting', () => {
      component.onSave(value);

      actions$.next(TaskActions.updateTaskSuccess({ update: { id: 'a', changes: {} } }));
      actions$.next(TaskActions.deleteTaskFailure({ error: 'nope' }));

      expect(router.navigate).not.toHaveBeenCalled();
      expect(notifications.error).not.toHaveBeenCalled();
    });

    it('reacts to only the first outcome of a save', () => {
      component.onSave(value);

      actions$.next(TaskActions.addTaskSuccess({ task: task('new', 'roadmap', 'New task') }));
      actions$.next(TaskActions.addTaskSuccess({ task: task('new2', 'roadmap', 'Again') }));

      expect(router.navigate).toHaveBeenCalledTimes(1);
      expect(notifications.success).toHaveBeenCalledTimes(1);
    });

    it('lets the user retry after a failure with a fresh save', () => {
      component.onSave(value);
      actions$.next(TaskActions.addTaskFailure({ error: 'boom' }));

      component.onSave(value);
      actions$.next(TaskActions.addTaskSuccess({ task: task('new', 'roadmap', 'New task') }));

      expect(store.dispatch).toHaveBeenCalledTimes(2);
      expect(router.navigate).toHaveBeenCalledTimes(1);
    });
  });

  it('cancel returns to the board without dispatching anything', () => {
    component.onCancel();

    expect(router.navigate).toHaveBeenCalledWith(['/boards', 'roadmap']);
    expect(store.dispatch).not.toHaveBeenCalled();
  });

  it('wires the form output to onSave', () => {
    form().save.emit(value);

    expect(store.dispatch).toHaveBeenCalledWith(
      TaskActions.addTask({ boardId: 'roadmap', task: value }),
    );
  });

  it('wires the form cancel output to onCancel', () => {
    form().cancel.emit();

    expect(router.navigate).toHaveBeenCalledWith(['/boards', 'roadmap']);
  });
});
