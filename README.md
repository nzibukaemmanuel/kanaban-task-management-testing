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

## Testing

The app is tested with [Jest](https://jestjs.io/) and [`jest-preset-angular`](https://thymikee.github.io/jest-preset-angular/)
(zoneless setup, jsdom). At the time of writing: **46 suites, 589 tests, ~99.7% statement coverage**.

### Running the tests

| Command | What it does |
| --- | --- |
| `npm test` | Run every test once. |
| `npm run test:watch` | Re-run only the tests affected by your changes as you save. |
| `npm run test:coverage` | Run every test and print a coverage report (also written to `coverage/`). |
| `npm run test:ci` | What CI runs: `--ci --runInBand --coverage`. Fails if a coverage threshold is missed. |
| `npx jest board.service` | Run only the specs whose path matches `board.service`. |
| `npx jest -t "adds a created board"` | Run only tests whose name matches. |

### Viewing coverage

`npm run test:coverage` prints a per-file table (statements, branches, functions, lines, and the uncovered
line numbers). For a browsable view open `coverage/index.html` in a browser; it highlights every uncovered line
and branch in the source. `coverage/lcov.info` is there for editor extensions and CI services. The folder is
git-ignored.

**What the four numbers mean**

- **Statements / lines** — how much of the code ran at all.
- **Functions** — how many functions were called at least once.
- **Branches** — how many sides of each `if`, `?:`, `??`, `&&` and `switch` case ran. This is the most telling
  number: a file can have 100% lines and still never test its `else`.

**Thresholds.** `jest.config.ts` fails the run if coverage drops below a floor. They sit just under the current
numbers, so a regression is caught without a single unreachable fallback blocking a commit:

| Scope | Statements | Branches | Functions | Lines |
| --- | --- | --- | --- | --- |
| Global | 97 | 90 | 98 | 97 |
| `shared/pipes/` (pure code) | 100 | 100 | 100 | 100 |
| `features/board/store/` | 98 | 85 | 100 | 98 |
| `core/` | 95 | 80 | 95 | 95 |

**Coverage is a floor, not a goal.** It shows what code *never ran*; it cannot show whether the assertions are any
good. A test with no `expect` still "covers" its lines. The first coverage report was used the other way round: to
find what had no tests (`SelectField`'s keyboard handling, `Settings`' sync rules, the mock API's error paths) and
then to write tests that assert behaviour there. The few remaining misses are `??` fallbacks that cannot be
reached, plus one dead branch in `task-form.ts` (`dueDate` has no validators, so "focus the invalid due date" can
never run).

### Where tests live and how they are named

Specs sit **next to the file they test**: `foo.ts` → `foo.spec.ts`. The suffix says what kind of test it is:

| File name | Kind | What is real, what is mocked |
| --- | --- | --- |
| `foo.spec.ts` | Unit / component | The unit under test is real. Dependencies are either real-but-cheap (the store with the in-memory API) or `jest.spyOn`-ed. |
| `foo.isolated.spec.ts` | Component in isolation | **Every** injected service is a Jest mock (`Store`, `Actions`, `Router`, `NotificationService`, …). Nothing else can make it fail. |
| `foo.integration.spec.ts` | Integration | Real router config, real store and effects, real services, in-memory API. Driven through the UI. |

Test names are sentences that state the behaviour (`'keeps the board and its tasks and shows the error when the
server fails'`), not the method name. Group related cases with `describe`. Helpers shared between specs live in
`src/testing/` (`wait-for.ts`, `mock-store.ts`) and `features/board/store/testing.ts` (store/API providers and
fixtures). These are excluded from the production build and from coverage.

### What is tested, by layer

- **Pipes** (`shared/pipes/`) — `statusLabel`, `dueDate`, `subtaskProgress`: normal input, `null`/`undefined`/empty/invalid
  input, timezone independence, no mutation, and Angular's own `pure` flag.
- **Services** — `BoardService`, `TaskService` with `HttpTestingController` (verbs, URLs, params, bodies, caching,
  error pass-through); `NotificationService`, `ThemeService`, `PreferencesService`, `AuthService` (state,
  persistence, timers).
- **Store** — reducer, selectors (including memoization) and effects (`concatMap` write ordering, `switchMap`
  load cancellation, failure recovery).
- **Components** — initialisation, `input()`/`output()` behaviour, template bindings, and DOM updates when state
  changes (`BoardDetails`, `BoardSidebar`, `TaskDetail`, `TaskForm`, `SelectField`, …).
- **Dependencies mocked** — `*.isolated.spec.ts` for `AddTask`, `EditTask` and `Login` check which selectors are
  read, exactly what is dispatched or called and with which arguments, and how the component reacts to success,
  failure, unrelated and repeated outcomes.
- **Async** — see below.
- **Integration** — `board-flow.integration.spec.ts` (list, sidebar, columns, task detail, edit/delete, board
  create/delete, query params, login redirect, retry) and `app-shell.integration.spec.ts` (theme, auth, notices and
  preferences shared through the app shell).

### Mocking

- **Spy on a real object** when most of it should keep working: `jest.spyOn(router, 'navigate').mockResolvedValue(true)`.
- **Replace a service wholesale** when the component must be tested alone: `{ provide: Router, useValue: { navigate: jest.fn() } }`.
  `createMockStore()` (in `src/testing/mock-store.ts`) stands in for NgRx's `Store`; the test pushes new state with
  `store.set(selector, value)`.
- **Prefer asserting on outcomes** (what the user sees, what ended up in the store) over implementation details.
  Assert on calls only where the call *is* the behaviour (an action dispatched, a URL navigated to).
- Spies are restored and mocks cleared automatically between tests (`restoreMocks`/`clearMocks` in `jest.config.ts`).

### Asynchronous code

The app's only timer is the notice auto-dismiss; everything else is Observables and Promises behind the in-memory
API, which answers after `MOCK_API_LATENCY_MS` (0 in most specs).

- **Fake timers** for anything with a delay: `jest.useFakeTimers()`, then `await jest.advanceTimersByTimeAsync(ms)`
  to step through "waiting" and "settled" states instead of racing real time. Always restore with
  `jest.useRealTimers()` in `afterEach`/`finally`. Install the fake clock only around the part that needs it;
  Angular's `whenStable()` can wait forever on a fake clock.
- **`async`/`await`** with `firstValueFrom(...)` for Observables that emit once.
- **`waitFor(() => expect(...))`** (`src/testing/wait-for.ts`) retries an assertion until it passes or times out.
  Jest has no built-in equivalent of Vitest's `vi.waitFor`. Use it when the thing you wait for is an effect of a
  store dispatch rather than a timer.
- **Never `setTimeout` a fixed sleep** and hope. Either step a fake clock or wait for a condition.

### Writing tests alongside new features

1. Write the test first (or at least in the same commit). A failing test proves it can fail.
2. Start at the lowest layer that can express the behaviour: pure function → service → store → component.
3. Add an `.isolated` spec when a component's job is mostly *talking to* services, and an `.integration` spec when
   a feature spans several components.
4. Check the coverage report for the files you touched. Treat an uncovered branch as a missing question, not
   a number to fix.
5. Run `npm run test:ci` before pushing. It is what CI will run.

### Unit vs integration tests

A unit test pins down one piece and mocks its neighbours; when it fails you know where to look, and it is fast. It
cannot tell you the pieces fit together. An integration test wires real pieces together and drives them as a user
would, so it catches what unit tests structurally cannot: a selector the component never subscribed to, an effect
that is not registered, a route that resolves to the wrong component, a service whose answer arrives in a shape
the component does not expect. Here, one integration test (edit a task → save → return to the detail page) fails if
any of the router, form, effect, reducer, selector or two separate components is wrong. The cost is that a
failure points at a flow rather than a line, so integration tests complement unit tests instead of replacing them.

### Why Jest

The project originally ran Vitest through Angular's `unit-test` builder; it was moved to Jest to meet the lab's
requirements. For this project Jest gives: no browser to start (jsdom), spec files run in parallel worker
processes with per-file isolation, a watch mode that re-runs only the specs affected by changed files, and
mocking (`jest.fn`, `spyOn`, fake timers) and coverage built in with no extra packages.

### Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request: install (`npm ci`), `npm run test:ci` (all tests
plus the coverage thresholds), then `ng build`. A change that breaks a test, drops coverage below its floor, or
breaks the build cannot be merged unnoticed. The coverage report is uploaded as a build artifact.
Running the same suite on every change turns the tests into a safety net: refactors are cheap because a
regression is reported minutes after it is introduced, on a clean machine, instead of by a user.

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
