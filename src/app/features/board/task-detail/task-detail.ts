import { Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { take } from 'rxjs';
import { NotificationService } from '../../../core/notification.service';
import { PreferencesService } from '../../../core/preferences.service';
import { TaskActions } from '../store/task.actions';
import { selectAllTasks, selectTasksSaving } from '../store/task.selectors';

@Component({
  imports: [RouterLink],
  selector: 'app-task-detail',
  styleUrl: './task-detail.css',
  templateUrl: './task-detail.html',
})
export class TaskDetail {
  private readonly router = inject(Router);
  private readonly store = inject(Store);
  private readonly actions$ = inject(Actions);
  private readonly preferencesService = inject(PreferencesService);
  private readonly notificationService = inject(NotificationService);

  readonly boardId = input('');
  readonly taskId = input('');

  private readonly allTasks = this.store.selectSignal(selectAllTasks);

  readonly deleting = this.store.selectSignal(selectTasksSaving);

  readonly task = computed(() =>
    this.allTasks().find((task) => task.boardId === this.boardId() && task.id === this.taskId()),
  );
  readonly completedSubtaskCount = computed(
    () => this.task()?.subtasks.filter((subtask) => subtask.completed).length ?? 0,
  );

  goToBoard(): void {
    this.router.navigate(['/boards', this.boardId()]);
  }

  deleteTask(): void {
    const task = this.task();
    if (!task) {
      return;
    }
    if (
      this.preferencesService.confirmBeforeDelete() &&
      !confirm(`Delete "${task.title}"? This can't be undone.`)
    ) {
      return;
    }
    // Only report success and leave once the server confirms the delete; if it fails the user
    // stays on the task, sees the reason, and can try again.
    this.actions$
      .pipe(ofType(TaskActions.deleteTaskSuccess, TaskActions.deleteTaskFailure), take(1))
      .subscribe((outcome) => {
        if (outcome.type === TaskActions.deleteTaskFailure.type) {
          this.notificationService.error(outcome.error);
          return;
        }
        this.notificationService.success(`"${task.title}" was deleted.`);
        this.goToBoard();
      });
    this.store.dispatch(TaskActions.deleteTask({ boardId: this.boardId(), taskId: this.taskId() }));
  }
}
