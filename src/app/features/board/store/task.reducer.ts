import { createEntityAdapter, EntityState } from '@ngrx/entity';
import { createReducer, on } from '@ngrx/store';
import { TaskActions } from './task.actions';
import { TaskEntity } from './task.model';

export interface TaskState extends EntityState<TaskEntity> {
  // `loading`/`loaded` track the initial fetch of the collection (drives the page-level spinner
  // and its retry), `saving` tracks any in-flight add/update/delete (drives disabled buttons).
  loaded: boolean;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

export const taskAdapter = createEntityAdapter<TaskEntity>();

// Starts empty: the tasks come from the API (see TaskEffects.loadTasks$), so until that first
// response arrives the honest state is "not loaded", which the UI renders as a loading indicator.
export const initialTaskState: TaskState = taskAdapter.getInitialState({
  loaded: false,
  loading: false,
  saving: false,
  error: null,
});

export const taskReducer = createReducer(
  initialTaskState,
  on(TaskActions.loadTasks, (state) => ({ ...state, loading: true, error: null })),
  on(TaskActions.loadTasksSuccess, (state, { tasks }) =>
    taskAdapter.setAll(tasks, { ...state, loading: false, loaded: true, error: null }),
  ),
  on(TaskActions.loadTasksFailure, (state, { error }) => ({ ...state, loading: false, error })),

  on(TaskActions.addTask, TaskActions.updateTask, TaskActions.deleteTask, (state) => ({
    ...state,
    saving: true,
    error: null,
  })),

  on(TaskActions.addTaskSuccess, (state, { task }) =>
    taskAdapter.addOne(task, { ...state, saving: false }),
  ),
  on(TaskActions.updateTaskSuccess, (state, { update }) =>
    taskAdapter.updateOne(update, { ...state, saving: false }),
  ),
  on(TaskActions.deleteTaskSuccess, (state, { taskId }) =>
    taskAdapter.removeOne(taskId, { ...state, saving: false }),
  ),

  on(TaskActions.boardRemoved, (state, { boardId }) =>
    taskAdapter.removeMany((task) => task.boardId === boardId, state),
  ),

  on(
    TaskActions.addTaskFailure,
    TaskActions.updateTaskFailure,
    TaskActions.deleteTaskFailure,
    (state, { error }) => ({
      ...state,
      saving: false,
      error,
    }),
  ),
);
