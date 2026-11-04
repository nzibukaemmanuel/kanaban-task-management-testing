import { seededTaskState } from './testing';
import {
  selectAllTasks,
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
});
