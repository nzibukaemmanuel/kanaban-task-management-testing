import { taskReducer, TaskState } from './task.reducer';
import { TaskActions } from './task.actions';
import { TaskEntity } from './task.model';
import { seededTaskState } from './testing';

const task: TaskEntity = {
  id: 'new-task',
  boardId: 'roadmap',
  title: 'New task',
  description: '',
  status: 'todo',
  dueDate: '',
  subtasks: [],
};

const init = () => taskReducer(undefined, { type: '@@INIT' });

describe('taskReducer', () => {
  it('starts empty and not loaded — tasks only arrive from the API', () => {
    const state = init();

    expect(state.ids).toEqual([]);
    expect(state.loaded).toBe(false);
    expect(state.loading).toBe(false);
    expect(state.saving).toBe(false);
    expect(state.error).toBeNull();
  });

  it('flags loading and clears any previous error on Load Tasks', () => {
    const failed: TaskState = { ...init(), error: 'old' };

    const state = taskReducer(failed, TaskActions.loadTasks());

    expect(state.loading).toBe(true);
    expect(state.error).toBeNull();
  });

  it('replaces all entities on Load Tasks Success and marks the state loaded', () => {
    const loading = taskReducer(init(), TaskActions.loadTasks());

    const state = taskReducer(loading, TaskActions.loadTasksSuccess({ tasks: [task] }));

    expect(state.loaded).toBe(true);
    expect(state.loading).toBe(false);
    expect(state.ids).toEqual(['new-task']);
  });

  it('records the error and stops loading on Load Tasks Failure', () => {
    const loading = taskReducer(init(), TaskActions.loadTasks());

    const state = taskReducer(loading, TaskActions.loadTasksFailure({ error: 'boom' }));

    expect(state.loading).toBe(false);
    expect(state.loaded).toBe(false);
    expect(state.error).toBe('boom');
  });

  it('raises the saving flag while a write is in flight and clears the last error', () => {
    const before: TaskState = { ...seededTaskState(), error: 'old' };

    const state = taskReducer(
      before,
      TaskActions.deleteTask({ boardId: 'roadmap', taskId: 'q1-goals' }),
    );

    expect(state.saving).toBe(true);
    expect(state.error).toBeNull();
  });

  it('adds a new entity on Add Task Success and lowers the saving flag', () => {
    const saving = taskReducer(
      seededTaskState(),
      TaskActions.addTask({ boardId: 'roadmap', task }),
    );

    const state = taskReducer(saving, TaskActions.addTaskSuccess({ task }));

    expect(state.entities['new-task']).toEqual(task);
    expect(state.saving).toBe(false);
  });

  it('merges changes onto the existing entity on Update Task Success', () => {
    const state = taskReducer(
      seededTaskState(),
      TaskActions.updateTaskSuccess({ update: { id: 'q1-goals', changes: { status: 'done' } } }),
    );

    expect(state.entities['q1-goals']?.status).toBe('done');
    expect(state.entities['q1-goals']?.title).toBe('Set Q1 goals');
  });

  it('removes the entity on Delete Task Success', () => {
    const state = taskReducer(
      seededTaskState(),
      TaskActions.deleteTaskSuccess({ taskId: 'q1-goals' }),
    );

    expect(state.entities['q1-goals']).toBeUndefined();
  });

  it('drops every task of a removed board and leaves the other boards alone', () => {
    const before = seededTaskState();

    const state = taskReducer(before, TaskActions.boardRemoved({ boardId: 'roadmap' }));

    expect(Object.values(state.entities).some((t) => t?.boardId === 'roadmap')).toBe(false);
    expect(state.entities['define-scope']).toBeDefined();
    expect(state.ids.length).toBeLessThan(before.ids.length);
  });

  it('keeps the data, records the error and lowers saving on a write Failure', () => {
    const saving = taskReducer(
      seededTaskState(),
      TaskActions.deleteTask({ boardId: 'roadmap', taskId: 'q1-goals' }),
    );

    const state = taskReducer(saving, TaskActions.deleteTaskFailure({ error: 'nope' }));

    expect(state.saving).toBe(false);
    expect(state.error).toBe('nope');
    expect(state.entities['q1-goals']).toBeDefined();
  });
});
