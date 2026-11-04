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
  selector: 'app-edit-task',
  styleUrl: './edit-task.css',
  templateUrl: './edit-task.html',
})
export class EditTask implements ComponentWithUnsavedChanges {
  private readonly router = inject(Router);
  private readonly store = inject(Store);
  private readonly actions$ = inject(Actions);
  private readonly notificationService = inject(NotificationService);

  readonly boardId = input('');
  readonly taskId = input('');

  private readonly allTasks = this.store.selectSignal(selectAllTasks);
  readonly saving = this.store.selectSignal(selectTasksSaving);

  readonly task = computed(() =>
    this.allTasks().find((task) => task.boardId === this.boardId() && task.id === this.taskId()),
  );
  readonly existingTitles = computed(() =>
    this.allTasks()
      .filter((task) => task.boardId === this.boardId() && task.id !== this.taskId())
      .map((task) => task.title),
  );

  private readonly taskForm = viewChild(TaskForm);

  hasUnsavedChanges(): boolean {
    return this.taskForm()?.isDirty() ?? false;
  }

  // See AddTask.onSave: navigation waits for the server, and a failure keeps the user's edits.
  onSave(value: TaskFormValue): void {
    this.actions$
      .pipe(ofType(TaskActions.updateTaskSuccess, TaskActions.updateTaskFailure), take(1))
      .subscribe((outcome) => {
        if (outcome.type === TaskActions.updateTaskFailure.type) {
          this.notificationService.error(outcome.error);
          return;
        }
        this.taskForm()?.markSaved();
        this.notificationService.success(`"${value.title}" was updated.`);
        this.goToTask();
      });
    this.store.dispatch(
      TaskActions.updateTask({ boardId: this.boardId(), taskId: this.taskId(), task: value }),
    );
  }

  onCancel(): void {
    this.goToTask();
  }

  // Used by the "task not found" fallback (e.g. a stale edit link): goes straight to the board
  // rather than to the task detail route, which would 404 on the same missing id.
  goToBoard(): void {
    this.router.navigate(['/boards', this.boardId()]);
  }

  private goToTask(): void {
    this.router.navigate(['/boards', this.boardId(), 'tasks', this.taskId()]);
  }
}
