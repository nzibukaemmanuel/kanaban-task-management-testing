# KanbanTaskManagementWebApp

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.1.5.

## HTTP & API integration

All board and task data travels over Angular's `HttpClient` to a real REST API: json-server serving
`server/db.json` on `http://localhost:3000`, so the browser makes genuine cross-origin HTTP requests (including
CORS preflights). The app ships no mock data; `core/api/testing/` holds an in-memory backend that specs alone use.

```bash
npm run api             # terminal 1: json-server on :3000 (works on a throwaway copy of server/db.json)
npm start               # terminal 2: dev server pointed at it
npm run generate:db     # rebuild server/db.json from board-data.ts
```

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/boards` | list boards |
| POST / DELETE | `/api/boards`, `/api/boards/:id` | create / delete a board (deleting also removes its tasks; json-server is asked to cascade with `?_dependent=tasks`) |
| GET | `/api/tasks?boardId=` | list tasks, optionally for one board |
| GET | `/api/tasks/:id` | one task |
| POST | `/api/tasks` | create (server assigns the id; rejects short or duplicate titles) |
| PUT | `/api/tasks/:id` | replace a task with the edited version (the edit form's save) |
| PATCH | `/api/tasks/:id` | merge a partial update (supported by both backends; the app itself uses PUT) |
| DELETE | `/api/tasks/:id` | delete |

Failures carry real status codes (400 invalid, 404 missing, 409 duplicate title, 500 server) and a `{ message }`
body, which `describeHttpError` turns into a user-facing sentence ("The server can't be reached…", etc.).

### Layers

```
component ──dispatch──▶ TaskEffects ──▶ TaskService (HttpClient) ──▶ /api  (json-server)
    ▲                       │
    └── store selectors ◀── reducer ◀── Success / Failure action
```

- `TaskService` / `BoardService` — the only code that builds URLs or calls `HttpClient`. `TaskService` is
  stateless (cold Observables); `BoardService` caches the board list in a signal.
- `TaskEffects` — `switchMap` for the initial load (a retry cancels a stale one), `concatMap` for writes
  (they run in order). `catchError` sits inside each inner pipe, so a failed request becomes a `Failure`
  action and the effect keeps working.
- `TaskState` — `loaded` / `loading` (initial fetch), `saving` (a write is in flight) and `error`.
- `BoardDataStatus` + `DataState` — one shared answer to "are boards and tasks here yet?", rendered as a
  spinner, or an error with a **Try again** button that only re-requests what is missing.

### Behaviour by task

- **Forms (add/edit):** the form shows "Saving…" and disables submit while the request runs. The page only
  navigates away, and only reports success, once the server confirms; on failure the user stays on the form
  with their input intact and sees the server's message. The form is marked pristine only after success, so
  the unsaved-changes guard still protects edits that failed to save.
- **Delete:** confirmation first (unless turned off in Settings), then the request; the task disappears from
  every view when the server confirms, with no reload.
- **Boards:** a logged-in user can add a board from the Boards page (name → slug id, checked for blanks and
  duplicates) and delete one from its page. Deleting always asks first, names how many tasks go with it, and only
  updates the UI after the server confirms.
- **Loading / errors:** boards pages show a spinner until both datasets arrive, and an error with retry if
  either fails.
- **Fewer requests:** boards and tasks are fetched once at bootstrap and cached (signal / NgRx store); every
  page reads the cache, so navigating between boards makes no requests. `BoardService.load()` also
  de-duplicates concurrent callers.
- **Separation of concerns:** components never touch `HttpClient` or a URL — they dispatch actions and read
  selectors — so swapping the transport (or adding auth headers, retries, caching) touches one layer.

### Environments (bonus)

Two configurations, both satisfying `Environment` from `environment.model.ts`; `angular.json` swaps the file
at build time with `fileReplacements`:

| | `environment.ts` (`ng serve`) | `environment.prod.ts` (`ng build`) |
|---|---|---|
| `apiUrl` | `http://localhost:3000` | `https://kanban-api-h8q1.onrender.com` (Render) |

`provideApi(environment)` (`core/api/api.providers.ts`) turns these values into the `API_BASE_URL` token plus
`HttpClient`. No secrets belong in these files — they ship in the client bundle.

### Testing the API layer

- `core/api/testing/mock-api.interceptor.spec.ts` — the test-only in-memory backend (the app itself ships no mock data).
- `task.service.spec.ts` / `board.service.spec.ts` — `HttpTestingController`: verbs, URLs, query params,
  bodies, caching and error pass-through.
- `task.effects.spec.ts` — each effect against the test-only in-memory API, plus server-error → `Failure` paths.
- `api.providers.spec.ts` — `API_BASE_URL`, real requests to `apiUrl`, and the two environment files.
- Component specs cover the success path *and* the failure path (stay on the form / task, show the error).

## State management

The server (mock or real) is the source of truth; "state management" here is about how the client-side copy of
that data is cached and flows between components.

### Local vs. global state

- **Local**: form state inside `TaskForm` (dirty/touched, in-progress edits), the `Boards` quick-jump
  select, per-page filter/sort query params. None of it is needed outside the component that owns it.
- **Global**: the task list per board (read from `Boards`, `BoardDetails`, `TaskDetail`, `AddTask` and
  `EditTask` alike) and the board id list (read from `Boards`, `BoardDetails`, `Settings`). Both need
  to stay in sync everywhere the moment one place changes them.

### Hybrid strategy (bonus task)

Global state here is deliberately split across mechanisms rather than moved to NgRx wholesale — each
row below is chosen by what the state *is*, not by a blanket rule:

| State | Owner | Why |
|---|---|---|
| Tasks (per board) | **NgRx** (`features/board/store/`) — actions, a `createReducer` backed by `@ngrx/entity`'s `EntityAdapter`, selectors, and `TaskEffects` | Tasks are the app's actual CRUD surface (add/update/delete, filter, sort) — the kind of state that benefits from an explicit action log, time-travel debugging, and a normalized, id-keyed collection instead of `TaskService`'s `Record<boardId, Task[]>`. |
| Boards (which boards exist) | **Service-based** — `BoardService`'s `ReplaySubject<readonly string[]>` | The board list is fixed at boot and effectively never mutates at runtime. A full store slice (actions, reducer, selectors, effects) would be ceremony around a value that never changes — a `ReplaySubject` already gives every subscriber, including late ones, the current list. |
| UI / device state — theme, auth session, toast notifications, user preferences | **Service-based** — `ThemeService`, `AuthService`, `NotificationService`, `PreferencesService`, each a `signal()` (+ an `effect()` where it persists to `localStorage`) | This state belongs to *this browser tab*, not to the domain model: one mutation path per value (toggle theme, log in/out, dismiss a notice), no normalization, no multi-step flow, and no debugging value from an action log for "user clicked dark mode". A `providedIn: 'root'` service with a signal gives every consumer the same reactive value for a fraction of a store slice's code. |

This is the reverse of the textbook "NgRx for the big collections, services for one-off flags" split —
here it's Tasks (not Boards) that earns NgRx, because *task mutation count and reader count* is what
actually varies, not which entity sounds more like "the main feature."

### Trade-offs: NgRx vs. service-based state

**Complexity** — NgRx needs five files per slice (model, actions, reducer, selectors, effects) plus the
`provideStore`/`provideEffects` wiring in `app.config.ts`, and every mutation is an indirection chain:
dispatch → effect → service call → success action → reducer → selector → re-render. A service is one
`@Injectable` class with a `signal()` and a couple of methods — reading is `service.value()`, writing is
`service.method()`, no action types or reducer switch to keep in sync with the shape of state. Tasks have
four mutation paths (add/update/delete/load) read from five-plus components, so the NgRx indirection
documents itself; the board list and each UI-state service have exactly one mutation path (or none), so
the same indirection would have no story to tell.

**Scalability** — NgRx's normalized `EntityAdapter` state and parameterized selectors scale well as more
mutation paths, more entity types, or cross-cutting concerns (undo, optimistic updates, a real backend
with loading/error state) get added — a second entity type is largely a copy of the existing pattern, and
DevTools' time-travel keeps working regardless of state-tree size. Services scale fine in *count* (more
services, more signals) but each is its own silo: there's no single place to see everything a user action
changed once you have a dozen of them, and a mutation in one service triggering a change in another has to
be wired by hand instead of falling out of a shared reducer. At this app's actual scale (3 boards, ~15
tasks) neither approach is stressed — the split here is about the *shape future growth is likely to
take* (tasks: bulk actions, drag-and-drop reorder, server sync) rather than today's data volume.

**Developer productivity** — NgRx is slower to stand up for a first feature (more files, a vocabulary of
actions/effects/reducers/selectors to learn) but pays that back on every slice after the first, since a
contributor who's seen one NgRx feature in this repo can predict where to find any other, and the
DevTools action log replaces a lot of `console.log`-driven debugging as the CRUD surface grows. A service
is faster to add and faster to read cold — no vocabulary, the whole state lives in one file — but it
doesn't self-document mutation history, so "why did the theme flip to dark?" means grepping call sites
instead of reading a log; a non-issue for a handful of setters, a real cost past that. Matching each
state's shape to the tool built for that shape (Tasks → NgRx, everything else → services) gets the
productivity win from both: no boilerplate paid where it buys nothing, and no hand-rolled pub/sub
reinvented where NgRx already solves it.

### Task state — actions → effects → reducer → selectors

`TaskService` is the HTTP data layer. Components don't inject it — they dispatch `TaskActions` and read back
through `store.selectSignal(...)`:

```
component.dispatch(TaskActions.addTask({ boardId, task }))
      │
      ▼
TaskEffects.addTask$  →  TaskService.create(...)  →  POST /api/tasks  →  TaskActions.addTaskSuccess({ task })
      │
      ▼
taskReducer  →  taskAdapter.addOne(task, state)
      │
      ▼
selectAllTasks / selectTasksByBoard(boardId)  →  components re-render
```

- `task.actions.ts` — `Load Tasks`, `Add/Update/Delete Task` (+ their `Success`/`Failure` pairs), via `createActionGroup`.
- `task.reducer.ts` — `EntityAdapter<TaskEntity>`-backed `TaskState` (`TaskEntity` = `Task` + `boardId`). Starts empty and `loaded: false`; the first `Load Tasks` response fills it.
- `task.selectors.ts` — `selectAllTasks`, plus parameterized factories (`selectTasksByBoard`, `selectTaskByBoardAndId`, `selectOtherTitles`) for the boardId-scoped reads components actually need.
- `task.effects.ts` — the only place `TaskService` is called from now; turns each intent action into an HTTP call and a `Success`/`Failure` action.
- `testing.ts` — `provideTaskStoreForTests()` (store + effects + `HttpClient` wired to the zero-latency mock API, pre-loaded with the fixture unless `{ seeded: false }`) and `loadBoardsForTests()`.

### Debugging with NgRx DevTools

`provideStoreDevtools` is wired up in `app.config.ts` (`app.ts` dispatches `TaskActions.loadTasks()` on
boot, so the load request, its Success action and the resulting state are all visible). With the
[Redux DevTools browser extension](https://github.com/reduxjs/redux-devtools) installed, `ng serve` and
opening the extension panel shows every dispatched action (`[Task] Add Task` → `[Task] Add Task
Success`, etc.) and the resulting state diff in real time.

### Testing

- `task.reducer.spec.ts` / `task.selectors.spec.ts` — pure state-shape tests, no Angular DI.
- `task.effects.spec.ts` — each effect against the real `TaskService` and mock API, using `provideMockActions`.
- Component specs (`boards.spec.ts`, `board-details.spec.ts`, `add-task.spec.ts`, `edit-task.spec.ts`,
  `task-detail.spec.ts`) and the router-level `task-form-routing.integration.spec.ts` dispatch actions
  or drive the UI and assert the store-backed reads update without a reload.

### Deployment

`netlify.toml` builds with `npm run build` and publishes `dist/Kanban-Task-Management-Web-App/browser`
with a SPA catch-all redirect. Deploying needs a Netlify (or Vercel) account connected to this repo —
run `netlify deploy --prod` (or push through the connected Git integration) from an authenticated
session.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## Deploying the API

The production build needs a hosted API (a static host like Netlify serves no `/api`). `render.yaml` is a Render
Blueprint that runs json-server on `server/db.json`:

1. Push the repo, then in Render choose **New → Blueprint** and select it; note the service URL.
2. Set `apiUrl` in `src/environments/environment.prod.ts` to that URL (e.g. `https://kanban-api.onrender.com`).
3. Redeploy the app. Data resets to `db.json` when the free instance restarts.
