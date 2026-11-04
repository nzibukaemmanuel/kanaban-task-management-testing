import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, concatMap, map, of, switchMap } from 'rxjs';
import { describeHttpError } from '../../../core/api/api-error';
import { TaskService } from '../task.service';
import { TaskActions } from './task.actions';

// The only place task.service.ts is called from: components dispatch an intent, these effects
// turn it into an HTTP call, and the reducer is the only thing that turns the Success action
// into new state. Each effect always ends in a Success *or* Failure action — a failed request
// never kills the effect stream (catchError sits inside the inner pipe), so the next dispatch
// still works.
@Injectable()
export class TaskEffects {
  private readonly actions$ = inject(Actions);
  private readonly taskService = inject(TaskService);

  // switchMap: a retry/refresh cancels a still-pending earlier load instead of racing it.
  loadTasks$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TaskActions.loadTasks),
      switchMap(() =>
        this.taskService.list().pipe(
          map((tasks) => TaskActions.loadTasksSuccess({ tasks })),
          catchError((error: unknown) =>
            of(TaskActions.loadTasksFailure({ error: describeHttpError(error, 'load tasks') })),
          ),
        ),
      ),
    ),
  );

  // concatMap for writes: they run one at a time in dispatch order, so two quick edits to the
  // same task can't land out of order.
  addTask$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TaskActions.addTask),
      concatMap(({ boardId, task }) =>
        this.taskService.create(boardId, task).pipe(
          map((created) => TaskActions.addTaskSuccess({ task: created })),
          catchError((error: unknown) =>
            of(TaskActions.addTaskFailure({ error: describeHttpError(error, 'add the task') })),
          ),
        ),
      ),
    ),
  );

  updateTask$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TaskActions.updateTask),
      concatMap(({ boardId, taskId, task }) =>
        this.taskService.update(boardId, taskId, task).pipe(
          map((updated) =>
            TaskActions.updateTaskSuccess({ update: { id: taskId, changes: updated } }),
          ),
          catchError((error: unknown) =>
            of(
              TaskActions.updateTaskFailure({ error: describeHttpError(error, 'update the task') }),
            ),
          ),
        ),
      ),
    ),
  );

  deleteTask$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TaskActions.deleteTask),
      concatMap(({ taskId }) =>
        this.taskService.delete(taskId).pipe(
          map(() => TaskActions.deleteTaskSuccess({ taskId })),
          catchError((error: unknown) =>
            of(
              TaskActions.deleteTaskFailure({ error: describeHttpError(error, 'delete the task') }),
            ),
          ),
        ),
      ),
    ),
  );
}
