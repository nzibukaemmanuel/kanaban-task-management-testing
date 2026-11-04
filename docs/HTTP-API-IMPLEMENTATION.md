# HTTP & API Integration — Implementation Report

**Project:** Kanban Task Management Web App (Part III – HTTP & API Integration)
**Stack:** Angular 22 (standalone, signals), NgRx Store/Effects/Entity, RxJS, Vitest
**Author:** NZIBUKA Emmanuel

This report explains how each of the ten lab tasks (plus the bonus) was implemented, where the code lives, and how it
was verified. File paths are relative to the repository root.

---

## 1. Summary

The app used to read a static fixture (`board-data.ts`) directly. Every read and write now goes through Angular's
`HttpClient` to a REST API, with loading, error and retry states in the UI.

The app talks to a real REST API: **json-server** on `http://localhost:3000` serving `server/db.json`
(`npm run api`, then `npm start`). The app ships no mock data; an in-memory backend in `src/app/core/api/testing/` is
used by specs only.
is active.

### Architecture

```
Component ──dispatch──▶ NgRx Effect ──▶ TaskService / BoardService ──HttpClient──▶ API
    ▲                       │                                                      (json-server)
    │                       ▼                                                       or json-server)
    └── selectors ◀── Reducer ◀── Success / Failure action
```

Components never see `HttpClient` or a URL. Services never hold task state. The NgRx store is the single cached copy
the UI reads; it changes only when the server has confirmed a write.

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/boards` | list boards |
| POST | `/boards` | create a board |
| DELETE | `/boards/:id` (`?_dependent=tasks`) | delete a board and its tasks |
| GET | `/tasks` (`?boardId=`) | list tasks, optionally for one board |
| GET | `/tasks/:id` | one task |
| POST | `/tasks` | create a task |
| PUT | `/tasks/:id` | replace a task (Edit form) |
| PATCH | `/tasks/:id` | partial update (supported; the app uses PUT) |
| DELETE | `/tasks/:id` | delete a task |

---

## Task 1 — Review and preparation

**Starting point.** Tasks were seeded from `BOARD_TASKS` into an NgRx store (entity adapter, reducer seeded
synchronously), and the board list came from a synchronous `BoardService`. No request, loading state or failure was
possible.

**Preparation.**
- `board-data.ts` stays as the *seed* for `server/db.json` and the test-only backend; the app no longer reads it directly.
- Wire types shared by both sides of the HTTP boundary were defined in `src/app/core/api/api.models.ts`
  (`BoardDto`, `TaskDto`, `TaskCreateDto`).
- The store was changed to start empty (`loaded: false`) so that "data not here yet" is a real state the UI can show.

## Task 2 — Enable HTTP functionality

- `HttpClient` is registered in `src/app/app.config.ts` through `provideApi(environment)`
  (`src/app/core/api/api.providers.ts`), which supplies the `API_BASE_URL` token
- **Configuration is organised, not hard-coded:** `src/app/core/api/api.config.ts` holds the `API_BASE_URL` and
  injection token and an `API_ENDPOINTS` map (`boards`, `tasks`). Services build URLs from these.
- Environment files live in `src/environments/` (see the Bonus section).
- **Build check:** `ng build` succeeds (production configuration, with the file replacement applied).

## Task 3 — Data service layer

Two services are the *only* code that touches `HttpClient`:

- **`TaskService`** (`src/app/features/board/task.service.ts`) — `list(boardId?)`, `get(id)`, `create(boardId, task)`,
  `update(boardId, id, task)` (PUT), `delete(id)`. Stateless; every method returns a cold Observable of one REST call.
- **`BoardService`** (`src/app/features/board/board.service.ts`) — `load(force?)`, `boardExists(id)`, `create(id)`,
  `delete(id)`; exposes `boardIds`, `loading`, `loaded` and `error` as signals.

Best practices applied: `providedIn: 'root'` + `inject()` (no constructor wiring), URLs derived from tokens, ids
URL-encoded, typed DTOs, no component or store imports inside the services (reusable from anywhere).

## Task 4 — Retrieve and display data

- At bootstrap `App` calls `boardService.load()` and dispatches `TaskActions.loadTasks()`
  (`src/app/app.ts`). `TaskEffects.loadTasks$` fetches `GET /tasks` and the reducer fills the entity store.
- Pages read through selectors / signals, so the UI stays in sync with whatever the server last confirmed:
  `Boards`, `BoardDetails`, `BoardSidebar`, `Settings` (board picker), `TaskDetail`.
- **Empty and missing states:** an empty column shows "No tasks"; a filter with no matches shows a message; an
  unknown board id shows the 404 page (only after boards have loaded, so it never flashes during loading); a missing
  task shows "Task not found".
- **Efficiency:** see Task 8.

## Task 5 — Integrate the API with forms

`AddTask` and `EditTask` dispatch `addTask` / `updateTask`; `TaskEffects` turns them into `POST /tasks` and
`PUT /tasks/:id`.

- **Feedback.** The submit button shows "Saving…" and is disabled while the request is in flight (prevents double
  submits). On success a notice is shown and the page navigates away. On failure the user *stays on the form with their
  input intact* and sees the server's message.
- **Correct unsaved-changes behaviour.** The form is marked pristine only after the server confirms
  (`TaskForm.markSaved()`), so the "you have unsaved changes" guard still protects edits that failed to save.
- **State update.** The Success action carries the server's response, so the store holds exactly what the server
  stored (including the server-assigned id on create).

## Task 6 — Deletion and updates

- **Delete task:** `TaskDetail.deleteTask()` confirms first (unless the user switched confirmation off in Settings),
  dispatches `deleteTask`, and only reports success and navigates away when `DELETE /tasks/:id` succeeds. On failure it
  stays put and shows the error.
- **Delete board:** `BoardDetails.deleteBoard()` *always* confirms — the prompt names the board and how many tasks go
  with it. On success the board is removed from `BoardService`'s cache and a `Board Removed` action drops its tasks
  from the store; no reload is needed.
- **Create board:** the Boards page has an "Add board" form for logged-in users. The typed name becomes a slug id
  (`toBoardId`: "Q4 Launch!" → `q4-launch`) and is validated for blank, unusable, too-long and duplicate names.
- **Dynamic updates:** every successful write updates the store/cache, so all views change immediately without
  reloading.

## Task 7 — Errors and loading states

- **Error mapping.** `describeHttpError` (`src/app/core/api/api-error.ts`) turns any failure into one actionable
  sentence: server unreachable (status 0), 404, 400/409/422 (uses the server's own message), 5xx (hides internals),
  unknown.
- **Effects never die.** `catchError` is placed *inside* each inner pipe, so a failed request becomes a `Failure`
  action and the effect keeps working for the next dispatch.
- **State flags.** `TaskState` tracks `loading`, `loaded`, `saving` and `error`.
- **Loading UI.** `DataState` (`src/app/shared/data-state/`) shows a spinner (`role="status"`) or the error
  (`role="alert"`) with a **Try again** button. `BoardDataStatus` combines "boards loaded" and "tasks loaded" so
  `Boards` and `BoardDetails` behave identically. Retry re-requests only what is missing.
- **Failed writes** are reported by the form/page that caused them and do not blank the screen.
- To see the error state, stop `npm run api` and reload.

## Task 8 — Optimise data handling

- **Fetch once, cache.** Boards live in a signal in `BoardService`; tasks live in the NgRx store. Navigating between
  boards, tasks and forms causes no requests.
- **De-duplication.** `BoardService.load()` is a no-op while a request is in flight or after it has loaded (unless
  forced by Retry), so several components asking for boards cost one request.
- **Ordering and cancellation.** The initial load uses `switchMap` (a retry cancels a stale request); writes use
  `concatMap` (they execute in dispatch order, so two quick edits cannot land out of order).
- **Propagation.** Components `selectSignal(...)` from the store, so one successful write updates every view.
- **Separation of concerns (the benefit).** Because only the services know about HTTP, swapping the transport,
  adding auth headers, retries or caching touches one layer. This was demonstrated concretely: the *same* app now runs
  unchanged against the test-only backend and json-server.

## Task 9 — Testing and verification

**Automated: 233 tests in 33 spec files, all passing** (Vitest + Angular TestBed). `ng build` passes.

| Area | Spec | What it proves |
|---|---|---|
| Test-only backend | `core/api/testing/mock-api.interceptor.spec.ts` | every route and verb: GET, POST, **PUT**, PATCH, DELETE; 400/404/409/500 paths; board cascade |
| Error mapping | `api-error.spec.ts` | each status class → message |
| Services | `task.service.spec.ts`, `board.service.spec.ts` | verbs, URLs, query params, bodies, caching, de-duplication, retry, error pass-through (via `HttpTestingController`) |
| Store | `task.reducer.spec.ts`, `task.effects.spec.ts`, `task.selectors.spec.ts` | state transitions, success **and** failure actions |
| Environments | `api.providers.spec.ts` | real requests to `apiUrl`; two environment files |
| UI states | `data-state.spec.ts`, `board-data-status.spec.ts`, `boards.spec.ts` | loading → ready, error → retry → recovered |
| Forms and routes | `add-task`, `edit-task`, `task-detail`, `task-form-routing.integration` specs | save, delete, navigation, and the failure path (stay on form) |
| Boards | `boards.spec.ts`, `board-details.spec.ts`, `board-id.spec.ts` | create (valid/invalid/failed), delete (confirm/decline/success/failure) |

→ edit task (PUT) → delete task (DELETE) → delete board — was run against **real json-server** (`npm run api` + `npm start`):
all steps passed with real network traffic
(`GET /boards`, `GET /tasks`, `POST`, `PUT`, `DELETE`, `DELETE /boards/:id?_dependent=tasks`, plus CORS `OPTIONS`
preflights), **no console errors**.

With json-server stopped, the Boards page showed *"Couldn't load boards. The server can't be reached — check your
connection and try again."* with a **Try again** button.

## Task 10 — Deployment

**Done**
- All changes are committed and pushed to GitHub (`https://github.com/nzibukaemmanuel/kanaban-task-management`)
  with a clear, incremental history.
- `netlify.toml` builds with `npm run build`, publishes `dist/Kanban-Task-Management-Web-App/browser`, and has an SPA
  catch-all redirect; `public/_redirects` does the same for hosts that read it.
- The production build uses `environment.prod.ts` (`apiUrl: '/api'`) — set it to a hosted API before deploying.

**Still to do (needs the owner's Netlify/Vercel account)**
1. Connect the GitHub repo to Netlify (or run `netlify deploy --prod`), build command `npm run build`.
2. Open the live URL and repeat the Task 9 lifecycle to confirm the API integration works there.
3. Deploy `server/db.json` with json-server to a service such as
   Render, then set `apiUrl` to its URL in `src/environments/environment.prod.ts`.

## Bonus — Environment configuration

| | `environment.ts` (`ng serve`) | `environment.prod.ts` (`ng build`) |
|---|---|---|
| `apiUrl` | `http://localhost:3000` | `https://kanban-api-h8q1.onrender.com` |

- `environment.model.ts` defines the `Environment` interface every file must satisfy (kept separate because
  `angular.json` swaps files at build time).
- `angular.json` `fileReplacements` select the file per configuration (`production`).
- **Switching was tested** (`api.providers.spec.ts`).
- **Secrets:** environment files are compiled into the client bundle, so no API keys or credentials belong in them.
  This app needs none; a real secret should live behind a server (or be injected at deploy time as a non-secret public
  key).

---

## Limitations and honest notes

- The deployed build has no backend until `environment.prod.ts` points at a hosted API.
- json-server does not enforce business rules (e.g. duplicate titles); the form validator covers that on the client,
  while the test-only backend enforces it server-side to exercise 409 handling.
- Login is a fixed demo credential held in memory (no real auth backend), as in earlier labs.

## Repository map (new or changed for this lab)

```
src/environments/                 environment.ts, .prod.ts, .model.ts
src/app/core/api/                 api.config, api.providers, api.models, api-error, testing/ (test-only mock backend)
src/app/features/board/           task.service, board.service, board-data-status, board-id,
                                  boards/, board-details/, add-task/, edit-task/, task-detail/, task-form/
src/app/features/board/store/     actions, reducer, effects, selectors, testing helpers
src/app/shared/data-state/        loading / error / retry component
server/                           db.json, generate-db.mjs, start-api.mjs   (json-server)
docs/                             this report
```
