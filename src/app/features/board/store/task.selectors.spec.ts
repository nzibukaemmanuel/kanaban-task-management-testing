import { TaskActions } from './task.actions';
import { taskReducer } from './task.reducer';
import { seededTaskState } from './testing';
import {
  selectAllTasks,
  selectTasksError,
  selectTasksLoaded,
  selectTasksLoading,
  selectTasksSaving,
  selectOtherTitles,
  selectTaskByBoardAndId,
  selectTasksByBoard,
  TASK_FEATURE_KEY,
} from './task.selectors';

// createFeatureSelector expects the slice to live under its feature key, so these selectors are
// exercised against a full { tasks: TaskState } app-state shape rather than the bare TaskState
// the reducer spec uses directly.
function appState() {
  return { [TASK_FEATURE_KEY]: seededTaskState() };
}

describe('task selectors', () => {
  it('selectAllTasks flattens every board into one list', () => {
    const tasks = selectAllTasks(appState());

    expect(tasks.length).toBe(16);
    expect(tasks.map((t) => t.id)).toContain('q1-goals');
  });

  it('selectTasksByBoard filters to just that board', () => {
    const tasks = selectTasksByBoard('roadmap')(appState());

    expect(tasks.map((t) => t.id)).toEqual([
      'q1-goals',
      'prioritize-features',
      'q2-goals',
      'review-roadmap-risks',
    ]);
  });

  it('selectTaskByBoardAndId finds a single task scoped to its board', () => {
    const task = selectTaskByBoardAndId('roadmap', 'q1-goals')(appState());

    expect(task?.title).toBe('Set Q1 goals');
  });

  it('selectTaskByBoardAndId does not match the same task id on a different board', () => {
    const task = selectTaskByBoardAndId('marketing-plan', 'q1-goals')(appState());

    expect(task).toBeUndefined();
  });

  it('selectOtherTitles lists sibling titles on the board, excluding the given task', () => {
    const titles = selectOtherTitles('roadmap', 'q1-goals')(appState());

    expect(titles).toEqual(['Prioritize features', 'Set Q2 goals', 'Review roadmap risks']);
  });

  it('selectOtherTitles excludes nothing when no task id is given', () => {
    const titles = selectOtherTitles('roadmap', null)(appState());

    expect(titles).toEqual([
      'Set Q1 goals',
      'Prioritize features',
      'Set Q2 goals',
      'Review roadmap risks',
    ]);
  });

  describe('status selectors', () => {
    const stateWith = (changes: object) => ({
      [TASK_FEATURE_KEY]: { ...seededTaskState(), ...changes },
    });

    it('expose the loaded, loading, saving and error flags', () => {
      const state = stateWith({ loaded: false, loading: true, saving: true, error: 'oops' });

      expect(selectTasksLoaded(state)).toBe(false);
      expect(selectTasksLoading(state)).toBe(true);
      expect(selectTasksSaving(state)).toBe(true);
      expect(selectTasksError(state)).toBe('oops');
    });

    it('report a healthy idle store', () => {
      const state = appState();

      expect(selectTasksLoaded(state)).toBe(true);
      expect(selectTasksLoading(state)).toBe(false);
      expect(selectTasksSaving(state)).toBe(false);
      expect(selectTasksError(state)).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('selectTasksByBoard returns an empty list for an unknown board', () => {
      expect(selectTasksByBoard('no-such-board')(appState())).toEqual([]);
    });

    it('selectTaskByBoardAndId returns undefined for an unknown task id', () => {
      expect(selectTaskByBoardAndId('roadmap', 'ghost')(appState())).toBeUndefined();
    });

    it('selectOtherTitles returns an empty list for an unknown board', () => {
      expect(selectOtherTitles('no-such-board', null)(appState())).toEqual([]);
    });

    it('selectOtherTitles ignores an exclude id that is not on the board', () => {
      expect(selectOtherTitles('roadmap', 'ghost')(appState())).toHaveLength(4);
    });

    it('selectAllTasks is empty for a store that has not loaded yet', () => {
      const empty = { [TASK_FEATURE_KEY]: taskReducer(undefined, { type: '@@INIT' }) };

      expect(selectAllTasks(empty)).toEqual([]);
    });
  });

  describe('memoization', () => {
    it('returns the same array reference while the state is unchanged', () => {
      const state = appState();
      const select = selectTasksByBoard('roadmap');

      expect(select(state)).toBe(select(state));
    });

    it('recomputes when a task on the board changes', () => {
      const select = selectTasksByBoard('roadmap');
      const before = appState();
      const after = {
        [TASK_FEATURE_KEY]: taskReducer(
          before[TASK_FEATURE_KEY],
          TaskActions.updateTaskSuccess({
            update: { id: 'q1-goals', changes: { status: 'done' } },
          }),
        ),
      };

      expect(select(after)).not.toBe(select(before));
      expect(select(after).find((t) => t.id === 'q1-goals')?.status).toBe('done');
    });
  });
});
