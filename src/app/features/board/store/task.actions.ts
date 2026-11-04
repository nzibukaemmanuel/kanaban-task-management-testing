import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Update } from '@ngrx/entity';
import { Task } from '../board-data';
import { TaskEntity } from './task.model';

// Actions are the only way task state changes: components dispatch the "intent" (Add Task,
// Update Task, Delete Task), TaskEffects turns that into a call against TaskService (the actual
// data layer) and dispatches the matching Success/Failure action, and the reducer is the only
// thing that touches the store's state in response. See task.effects.ts for the intent → effect
// → reducer flow this enables.
export const TaskActions = createActionGroup({
  source: 'Task',
  events: {
    'Load Tasks': emptyProps(),
    'Load Tasks Success': props<{ tasks: TaskEntity[] }>(),
    'Load Tasks Failure': props<{ error: string }>(),

    'Add Task': props<{ boardId: string; task: Omit<Task, 'id'> }>(),
    'Add Task Success': props<{ task: TaskEntity }>(),
    'Add Task Failure': props<{ error: string }>(),

    'Update Task': props<{ boardId: string; taskId: string; task: Omit<Task, 'id'> }>(),
    'Update Task Success': props<{ update: Update<TaskEntity> }>(),
    'Update Task Failure': props<{ error: string }>(),

    'Delete Task': props<{ boardId: string; taskId: string }>(),
    'Delete Task Success': props<{ taskId: string }>(),
    'Delete Task Failure': props<{ error: string }>(),

    // Dispatched after the API confirms a board delete: the server removed the board's tasks with
    // it, so the store drops them too instead of refetching everything.
    'Board Removed': props<{ boardId: string }>(),
  },
});
