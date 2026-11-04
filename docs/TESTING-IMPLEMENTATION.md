# Testing & Quality Assurance with Jest — Implementation Report

**Project:** Kanban Task Management Web App (Part V – Testing & Quality Assurance with Jest)
**Stack:** Angular 22 (standalone, signals, zoneless), NgRx Store/Effects/Entity, RxJS, Jest 30, jest-preset-angular 17, jsdom
**Author:** NZIBUKA Emmanuel

This report explains how each of the nine lab tasks (plus the bonus) was implemented, why the tests are shaped the
way they are, what testing turned up, and how to run and extend the suite. File paths are relative to the repository
root. For the short "how do I run it" version, see the *Testing* section of [`README.md`](../README.md).

---

## 1. Summary

The app already had 232 tests, but they ran on Vitest through Angular's `unit-test` builder, several components had
no test of their rendered output, and nothing measured or enforced coverage. The suite now runs on **Jest**, has
**603 tests in 51 suites**, measures coverage, fails the build if it drops, and runs in CI.

| | Start of the lab | End of the lab |
| --- | --- | --- |
| Test runner | Vitest (Angular `unit-test` builder) | Jest 30 + jest-preset-angular 17 |
| Tests / suites | 232 / 33 | **603 / 51** |
| Statement coverage | not measured (94.9% when first measured) | **99.7%** |
| Branch coverage | not measured (82.9% when first measured) | **93.7%** |
| Function coverage | not measured (99.6% when first measured) | **100%** |
| Coverage enforced | no | yes, thresholds in `jest.config.ts` |
| CI | none | GitHub Actions: tests + coverage gate + build |

### The shape of the suite

```
                    ┌──────────────────────────┐
                    │  Snapshot  (14)          │  structure of presentational components
                    ├──────────────────────────┤
                    │  Integration (43)        │  real router + store + effects + services
                    ├──────────────────────────┤
                    │  Isolated component (38) │  every service replaced by a Jest mock
                    ├──────────────────────────┤
                    │  Component / DOM  (~230) │  one component, real or spied dependencies
                    ├──────────────────────────┤
                    │  Unit: services, store,  │
                    │  pipes, validators (~275)│  fast, one piece at a time
                    └──────────────────────────┘
```

(Counts are approximate for the middle layers; see the inventory in section 12.)

### How to run it

```bash
npm test                  # every test, once
npm run test:watch        # re-run only what your changes affect
npm run test:coverage     # tests + coverage table + HTML report in coverage/
npm run test:ci           # what CI runs: --ci --runInBand --coverage
npx jest board.service    # only specs whose path matches
npx jest -t "adds a created board"   # only tests whose name matches
```

---

## Task 1 — Testing environment setup

**Goal:** replace the old test framework with Jest and keep the existing tests green.

**Starting point.** The brief says "replace Jasmine and Karma", but this project had already moved off Karma: it used
Vitest through `@angular/build:unit-test`. So the task became a Vitest → Jest migration.

**What was done**

- Removed `vitest` and the `test` target in `angular.json`; installed `jest`, `jest-preset-angular`, `@types/jest`,
  `jest-environment-jsdom` and `ts-node`.
- `jest.config.ts` uses the `jest-preset-angular` preset, jsdom, co-located specs (`src/**/*.spec.ts`), and
  `restoreMocks` / `clearMocks` so spies cannot leak between tests.
- `setup-jest.ts` calls `setupZonelessTestEnv()` (the app is zoneless) and adds a `structuredClone` fallback, because
  jsdom does not provide it and both the app's test helpers and several specs use it.
- `tsconfig.spec.json` points at the Jest types; `src/testing/` is part of the spec compilation only (see Findings).
- Ported the 232 existing tests mechanically:

  | Vitest | Jest |
  | --- | --- |
  | `vi.spyOn`, `vi.fn`, `vi.useFakeTimers`, `vi.advanceTimersByTime` | `jest.*` (same names) |
  | `expect(x).toHaveBeenCalledOnce()` | `expect(x).toHaveBeenCalledTimes(1)` |
  | `await vi.waitFor(() => …)` | `await waitFor(() => …)` from `src/testing/wait-for.ts` |

- Scripts: `test`, `test:watch`, `test:ci`, `test:coverage`.

**Why Jest improves speed, isolation and workflow.** There is no browser to launch (jsdom), spec files run in parallel
worker processes and each file gets a fresh module registry, `--watch` re-runs only the specs related to changed
files, and mocking, fake timers, snapshots and coverage are built in rather than extra packages. The whole suite
(603 tests) runs in roughly ten seconds.

---

## Task 2 — Component testing fundamentals

**Principle:** assert what a user (or assistive technology) would observe, not how the component is written.

Every component test follows the same four steps:

1. Create the component through `TestBed` with the providers it needs.
2. Drive it through its public surface: `fixture.componentRef.setInput(...)`, clicks, input events, store dispatches.
3. Let Angular settle: `fixture.detectChanges()` then `await fixture.whenStable()`.
4. Assert on the DOM (text, attributes, which elements exist) and on outputs.

```ts
// board-sidebar.spec.ts — a template binding reflects underlying data
it('renders one link per board, labelled with its id', () => {
  expect(links().map((link) => link.textContent?.trim())).toEqual([
    'platform-launch', 'marketing-plan', 'roadmap',
  ]);
});
```

| Component | What the tests confirm |
| --- | --- |
| `BoardSidebar` (new spec, 13) | Initialises expanded; one link per board with the right `href`; heading count; labelled `nav`; only the current board is `--active`; picks up a board created later; collapse/expand through both buttons. |
| `BoardDetails` (+15) | One column per status with counts; cards in the right column, sorted by title; subtask progress line (hidden when none); `status` input narrows to one column; empty columns say "No tasks"; a task moved in the store moves columns without a reload; toolbar wiring; delete-in-flight state; not-found and loading states. |
| `TaskDetail` (+15) | Title, status label (raw key kept in `data-status` for styling), description, formatted due date; subtasks as disabled labelled checkboxes; summary "(1/2)"; optional sections hidden; live updates; edit link; delete button state; unknown task or wrong board → "Task not found". |
| `TaskForm` (+11) | `submitLabel` and `saving` inputs; duplicate check re-runs when `existingTitles` changes; `save` emitted once and only when valid; unsaved-changes hint; prefilled DOM values; subtask completion and ids survive a save. |
| `SelectField` (+27) | Complete keyboard model (arrows clamp at the ends, Home/End, Enter/Space, Escape, Tab), `aria-*` wiring, outside clicks. |

---

## Task 3 — Testing components with dependencies

**Goal:** prove a component works against *mocked* services, and that it can be tested in isolation.

Three components have a second spec, `*.isolated.spec.ts`, in which **every injected collaborator is a Jest mock**
(`AddTask`, `EditTask`, `Login`). No reducer, effect, HTTP call or router is involved, so a failure can only come
from the component itself.

```ts
// add-task.isolated.spec.ts
const router = { navigate: jest.fn() };
const notifications = { success: jest.fn(), error: jest.fn() };

TestBed.configureTestingModule({
  imports: [AddTask],
  providers: [
    { provide: Store, useValue: store },          // createMockStore(...)
    { provide: Actions, useValue: actions$ },     // a plain Subject the test controls
    { provide: Router, useValue: router },
    { provide: NotificationService, useValue: notifications },
  ],
});

it('on success: marks the form saved, notifies, and goes back to the board', () => {
  const markSaved = jest.spyOn(form(), 'markSaved');
  component.onSave(value);

  actions$.next(TaskActions.addTaskSuccess({ task: task('new', 'roadmap', 'New task') }));

  expect(markSaved).toHaveBeenCalledTimes(1);
  expect(notifications.success).toHaveBeenCalledWith('"New task" was added.');
  expect(router.navigate).toHaveBeenCalledWith(['/boards', 'roadmap']);
});
```

`src/testing/mock-store.ts` provides `createMockStore([[selector, value], …])`: a stand-in for NgRx's `Store` whose
`selectSignal` returns a signal the test controls with `store.set(selector, value)`. It throws if a component asks for
a selector the test did not register, so a hidden extra dependency cannot slip through.

What the isolated specs verify:

- **Calls and arguments** — exactly one `dispatch`, with `addTask({ boardId, task })`; `navigate` with the right URL.
- **Reaction to service output** — success, failure, *unrelated* actions (ignored), and a *second* outcome
  (ignored: the stream uses `take(1)`).
- **Recovery** — after a failure the user can save again and succeed.
- **No side effects it should not have** — cancelling navigates without dispatching; a rejected login never reads the
  default board preference.

**`spyOn` vs `useValue`.** `jest.spyOn(realObject, 'method')` is used when most of the real object should keep
working (the router, `TaskService`). `{ provide: X, useValue: { … jest.fn() } }` is used when the component must be
tested alone. The older component specs use the first style; the isolated specs use the second.

---

## Task 4 — Service testing

**Services** are tested with `HttpTestingController`: each assertion is about the request actually sent (verb, URL,
params, body) and what the service does with the answer.

```ts
// board.service.spec.ts
it('url-encodes the board id', () => {
  service.delete('my board/1').subscribe();

  const req = httpMock.expectOne((r) => r.url.startsWith('https://api.test/boards/'));
  expect(req.request.url).toBe('https://api.test/boards/my%20board%2F1');
  req.flush(null);
});
```

| Service | Behaviour covered |
| --- | --- |
| `BoardService` (23) | Load/cache/force-reload; concurrent `load()` collapses to one request; error → readable message and retry; a failed *forced* refresh keeps the last known ids; create appends in order; delete is URL-encoded and keeps order; a failed create/delete leaves the cache alone. |
| `TaskService` (21) | Query params omitted for no/empty board; every field of a created task is sent; the input is not mutated; an update takes id and board from its arguments, not the task value; errors (500, network status 0, 404) pass through and emit no value. |
| `NotificationService` (19), `ThemeService`, `PreferencesService`, `AuthService` | State, persistence to `localStorage`, timers (Task 6). |

**The store** is tested at all three levels:

- **Reducer** (25): flags for every write and every failure, *replace not merge* on load, a failed reload keeps data,
  unknown ids are no-ops, unrelated actions return the *same* state object, and frozen state proves nothing is mutated.
- **Selectors** (15): status flags, unknown board/task, and **memoization** (same array reference while state is
  unchanged, a new one when a task on that board changes).
- **Effects** (15): recovery after a failure, service called with the right arguments, readable failure messages,
  `concatMap` ordering of writes, `switchMap` cancelling a pending load.

**Error handling** is tested explicitly at every layer: `describeHttpError` (all status branches, never leaks a 5xx
server message), the services (error passes through), the effects (→ `Failure` action), the reducer (error recorded,
data kept) and the components (stay on the page, show the reason).

---

## Task 5 — Pipe testing

The templates formatted values inline (the raw status key `doing`, the raw ISO date, "x of y subtasks") and the app
had no custom pipes, so there was nothing to test. Three **pure standalone pipes** were extracted and are now used in
`TaskDetail` and `BoardDetails`:

| Pipe | Input → output | Edge cases tested |
| --- | --- | --- |
| `statusLabel` | `doing` → "In progress" | `null`, `undefined`, `''`, unknown (`archived`), wrong case (`DONE`), and prototype keys (`toString`, `__proto__`) all → `''` |
| `dueDate` | `2026-08-10` → "Aug 10, 2026" | no zero padding; leap days; **independent of the local timezone**; `''`, `null`, `10/08/2026`, `2026-13-01`, `2026-02-30`, `2027-02-29`, padded input → `''` |
| `subtaskProgress` | 2 of 3 done → "2 of 3 subtasks" | singular "1 of 1 subtask"; `null`/`undefined`/`[]` → `''`; input not mutated; new array reference re-evaluates |

**Purity** is checked two ways: the same input always gives the same output, and Angular's own metadata says so
(`expect(StatusLabelPipe.ɵpipe.pure).toBe(true)`).

---

## Task 6 — Asynchronous testing

The app has one real timer (the success-notice auto-dismiss) and an in-memory API that answers after
`MOCK_API_LATENCY_MS` (0 in most specs). With **fake timers** the "waiting" window becomes something a test can step
through, instead of racing real time.

```ts
// async-state.spec.ts — latency is 100 ms
it('raises saving while an add is in flight and only adds the task once the server answers', async () => {
  store.dispatch(TaskActions.addTask({ boardId: 'roadmap', task: newTask('Async add') }));
  await jest.advanceTimersByTimeAsync(LATENCY - 1);

  expect(snapshot().saving).toBe(true);
  expect(snapshot().titles).not.toContain('Async add');

  await jest.advanceTimersByTimeAsync(1);

  expect(snapshot().saving).toBe(false);
  expect(snapshot().titles).toContain('Async add');
});
```

| Area | Behaviour covered |
| --- | --- |
| Notice timers | Still visible at 3999 ms, gone at 4000 ms; no timer left running; a manual dismiss cancels it; an error replacing a success cancels the success timer; a success replacing an error starts a fresh countdown; `persistSuccess` on/off. |
| Interceptor latency | A response is held back until exactly the latency has elapsed; **errors are delayed too** (see Findings); concurrent requests share one timeline; an unsubscribed request never delivers and leaves no timer. |
| Store + effects | `loading`/`saving` while in flight; failure reported only after the latency; retry recovers; a newer load supersedes a pending one; writes are processed one at a time in order. |
| `BoardService` | `loading` until the boards arrive; a duplicate `load()` sends no second request. |
| `AddTask` end to end | Navigates and notifies **only after** the save completes; stays put on failure. |

Three techniques are used, depending on what is being waited for:

- **Fake timers** (`advanceTimersByTimeAsync`) for anything with a delay. They are always restored with
  `jest.useRealTimers()`. The fake clock is installed only around the part that needs it, because Angular's
  `whenStable()` can wait forever on a fake clock.
- **`async`/`await` with `firstValueFrom`** for Observables that emit once.
- **`waitFor(() => expect(...))`** (`src/testing/wait-for.ts`) retries an assertion until it passes, for results that
  arrive through the store rather than a timer. Jest has no built-in equivalent of Vitest's `vi.waitFor`.

No test sleeps for a fixed time and hopes.

---

## Task 7 — Integration testing with TestBed

Integration tests use the **real route table, store, effects and services** (on the in-memory API) and drive the
app through the UI with `RouterTestingHarness`. Each test follows one user action and asserts that *every component
that shows that data agrees*.

**`board-flow.integration.spec.ts`** (16 tests)

- Boards list counts come from the store; sidebar navigation keeps URL, heading and active link in step.
- A task added to the store appears in the board columns at once and in the list count after navigating back.
- **Edit through the UI:** type a new title, save → back on the detail page → `TaskDetail` *and* the board columns show
  it, and the success notice appears. (One flow touching the form, an effect, the reducer, a selector, and two
  separate components.)
- A status change moves the card between columns and updates the detail badge together.
- Delete a task (confirmed / declined); create a board (appears in list and sidebar, opens empty); delete a board
  (list, sidebar and store tasks all drop it; visiting it again shows not-found).
- `?status=` and `?sort=` from the URL, and the status select writing back to the URL.
- Login redirect: guarded page → login form → back to the exact page.
- Load failure → error → the `retry` output recovers.

**`app-shell.integration.spec.ts`** (17 tests) mounts the real `App` and covers state shared through the shell: the
single initial load (later navigation makes no more GETs), theme (header toggle ↔ `<html>` ↔ open Settings form),
authentication (header, add-board form, login to the default board, logout), the shared notice banner, and
preferences shared between Settings and the task pages.

**Observables and event emitters.** The boards list count is an Observable (`store.select` through the `async` pipe);
`SelectField.valueChange`, `TaskForm.save`/`cancel` and `DataState.retry` are outputs. The flows above exercise each
one end to end: the emitted value reaches the store, and the store's answer reaches every subscribed view.

**Unit vs integration — why both.** A unit test pins down one piece and mocks its neighbours: when it fails you know
where to look, and it is fast, but it cannot show the pieces fit together. An integration test wires real pieces
together and catches what unit tests structurally cannot: a selector a component never subscribed to, an effect that
is not registered, a route that resolves to the wrong component, a service answer in a shape the component does not
expect. The cost is that a failure points at a flow rather than a line. They complement each other; neither
replaces the other.

---

## Task 8 — Code coverage and quality metrics

`npm run test:coverage` prints a per-file table and writes `coverage/index.html` (a browsable report that highlights
every uncovered line and branch) and `coverage/lcov.info`.

**What each metric means.** *Statements/lines*: code that ran at all. *Functions*: functions called at least once.
*Branches*: each side of every `if`, `?:`, `??`, `&&` and `switch` case. Branches are the most telling: a file can have
100% lines and never test its `else`.

**Using the first report.** The first report (94.9 / 82.9 / 99.6 / 94.7) was used to decide what to test next, not as a
score to push up:

| File | Before | Why it was weak | What was added |
| --- | --- | --- | --- |
| `select-field.ts` | 68.7% stmts, 47.7% branches | keyboard handling almost untested | 27 tests: full keyboard model + ARIA |
| `settings.ts` | 50% branches | the "don't overwrite a field the user edited" rules | 13 tests |
| `mock-api.db.ts` | 91.9% stmts, 75.4% branches | validation / 404 / 409 paths | 37-test spec |
| `api-error.ts`, `duplicate-title.validator.ts` | missing branches | default status, null value | targeted tests |

**Final numbers and thresholds.** 99.7% statements, 93.7% branches, 100% functions, 99.7% lines. `jest.config.ts`
fails the run if coverage drops below a floor, set just under the current numbers:

| Scope | Statements | Branches | Functions | Lines |
| --- | --- | --- | --- | --- |
| Global | 97 | 90 | 98 | 97 |
| `shared/pipes/` | 100 | 100 | 100 | 100 |
| `features/board/store/` | 98 | 85 | 100 | 98 |
| `core/` | 95 | 80 | 95 | 95 |

The gate was verified to work: with the branch floor raised to 99%, Jest reported "Coverage for branches (93.69%) does
not meet global threshold" and exited with code 1 although every test passed.

**What is measured:** application code in `src/app` only; specs, `.d.ts` and the `store/testing.ts` helper are
excluded, so the percentages describe the product, not the tests.

**Coverage complements meaningful tests; it does not replace them.** It proves what code *never ran*, not that the
assertions are any good. A test with no `expect` still "covers" its lines. That is why the tests above assert
behaviour (what the user sees, what ended up in the store), and why a coverage floor is set below 100%: chasing an
unreachable `??` fallback would produce a worse test, not a better product.

---

## Task 9 — Continuous improvement

**README.** The *Testing* section of `README.md` documents how to run tests, view coverage, what the metrics mean,
the thresholds, the file-naming conventions, mocking and async guidelines, and the CI workflow.

**Conventions**

| File name | Kind | What is real / mocked |
| --- | --- | --- |
| `foo.spec.ts` | Unit / component | The unit is real; dependencies real-but-cheap or `spyOn`-ed |
| `foo.isolated.spec.ts` | Component in isolation | Every injected service is a Jest mock |
| `foo.integration.spec.ts` | Integration | Real router, store, effects, services; in-memory API |
| `foo.snapshot.spec.ts` | Snapshot | A presentational component; DOM compared with `__snapshots__/` |

Specs sit next to the file they test. Test names are sentences stating behaviour. Shared helpers live in `src/testing/`
and `features/board/store/testing.ts`.

**Test alongside features.** Write the test first (or in the same commit) so it has been seen to fail; start at the
lowest layer that can express the behaviour (pure function → service → store → component); add an `.isolated` spec
when the component's job is mostly talking to services and an `.integration` spec when a feature spans components;
look at the coverage report for the files you touched; run `npm run test:ci` before pushing.

**CI/CD.** `.github/workflows/ci.yml` runs on every push to `main` and every pull request: `npm ci` →
`npm run test:ci` (all tests **and** the coverage thresholds) → upload the coverage report as an artifact →
`npm run build`. Older runs for the same branch are cancelled when a newer push arrives. It uses Node 24 because the
Angular CLI 22 requires `^22.22.3 || ^24.15.0`. In practice this means a change that breaks a test, drops coverage
below its floor, or breaks the production build cannot be merged unnoticed, and refactoring is cheap because a
regression is reported minutes after it is introduced, on a clean machine. The same pipeline is the gate in front of the
**Vercel** deployment: with branch protection requiring the CI check, nothing reaches `main` (and so production)
unless the tests, the coverage floors and the build all pass. Vercel itself only builds the app; it does not run
the tests.

---

## Bonus — Snapshot testing

Fourteen snapshots in five `*.snapshot.spec.ts` files guard the **structure** of the presentational pieces:
`DataState` (loading, custom label, error with retry), `Notice` (none, success as `role="status"`, error as
`role="alert"`), `BoardSidebar` (expanded, collapsed), `TaskDetail` (full, bare, not found) and the `BoardDetails`
columns (populated, filtered, empty board).

```
exports[`Notice (snapshots) renders an error notice as an alert 1`] = `
<div>
  <div class="banner" data-kind="error" role="alert">
    <span>Couldn't save the task.</span>
    <button type="button">Dismiss</button>
  </div>
</div>
`;
```

- The Angular serializers in `jest-preset-angular` strip `ng-reflect-*`, `_ngcontent-*` and comment nodes, so a
  snapshot changes only when the markup does.
- **Components, not pages.** The board page includes `SelectField`s whose generated ids depend on how many were created
  earlier in the run, which would make a snapshot depend on test order; so only the columns are snapshotted. All
  snapshots also pass under `jest --randomize`.
- **They do catch regressions.** Changing "Dismiss" to "Close" in `notice.html` failed exactly the two notice
  snapshots that contain the button, with a readable diff (the change was then reverted).
- **A changed snapshot is a question, not a chore.** If the change is intended, review the diff and run
  `npx jest -u <spec>`. Never run `jest -u` over the whole suite to turn a red run green. In CI (`--ci`) a *missing*
  snapshot fails the run, so new `.snap` files must be committed.

---

## 10. What testing found

Writing tests surfaced real defects and one dead branch:

1. **The mock API delayed successes but not failures.** The interceptor used RxJS `delay(latency)`, which only
   postpones *values*; an error is forwarded immediately. A request that failed therefore came back instantly while a
   successful one waited, which made error states look unrealistically fast and hid in-flight states. Found by a test
   asserting "no error before the latency has passed". Fixed with `timer(latency).pipe(mergeMap(() => response))`.
2. **A test helper broke `ng build`** (introduced and fixed within the lab). `src/testing/mock-store.ts` references
   `jest`, which the app's `tsconfig.app.json` does not provide, giving `TS2304`. Fixed by excluding `src/testing/**`
   from the app compilation and including it in `tsconfig.spec.json`. Lesson: the test run alone does not prove the
   build works, which is why CI runs both.
3. **Dead code.** `task-form.ts` has a branch that focuses an invalid due date, but `dueDate` has no validators, so it
   can never run. It is the main reason branch coverage is not higher.
4. **Unused code removed.** After `subtaskProgress` replaced it in the template, `BoardDetails.completedSubtaskCount`
   was dead and was deleted.

---

## 11. Limitations and honest notes

- **No end-to-end tests.** Everything runs in jsdom: there is no real layout, real focus ring, scrolling or browser
  history. Focus *order* is asserted via `document.activeElement`; visual correctness is not tested. The README's
  `ng e2e` section is unchanged and no e2e framework is installed.
- **The CI workflow had not run on GitHub when this was written.** Its commands were run locally (`npm ci --dry-run`,
  `npm run test:ci`, `ng build`), but the first real run is the proof.
- **Coverage is below 100% on purpose** (see Task 8). The misses are unreachable `??` fallbacks and the dead branch
  above.
- **Deployment is configured but was not performed from this environment.** `vercel.json` and `engines.node` are in
  place and the build output path was verified locally, but importing the repo into Vercel needs the owner's account.
- **The in-memory API is a test double.** It reproduces the REST behaviour the app depends on (validation, 404/409,
  cascade on board delete) but is not the json-server the app talks to in production; the HTTP layer is covered
  separately with `HttpTestingController`.
- **`structuredClone` fallback.** The one in `setup-jest.ts` copies through JSON, so it would drop `Date` and
  `undefined` values. That is fine for the plain-data fixtures used here but is not a general polyfill.
- **`waitFor` polls** every 10 ms up to 1 s. It is for results that arrive through the store; timers use fake timers.
- **Snapshots only protect what they capture.** They say nothing about behaviour and add review noise when markup
  legitimately changes, which is why there are only fourteen.
- **Test-only ids.** `SelectField` generates ids from a module counter, so it is deliberately not snapshotted.
- **`docs/HTTP-API-IMPLEMENTATION.md`** (the previous lab's report) still names Vitest as the runner; it was left
  untouched as a record of that lab.

---

## 12. Test inventory

603 tests in 51 suites. Counts expand parameterised (`it.each`) cases.

| Area | Spec files | Tests |
| --- | --- | ---: |
| Pipes (`shared/pipes`) | `due-date`, `status-label`, `subtask-progress` | 37 |
| Shared components | `select-field` 38, `notice` 4, `data-state` 3 | 45 |
| Core services and guards | `notification.service` 19, `theme` 5, `preferences` 5, `auth.service` 5, `auth.guard` 2, `unsaved-changes.guard` 3 | 39 |
| API layer | `mock-api.db` 37, `mock-api.interceptor` 16, `api-error` 13, `api.providers` 3 | 69 |
| Board services | `board.service` 23, `task.service` 21, `board-data-status` 5, `board-id` 3, `board.routes` 3 | 55 |
| Store | `task.reducer` 25, `task.selectors` 15, `task.effects` 15 | 55 |
| Board components | `task-form` 45, `board-details` 34, `task-detail` 25, `boards` 14, `board-sidebar` 13, `add-task` 8, `edit-task` 8, `duplicate-title.validator` 8 | 155 |
| Pages and app | `settings` 20, `login` 5, `app` 6, `app.routes` 2, `app.config` 3, `not-found` 1, `tips-panel` 1 | 38 |
| Isolated component specs | `add-task` 14, `edit-task` 13, `login` 11 | 38 |
| Async state | `async-state` | 15 |
| Integration | `board-flow` 16, `app-shell` 17, `task-form-routing` 10 | 43 |
| Snapshot | `board-details` 3, `board-sidebar` 2, `task-detail` 3, `data-state` 3, `notice` 3 | 14 |

---

## 13. Repository map (new or changed for this lab)

```
jest.config.ts                         Jest + preset, coverage collection and thresholds
setup-jest.ts                          zoneless test environment, structuredClone fallback
tsconfig.spec.json / tsconfig.app.json Jest types; src/testing in spec build only
angular.json                           `test` target removed
package.json                           jest deps, test / test:watch / test:ci / test:coverage
.github/workflows/ci.yml               CI: install, test:ci, upload coverage, build
README.md                              "Testing" section
src/testing/wait-for.ts                waitFor() helper (Jest has no vi.waitFor)
src/testing/mock-store.ts              createMockStore() for isolated specs
src/app/shared/pipes/*                 statusLabel, dueDate, subtaskProgress (+ specs)
src/app/core/api/testing/mock-api.interceptor.ts   errors now delayed too (Findings #1)
src/app/**/*.isolated.spec.ts          add-task, edit-task, login
src/app/**/*.integration.spec.ts       board-flow, app-shell (task-form-routing pre-existed)
src/app/**/*.snapshot.spec.ts + __snapshots__/     14 snapshots
src/app/features/board/async-state.spec.ts         fake-timer state transitions
src/app/features/board/board-sidebar/board-sidebar.spec.ts   new
src/app/core/api/testing/mock-api.db.spec.ts       new
src/app/app.config.spec.ts                         bootstrap smoke test
docs/TESTING-IMPLEMENTATION.md         this report
vercel.json                            Vercel build/output/SPA-rewrite config; package.json `engines.node` = 24.x
```

### Commit history of the lab

| # | Commit | Task |
| --- | --- | --- |
| 1 | `chore(test): replace Vitest with Jest and jest-preset-angular` | 1 |
| 2 | `chore(test): harden Jest config and add test scripts` | 1 |
| 3 | `test(pipes): add pure statusLabel, dueDate and subtaskProgress pipes with unit tests` | 5 |
| 4 | `test(services): cover BoardService load, create and delete failure paths` | 4 |
| 5 | `test(services): extend TaskService and NgRx store coverage` | 4 |
| 6 | `test(components): cover BoardSidebar and BoardDetails rendering and state` | 2 |
| 7 | `test(components): cover TaskDetail rendering and TaskForm host inputs` | 2 |
| 8 | `test(components): isolate AddTask, EditTask and Login from their services` | 3 |
| 9 | `test(async): step through timers, latency and in-flight state; delay mock API errors` | 6 |
| 10 | `build: exclude test helpers in src/testing from the app compilation` | fix |
| 11 | `test(integration): verify board, task and service data flow through the real router` | 7 |
| 12 | `test(integration): verify shared app state stays in sync across the shell and pages` | 7 |
| 13 | `test(coverage): fill the gaps found by the first coverage report` | 8 |
| 14 | `chore(test): enforce coverage thresholds and add coverage scripts` | 8 |
| 15 | `ci: run tests with coverage thresholds and the production build on push and PR` | 9 |
| 16 | `docs(readme): add testing section, conventions and CI notes` | 9 |
| 17 | `test(snapshot): add snapshot tests for presentational components` | Bonus |
