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

  describe('saving flag and errors for writes', () => {
    it.each([
      ['Add Task', TaskActions.addTask({ boardId: 'roadmap', task })],
      ['Update Task', TaskActions.updateTask({ boardId: 'roadmap', taskId: 'q1-goals', task })],
      ['Delete Task', TaskActions.deleteTask({ boardId: 'roadmap', taskId: 'q1-goals' })],
    ])('%s raises saving and clears a previous error', (_name, action) => {
      const state = taskReducer({ ...seededTaskState(), error: 'old' }, action);

      expect(state.saving).toBe(true);
      expect(state.error).toBeNull();
    });

    it.each([
      ['Add Task Failure', TaskActions.addTaskFailure({ error: 'add failed' }), 'add failed'],
      [
        'Update Task Failure',
        TaskActions.updateTaskFailure({ error: 'update failed' }),
        'update failed',
      ],
      [
        'Delete Task Failure',
        TaskActions.deleteTaskFailure({ error: 'delete failed' }),
        'delete failed',
      ],
    ])('%s lowers saving, records the error and keeps every task', (_name, action, message) => {
      const before = { ...seededTaskState(), saving: true };

      const state = taskReducer(before, action);

      expect(state.saving).toBe(false);
      expect(state.error).toBe(message);
      expect(state.ids).toEqual(before.ids);
    });

    it('does not touch the initial-load flags while saving', () => {
      const state = taskReducer(
        seededTaskState(),
        TaskActions.addTask({ boardId: 'roadmap', task }),
      );

      expect(state.loaded).toBe(true);
      expect(state.loading).toBe(false);
    });
  });

  describe('load results', () => {
    it('replaces, rather than merges with, tasks already in the store', () => {
      const state = taskReducer(seededTaskState(), TaskActions.loadTasksSuccess({ tasks: [task] }));

      expect(state.ids).toEqual(['new-task']);
      expect(state.entities['q1-goals']).toBeUndefined();
    });

    it('keeps already-loaded tasks visible when a reload fails', () => {
      const before = seededTaskState();

      const state = taskReducer(before, TaskActions.loadTasksFailure({ error: 'offline' }));

      expect(state.ids).toEqual(before.ids);
      expect(state.error).toBe('offline');
    });

    it('clears an old load error on a successful retry', () => {
      const failed = taskReducer(init(), TaskActions.loadTasksFailure({ error: 'offline' }));

      const state = taskReducer(failed, TaskActions.loadTasksSuccess({ tasks: [task] }));

      expect(state.error).toBeNull();
      expect(state.loaded).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('ignores an update for a task that is not in the store', () => {
      const before = seededTaskState();

      const state = taskReducer(
        before,
        TaskActions.updateTaskSuccess({ update: { id: 'ghost', changes: { title: 'Nope' } } }),
      );

      expect(state.ids).toEqual(before.ids);
      expect(state.entities['ghost']).toBeUndefined();
    });

    it('ignores a delete for a task that is not in the store', () => {
      const before = seededTaskState();

      const state = taskReducer(before, TaskActions.deleteTaskSuccess({ taskId: 'ghost' }));

      expect(state.ids).toEqual(before.ids);
    });

    it('leaves the store unchanged when the removed board has no tasks', () => {
      const before = seededTaskState();

      const state = taskReducer(before, TaskActions.boardRemoved({ boardId: 'no-such-board' }));

      expect(state.ids).toEqual(before.ids);
    });

    it('returns the same state object for an unrelated action', () => {
      const before = seededTaskState();

      expect(taskReducer(before, { type: 'Something Else' })).toBe(before);
    });

    it('never mutates the previous state', () => {
      const before = Object.freeze(seededTaskState());
      const snapshot = structuredClone(before);

      taskReducer(before, TaskActions.addTaskSuccess({ task }));
      taskReducer(before, TaskActions.deleteTaskSuccess({ taskId: 'q1-goals' }));
      taskReducer(before, TaskActions.boardRemoved({ boardId: 'roadmap' }));

      expect(before).toEqual(snapshot);
    });
  });
});
