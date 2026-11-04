import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { appConfig } from './app.config';
import { routes } from './app.routes';
import { BoardService } from './features/board/board.service';
import { TASK_FEATURE_KEY } from './features/board/store/task.selectors';
import { TaskService } from './features/board/task.service';

// A smoke test of the real bootstrap configuration: if a provider is missing or misconfigured,
// the app would fail at startup rather than in any single component's spec.
describe('appConfig', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: appConfig.providers }));

  it('registers the application routes with the router', () => {
    expect(TestBed.inject(Router).config).toEqual(routes);
  });

  it('provides the task store slice', () => {
    const state = TestBed.inject(Store).selectSignal(
      (s: Record<string, unknown>) => s[TASK_FEATURE_KEY],
    );

    expect(state()).toBeDefined();
  });

  it('lets the data services be created, wired to HttpClient', () => {
    expect(TestBed.inject(BoardService)).toBeTruthy();
    expect(TestBed.inject(TaskService)).toBeTruthy();
  });
});
