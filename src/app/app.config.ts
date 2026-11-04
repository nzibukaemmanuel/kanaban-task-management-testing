import { ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import {
  PreloadAllModules,
  provideRouter,
  withComponentInputBinding,
  withPreloading,
  withRouterConfig,
} from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideStore } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { provideApi } from './core/api/api.providers';
import { TASK_FEATURE_KEY } from './features/board/store/task.selectors';
import { taskReducer } from './features/board/store/task.reducer';
import { TaskEffects } from './features/board/store/task.effects';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      // Child routes (e.g. boards/:boardId/tasks/:taskId) also receive their parent's params as inputs.
      withRouterConfig({ paramsInheritanceStrategy: 'always' }),
      // Fetches lazy-loaded chunks (the boards feature) in the background after the app is stable,
      // trading a little idle bandwidth for instant navigation later.
      withPreloading(PreloadAllModules),
    ),
    // All data services go through HttpClient. In mock mode the interceptor answers requests from
    // an in-memory backend; otherwise they go out to environment.apiUrl.
    provideApi(environment),
    provideStore({ [TASK_FEATURE_KEY]: taskReducer }),
    provideEffects(TaskEffects),
    // Only wired up in dev builds — the Redux DevTools browser extension connects to this and
    // lets you step through every dispatched action and the state diff it produced.
    provideStoreDevtools({
      maxAge: 25,
      logOnly: !isDevMode(),
      autoPause: true,
      connectInZone: true,
    }),
  ],
};
