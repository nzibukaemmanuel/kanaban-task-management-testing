// Test-only in-memory backend: specs use it so effects/components run against a working REST API.
import { Injectable } from '@angular/core';
import { BOARD_IDS, BOARD_TASKS } from '../../../features/board/board-data';
import { BoardDto, TaskCreateDto, TaskDto, TaskPatchDto } from '../api.models';

export class MockApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const FAIL_FLAG_KEY = 'kanban-mock-api-fail';

// The in-memory "database" behind the mock API. It lives for the lifetime of the page, so data
// survives navigation (like a real server would) but resets on a full reload.
@Injectable({ providedIn: 'root' })
export class MockApiDb {
  private boards: BoardDto[] = BOARD_IDS.map((id) => ({ id }));
  private tasks: TaskDto[] = Object.entries(structuredClone(BOARD_TASKS)).flatMap(
    ([boardId, tasks]) => tasks.map((task) => ({ ...task, boardId })),
  );
  private nextSuffix = 0;

  // Dev/test aid: `localStorage.setItem('kanban-mock-api-fail', 'true')` makes every request
  // answer 500 so the loading → error UI can be checked without breaking the network.
  assertAvailable(): void {
    let failing = false;
    try {
      failing = localStorage.getItem(FAIL_FLAG_KEY) === 'true';
    } catch {
      // storage unavailable — behave as if the flag is off
    }
    if (failing) {
      throw new MockApiError(500, 'Simulated server failure.');
    }
  }

  listBoards(): BoardDto[] {
    return structuredClone(this.boards);
  }

  createBoard(board: Partial<BoardDto>): BoardDto {
    const id = board.id?.trim();
    if (!id) {
      throw new MockApiError(400, 'A board needs an id.');
    }
    if (this.boards.some((existing) => existing.id === id)) {
      throw new MockApiError(409, `A board named "${id}" already exists.`);
    }
    this.boards = [...this.boards, { id }];
    return { id };
  }

  deleteBoard(id: string): void {
    if (!this.boards.some((board) => board.id === id)) {
      throw new MockApiError(404, `Board "${id}" doesn't exist.`);
    }
    this.boards = this.boards.filter((board) => board.id !== id);
    this.tasks = this.tasks.filter((task) => task.boardId !== id);
  }

  listTasks(boardId: string | null): TaskDto[] {
    const matching =
      boardId === null ? this.tasks : this.tasks.filter((task) => task.boardId === boardId);
    return structuredClone(matching);
  }

  getTask(id: string): TaskDto {
    return structuredClone(this.requireTask(id));
  }

  createTask(input: Partial<TaskCreateDto>): TaskDto {
    const boardId = input.boardId ?? '';
    if (!this.boards.some((board) => board.id === boardId)) {
      throw new MockApiError(404, `Board "${boardId}" doesn't exist.`);
    }
    const title = input.title?.trim() ?? '';
    if (title.length < 3) {
      throw new MockApiError(400, 'A task title must be at least 3 characters.');
    }
    this.assertTitleFree(boardId, title, null);
    const task: TaskDto = {
      id: `${slugify(title)}-${this.nextSuffix++}`,
      boardId,
      title,
      description: input.description ?? '',
      status: input.status ?? 'todo',
      dueDate: input.dueDate ?? '',
      subtasks: input.subtasks ?? [],
    };
    this.tasks = [...this.tasks, task];
    return structuredClone(task);
  }

  patchTask(id: string, changes: TaskPatchDto): TaskDto {
    const current = this.requireTask(id);
    if (changes.title !== undefined) {
      const title = changes.title.trim();
      if (title.length < 3) {
        throw new MockApiError(400, 'A task title must be at least 3 characters.');
      }
      this.assertTitleFree(changes.boardId ?? current.boardId, title, id);
    }
    const updated: TaskDto = { ...current, ...structuredClone(changes), id };
    this.tasks = this.tasks.map((task) => (task.id === id ? updated : task));
    return structuredClone(updated);
  }

  // PUT semantics: the stored task becomes exactly the body, so a field left out is cleared
  // rather than kept — unlike patchTask, which merges.
  replaceTask(id: string, input: Partial<TaskCreateDto>): TaskDto {
    this.requireTask(id);
    const boardId = input.boardId ?? '';
    if (!this.boards.some((board) => board.id === boardId)) {
      throw new MockApiError(404, `Board "${boardId}" doesn't exist.`);
    }
    const title = input.title?.trim() ?? '';
    if (title.length < 3) {
      throw new MockApiError(400, 'A task title must be at least 3 characters.');
    }
    this.assertTitleFree(boardId, title, id);
    const replaced: TaskDto = {
      id,
      boardId,
      title,
      description: input.description ?? '',
      status: input.status ?? 'todo',
      dueDate: input.dueDate ?? '',
      subtasks: structuredClone(input.subtasks ?? []),
    };
    this.tasks = this.tasks.map((task) => (task.id === id ? replaced : task));
    return structuredClone(replaced);
  }

  deleteTask(id: string): void {
    this.requireTask(id);
    this.tasks = this.tasks.filter((task) => task.id !== id);
  }

  private requireTask(id: string): TaskDto {
    const task = this.tasks.find((candidate) => candidate.id === id);
    if (!task) {
      throw new MockApiError(404, `Task "${id}" doesn't exist.`);
    }
    return task;
  }

  private assertTitleFree(boardId: string, title: string, exceptId: string | null): void {
    const clash = this.tasks.some(
      (task) =>
        task.boardId === boardId &&
        task.id !== exceptId &&
        task.title.toLowerCase() === title.toLowerCase(),
    );
    if (clash) {
      throw new MockApiError(409, `A task titled "${title}" already exists on this board.`);
    }
  }
}

function slugify(title: string): string {
  return (
    title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'task'
  );
}
