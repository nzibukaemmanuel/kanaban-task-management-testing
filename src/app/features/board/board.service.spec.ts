import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../core/api/api.config';
import { BoardService } from './board.service';

const BOARDS = [{ id: 'platform-launch' }, { id: 'marketing-plan' }, { id: 'roadmap' }];

describe('BoardService', () => {
  let service: BoardService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'https://api.test' },
      ],
    });
    service = TestBed.inject(BoardService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('starts empty and not loaded, without making a request on its own', () => {
    expect(service.boardIds()).toEqual([]);
    expect(service.loaded()).toBe(false);
    httpMock.expectNone('https://api.test/boards');
  });

  it('loads the board ids from the API and reports loading while waiting', () => {
    service.load();
    expect(service.loading()).toBe(true);

    httpMock.expectOne('https://api.test/boards').flush(BOARDS);

    expect(service.loading()).toBe(false);
    expect(service.loaded()).toBe(true);
    expect(service.boardIds()).toEqual(['platform-launch', 'marketing-plan', 'roadmap']);
  });

  it('caches the list: later load() calls make no further requests', () => {
    service.load();
    httpMock.expectOne('https://api.test/boards').flush(BOARDS);

    service.load();
    service.load();

    httpMock.expectNone('https://api.test/boards');
  });

  it('collapses concurrent load() calls into one request', () => {
    service.load();
    service.load();

    httpMock.expectOne('https://api.test/boards').flush(BOARDS);
  });

  it('re-fetches when load(true) forces a refresh', () => {
    service.load();
    httpMock.expectOne('https://api.test/boards').flush(BOARDS);

    service.load(true);

    httpMock.expectOne('https://api.test/boards').flush([{ id: 'roadmap' }]);
    expect(service.boardIds()).toEqual(['roadmap']);
  });

  it('exposes a readable error and allows a retry after a failed load', () => {
    service.load();
    httpMock
      .expectOne('https://api.test/boards')
      .flush({}, { status: 500, statusText: 'Server Error' });

    expect(service.loaded()).toBe(false);
    expect(service.error()).toContain("Couldn't load boards");

    service.load();
    httpMock.expectOne('https://api.test/boards').flush(BOARDS);
    expect(service.error()).toBeNull();
    expect(service.loaded()).toBe(true);
  });

  it('confirms a known board exists and an unknown one does not', () => {
    service.load();
    httpMock.expectOne('https://api.test/boards').flush(BOARDS);

    expect(service.boardExists('roadmap')).toBe(true);
    expect(service.boardExists('does-not-exist')).toBe(false);
  });

  it('adds a created board to the cached list', async () => {
    service.load();
    httpMock.expectOne('https://api.test/boards').flush(BOARDS);

    const created = firstValueFrom(service.create('sandbox'));
    const req = httpMock.expectOne('https://api.test/boards');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ id: 'sandbox' });
    req.flush({ id: 'sandbox' });
    await created;

    expect(service.boardIds()).toContain('sandbox');
  });

  it('removes a deleted board from the cached list', async () => {
    service.load();
    httpMock.expectOne('https://api.test/boards').flush(BOARDS);

    const deleted = firstValueFrom(service.delete('roadmap'), { defaultValue: undefined });
    const req = httpMock.expectOne((r) => r.url === 'https://api.test/boards/roadmap');
    expect(req.request.method).toBe('DELETE');
    // json-server only cascades to a board's tasks when asked; the mock API always does.
    expect(req.request.params.get('_dependent')).toBe('tasks');
    req.flush(null);
    await deleted;

    expect(service.boardIds()).not.toContain('roadmap');
  });

  it('leaves the cached list alone when a create fails', () => {
    service.load();
    httpMock.expectOne('https://api.test/boards').flush(BOARDS);

    service.create('roadmap').subscribe({ error: () => undefined });
    httpMock
      .expectOne('https://api.test/boards')
      .flush({ message: 'exists' }, { status: 409, statusText: 'Conflict' });

    expect(service.boardIds()).toEqual(['platform-launch', 'marketing-plan', 'roadmap']);
  });
});
