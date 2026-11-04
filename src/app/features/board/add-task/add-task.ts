import { Component, computed, inject, input, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { take } from 'rxjs';
import { ComponentWithUnsavedChanges } from '../../../core/unsaved-changes.guard';
import { NotificationService } from '../../../core/notification.service';
import { TaskForm, TaskFormValue } from '../task-form/task-form';
import { TaskActions } from '../store/task.actions';
import { selectAllTasks, selectTasksSaving } from '../store/task.selectors';

@Component({
  imports: [TaskForm],
  selector: 'app-add-task',
  styleUrl: './add-task.css',
  templateUrl: './add-task.html',
})
export class AddTask implements ComponentWithUnsavedChanges {
  private readonly router = inject(Router);
  private readonly store = inject(Store);
  private readonly actions$ = inject(Actions);
  private readonly notificationService = inject(NotificationService);

  readonly boardId = input('');

  private readonly allTasks = this.store.selectSignal(selectAllTasks);
  readonly saving = this.store.selectSignal(selectTasksSaving);

  readonly existingTitles = computed(() =>
    this.allTasks()
      .filter((task) => task.boardId === this.boardId())
      .map((task) => task.title),
  );

  private readonly taskForm = viewChild(TaskForm);

  hasUnsavedChanges(): boolean {
    return this.taskForm()?.isDirty() ?? false;
  }

  // Waits for the server's answer before navigating: on success the form is marked saved (so the
  // unsaved-changes guard lets the navigation through) and the user returns to the board; on
  // failure they stay on the form, with their input intact, and see why it failed.
  onSave(value: TaskFormValue): void {
    this.actions$
      .pipe(ofType(TaskActions.addTaskSuccess, TaskActions.addTaskFailure), take(1))
      .subscribe((outcome) => {
        if (outcome.type === TaskActions.addTaskFailure.type) {
          this.notificationService.error(outcome.error);
          return;
        }
        this.taskForm()?.markSaved();
        this.notificationService.success(`"${value.title}" was added.`);
        this.goToBoard();
      });
    this.store.dispatch(TaskActions.addTask({ boardId: this.boardId(), task: value }));
  }

  onCancel(): void {
    this.goToBoard();
  }

  private goToBoard(): void {
    this.router.navigate(['/boards', this.boardId()]);
  }
}
