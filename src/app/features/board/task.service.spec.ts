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
});
