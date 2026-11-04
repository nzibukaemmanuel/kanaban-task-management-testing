import { TestBed } from '@angular/core/testing';
import { BOARD_IDS, BOARD_TASKS } from '../../../features/board/board-data';
import { TaskCreateDto } from '../api.models';
import { MOCK_API_LATENCY_MS } from './mock-api.config';
import { MockApiDb, MockApiError } from './mock-api.db';

const newTask = (changes: Partial<TaskCreateDto> = {}): TaskCreateDto => ({
  boardId: 'roadmap',
  title: 'Brand new task',
  description: '',
  status: 'todo',
  dueDate: '',
  subtasks: [],
  ...changes,
});

const errorOf = (action: () => unknown): MockApiError => {
  try {
    action();
  } catch (error) {
    return error as MockApiError;
  }
  throw new Error('expected the call to throw');
};

describe('MockApiDb', () => {
  let db: MockApiDb;

  beforeEach(() => {
    localStorage.clear();
    db = TestBed.inject(MockApiDb);
  });

  afterEach(() => localStorage.clear());

  describe('seed data', () => {
    it('starts with the seeded boards and every seeded task', () => {
      expect(db.listBoards().map((b) => b.id)).toEqual(BOARD_IDS);
      expect(db.listTasks(null)).toHaveLength(Object.values(BOARD_TASKS).flat().length);
    });

    it('hands out copies, so callers cannot change the stored data', () => {
      db.listBoards().push({ id: 'sneaky' });
      db.listTasks(null)[0].title = 'Tampered';

      expect(db.listBoards().map((b) => b.id)).not.toContain('sneaky');
      expect(db.listTasks(null)[0].title).not.toBe('Tampered');
    });

    it('filters tasks by board, and returns nothing for an unknown board', () => {
      expect(db.listTasks('roadmap').every((t) => t.boardId === 'roadmap')).toBe(true);
      expect(db.listTasks('no-such-board')).toEqual([]);
    });
  });

  describe('availability flag', () => {
    it('does nothing while the failure flag is off', () => {
      expect(() => db.assertAvailable()).not.toThrow();
    });

    it('throws a 500 while the failure flag is on', () => {
      localStorage.setItem('kanban-mock-api-fail', 'true');

      const error = errorOf(() => db.assertAvailable());

      expect(error).toBeInstanceOf(MockApiError);
      expect(error.status).toBe(500);
    });

    it('treats unreadable storage as "flag off"', () => {
      jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('storage blocked');
      });

      expect(() => db.assertAvailable()).not.toThrow();
    });
  });

  describe('boards', () => {
    it('creates a board with a trimmed id', () => {
      expect(db.createBoard({ id: '  sandbox  ' })).toEqual({ id: 'sandbox' });
      expect(db.listBoards().map((b) => b.id)).toContain('sandbox');
    });

    it.each([[{}], [{ id: '' }], [{ id: '   ' }]])(
      'rejects a board without a usable id: %j',
      (body) => {
        expect(errorOf(() => db.createBoard(body)).status).toBe(400);
      },
    );

    it('rejects a duplicate board id with 409', () => {
      expect(errorOf(() => db.createBoard({ id: 'roadmap' })).status).toBe(409);
    });

    it('deletes a board together with its tasks, leaving other boards intact', () => {
      db.deleteBoard('roadmap');

      expect(db.listBoards().map((b) => b.id)).not.toContain('roadmap');
      expect(db.listTasks('roadmap')).toEqual([]);
      expect(db.listTasks('platform-launch').length).toBeGreaterThan(0);
    });

    it('answers 404 when deleting a board that does not exist', () => {
      expect(errorOf(() => db.deleteBoard('ghost')).status).toBe(404);
    });
  });

  describe('creating tasks', () => {
    it('stores the task with a generated id and returns it', () => {
      const created = db.createTask(newTask());

      expect(created.id).toBeTruthy();
      expect(db.getTask(created.id)).toEqual(created);
    });

    it('gives two tasks with the same slug different ids', () => {
      db.createTask(newTask({ title: 'Same name' }));
      db.createTask(newTask({ boardId: 'platform-launch', title: 'Same name' }));

      const ids = db.listTasks(null).map((t) => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('trims the title it stores', () => {
      expect(db.createTask(newTask({ title: '  Padded title  ' })).title).toBe('Padded title');
    });

    it('rejects a missing board with 404', () => {
      expect(errorOf(() => db.createTask(newTask({ boardId: 'ghost' }))).status).toBe(404);
    });

    it.each([[''], ['  '], ['ab']])('rejects the too-short title %j with 400', (title) => {
      expect(errorOf(() => db.createTask(newTask({ title }))).status).toBe(400);
    });

    it('rejects a duplicate title on the same board, ignoring case and padding, but not on another board', () => {
      const clash = errorOf(() => db.createTask(newTask({ title: '  SET q1 GOALS ' })));

      expect(clash.status).toBe(409);
      expect(() =>
        db.createTask(newTask({ boardId: 'platform-launch', title: 'Set Q1 goals' })),
      ).not.toThrow();
    });
  });

  describe('reading tasks', () => {
    it('answers 404 for an unknown id', () => {
      expect(errorOf(() => db.getTask('ghost')).status).toBe(404);
    });
  });

  describe('patching tasks', () => {
    it('merges only the given fields and keeps the id', () => {
      const patched = db.patchTask('q1-goals', { status: 'done', id: 'hijack' } as never);

      expect(patched).toMatchObject({ id: 'q1-goals', status: 'done', title: 'Set Q1 goals' });
    });

    it('allows renaming to a free title and reflects it when read back', () => {
      db.patchTask('q1-goals', { title: 'Renamed goal' });

      expect(db.getTask('q1-goals').title).toBe('Renamed goal');
    });

    it('allows "renaming" a task to its own current title', () => {
      expect(() => db.patchTask('q1-goals', { title: 'Set Q1 goals' })).not.toThrow();
    });

    it('rejects a too-short title with 400', () => {
      expect(errorOf(() => db.patchTask('q1-goals', { title: 'ab' })).status).toBe(400);
    });

    it('rejects a title that another task on the board already uses with 409', () => {
      expect(errorOf(() => db.patchTask('q1-goals', { title: 'Prioritize features' })).status).toBe(
        409,
      );
    });

    it('answers 404 for an unknown task', () => {
      expect(errorOf(() => db.patchTask('ghost', { status: 'done' })).status).toBe(404);
    });

    it('can change a task without touching its title', () => {
      expect(() => db.patchTask('q1-goals', { description: 'New words' })).not.toThrow();
      expect(db.getTask('q1-goals').description).toBe('New words');
    });
  });

  describe('replacing tasks', () => {
    it('answers 404 for an unknown task', () => {
      expect(errorOf(() => db.replaceTask('ghost', newTask())).status).toBe(404);
    });

    it('answers 404 when the body names a board that does not exist', () => {
      expect(errorOf(() => db.replaceTask('q1-goals', newTask({ boardId: 'ghost' }))).status).toBe(
        404,
      );
    });

    it('answers 400 for a too-short title', () => {
      expect(errorOf(() => db.replaceTask('q1-goals', newTask({ title: 'ab' }))).status).toBe(400);
    });

    it('answers 409 when the new title clashes with another task on the board', () => {
      const clash = newTask({ title: 'Prioritize features' });

      expect(errorOf(() => db.replaceTask('q1-goals', clash)).status).toBe(409);
    });

    it('can move a task to another board', () => {
      const moved = db.replaceTask(
        'q1-goals',
        newTask({ boardId: 'platform-launch', title: 'Set Q1 goals' }),
      );

      expect(moved.boardId).toBe('platform-launch');
      expect(db.listTasks('roadmap').some((t) => t.id === 'q1-goals')).toBe(false);
    });
  });

  describe('deleting tasks', () => {
    it('removes the task', () => {
      db.deleteTask('q1-goals');

      expect(() => db.getTask('q1-goals')).toThrow(MockApiError);
    });

    it('answers 404 for an unknown task', () => {
      expect(errorOf(() => db.deleteTask('ghost')).status).toBe(404);
    });
  });
});

describe('MOCK_API_LATENCY_MS', () => {
  it('defaults to no latency, so specs and the dev server are not slowed down', () => {
    expect(TestBed.inject(MOCK_API_LATENCY_MS)).toBe(0);
  });
});
