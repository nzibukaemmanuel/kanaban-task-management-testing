import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../../core/api/api.config';
import { TaskDto } from '../../core/api/api.models';
import { TaskService } from './task.service';

const dto: TaskDto = {
  id: 'q1-goals',
  boardId: 'roadmap',
  title: 'Q1 goals',
  description: '',
  status: 'todo',
  dueDate: '',
  subtasks: [],
};

describe('TaskService', () => {
  let service: TaskService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'https://api.test' },
      ],
    });
    service = TestBed.inject(TaskService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('GETs every task from the configured base URL', () => {
    let result: TaskDto[] | undefined;
    service.list().subscribe((tasks) => (result = tasks));

    const req = httpMock.expectOne('https://api.test/tasks');
    expect(req.request.method).toBe('GET');
    req.flush([dto]);

    expect(result).toEqual([dto]);
  });

  it('filters the list by board with a boardId query param', () => {
    service.list('roadmap').subscribe();

    const req = httpMock.expectOne((r) => r.url === 'https://api.test/tasks');
    expect(req.request.params.get('boardId')).toBe('roadmap');
    req.flush([]);
  });

  it('GETs a single task by id', () => {
    service.get('q1-goals').subscribe();

    const req = httpMock.expectOne('https://api.test/tasks/q1-goals');
    expect(req.request.method).toBe('GET');
    req.flush(dto);
  });

  it('POSTs a new task with its board id in the body', () => {
    let created: TaskDto | undefined;
    service
      .create('roadmap', {
        title: 'Q1 goals',
        description: '',
        status: 'todo',
        dueDate: '',
        subtasks: [],
      })
      .subscribe((task) => (created = task));

    const req = httpMock.expectOne('https://api.test/tasks');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toMatchObject({ boardId: 'roadmap', title: 'Q1 goals' });
    req.flush(dto);

    expect(created?.id).toBe('q1-goals');
  });

  it('PUTs the whole edited task, including its id and board', () => {
    service
      .update('roadmap', 'q1-goals', {
        title: 'Q1 goals',
        description: '',
        status: 'done',
        dueDate: '',
        subtasks: [],
      })
      .subscribe();

    const req = httpMock.expectOne('https://api.test/tasks/q1-goals');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ ...dto, status: 'done' });
    req.flush({ ...dto, status: 'done' });
  });

  it('DELETEs a task by id', () => {
    let completed = false;
    service.delete('q1-goals').subscribe({ complete: () => (completed = true) });

    const req = httpMock.expectOne('https://api.test/tasks/q1-goals');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    expect(completed).toBe(true);
  });

  it('URL-encodes task ids', () => {
    service.get('a/b c').subscribe();

    httpMock.expectOne('https://api.test/tasks/a%2Fb%20c').flush(dto);
  });

  it('is cold — nothing is sent until someone subscribes', () => {
    service.list();
    httpMock.expectNone('https://api.test/tasks');
  });

  it('passes HTTP errors through to the subscriber', () => {
    let status: number | undefined;
    service.get('missing').subscribe({ error: (e) => (status = e.status) });

    httpMock
      .expectOne('https://api.test/tasks/missing')
      .flush({ message: 'nope' }, { status: 404, statusText: 'Not Found' });

    expect(status).toBe(404);
  });

  describe('request details', () => {
    it('omits the boardId param when no board is given', () => {
      service.list().subscribe();

      const req = httpMock.expectOne('https://api.test/tasks');
      expect(req.request.params.keys()).toEqual([]);
      req.flush([]);
    });

    it('treats an empty board id like no board at all', () => {
      service.list('').subscribe();

      const req = httpMock.expectOne('https://api.test/tasks');
      expect(req.request.params.keys()).toEqual([]);
      req.flush([]);
    });

    it('sends every field of a created task, subtasks included', () => {
      const subtasks = [{ id: 's1', title: 'Step one', completed: true }];
      service
        .create('roadmap', {
          title: 'With subtasks',
          description: 'Details',
          status: 'doing',
          dueDate: '2026-09-01',
          subtasks,
        })
        .subscribe();

      const req = httpMock.expectOne('https://api.test/tasks');
      expect(req.request.body).toEqual({
        boardId: 'roadmap',
        title: 'With subtasks',
        description: 'Details',
        status: 'doing',
        dueDate: '2026-09-01',
        subtasks,
      });
      req.flush({ ...dto, subtasks });
    });

    it('does not mutate the task object it is given', () => {
      const task = Object.freeze({
        title: 'Frozen',
        description: '',
        status: 'todo' as const,
        dueDate: '',
        subtasks: [],
      });

      expect(() => service.create('roadmap', task).subscribe()).not.toThrow();
      httpMock.expectOne('https://api.test/tasks').flush(dto);
    });

    it('takes the id and board of an update from its arguments, not from the task value', () => {
      service
        .update('roadmap', 'q1-goals', {
          title: 'Renamed',
          description: '',
          status: 'todo',
          dueDate: '',
          subtasks: [],
          ...({ id: 'sneaky', boardId: 'other' } as object),
        })
        .subscribe();

      const req = httpMock.expectOne('https://api.test/tasks/q1-goals');
      expect(req.request.body).toMatchObject({
        id: 'q1-goals',
        boardId: 'roadmap',
        title: 'Renamed',
      });
      req.flush(dto);
    });

    it('emits the server version of an updated task', () => {
      let updated: TaskDto | undefined;
      service
        .update('roadmap', 'q1-goals', {
          title: 'x',
          description: '',
          status: 'done',
          dueDate: '',
          subtasks: [],
        })
        .subscribe((task) => (updated = task));

      httpMock
        .expectOne('https://api.test/tasks/q1-goals')
        .flush({ ...dto, title: 'Server title' });

      expect(updated?.title).toBe('Server title');
    });
  });

  describe('error handling', () => {
    const task = {
      title: 'x',
      description: '',
      status: 'todo' as const,
      dueDate: '',
      subtasks: [],
    };

    it.each([
      ['list', () => service.list(), 'https://api.test/tasks'],
      ['create', () => service.create('roadmap', task), 'https://api.test/tasks'],
      [
        'update',
        () => service.update('roadmap', 'q1-goals', task),
        'https://api.test/tasks/q1-goals',
      ],
      ['delete', () => service.delete('q1-goals'), 'https://api.test/tasks/q1-goals'],
    ])('passes a server error from %s through untouched', (_name, call, url) => {
      let status: number | undefined;
      call().subscribe({ error: (e) => (status = e.status) });

      httpMock
        .expectOne(url)
        .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });

      expect(status).toBe(500);
    });

    it('reports a network failure as status 0', () => {
      let status: number | undefined;
      service.list().subscribe({ error: (e) => (status = e.status) });

      httpMock.expectOne('https://api.test/tasks').error(new ProgressEvent('error'));

      expect(status).toBe(0);
    });

    it('emits nothing for a failed request, so a caller never sees a stale value', () => {
      const next = jest.fn();
      service.get('missing').subscribe({ next, error: () => undefined });

      httpMock
        .expectOne('https://api.test/tasks/missing')
        .flush({}, { status: 404, statusText: 'Not Found' });

      expect(next).not.toHaveBeenCalled();
    });
  });
});
