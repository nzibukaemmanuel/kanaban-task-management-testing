import { createFeatureSelector, createSelector } from '@ngrx/store';
import { taskAdapter, TaskState } from './task.reducer';

export const TASK_FEATURE_KEY = 'tasks';

export const selectTaskState = createFeatureSelector<TaskState>(TASK_FEATURE_KEY);

const { selectAll } = taskAdapter.getSelectors();

export const selectAllTasks = createSelector(selectTaskState, selectAll);
export const selectTasksLoaded = createSelector(selectTaskState, (state) => state.loaded);
export const selectTasksLoading = createSelector(selectTaskState, (state) => state.loading);
export const selectTasksSaving = createSelector(selectTaskState, (state) => state.saving);
export const selectTasksError = createSelector(selectTaskState, (state) => state.error);

// Parameterized selector factories (rather than a single selector taking boardId as state) —
// each call builds a fresh memoized selector, which is what lets components keep one stable
// selector per board (see Boards' taskCounts$ map) instead of recomputing across every board on
// every emission.
export const selectTasksByBoard = (boardId: string) =>
  createSelector(selectAllTasks, (tasks) => tasks.filter((task) => task.boardId === boardId));

export const selectTaskByBoardAndId = (boardId: string, taskId: string) =>
  createSelector(selectTasksByBoard(boardId), (tasks) => tasks.find((task) => task.id === taskId));

export const selectOtherTitles = (boardId: string, excludeTaskId: string | null) =>
  createSelector(selectTasksByBoard(boardId), (tasks) =>
    tasks.filter((task) => task.id !== excludeTaskId).map((task) => task.title),
  );
