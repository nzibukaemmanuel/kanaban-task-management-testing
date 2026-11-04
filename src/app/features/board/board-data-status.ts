import { Injectable, computed, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { BoardService } from './board.service';
import { TaskActions } from './store/task.actions';
import { selectTasksError, selectTasksLoaded } from './store/task.selectors';

// One answer to "is the board data here yet?" for every page that needs both the board list and
// the tasks, so Boards and BoardDetails show the same loading / error / retry behaviour.
@Injectable({ providedIn: 'root' })
export class BoardDataStatus {
  private readonly boardService = inject(BoardService);
  private readonly store = inject(Store);

  private readonly tasksLoaded = this.store.selectSignal(selectTasksLoaded);
  private readonly tasksError = this.store.selectSignal(selectTasksError);

  readonly ready = computed(() => this.boardService.loaded() && this.tasksLoaded());

  // The store's `error` also holds write failures once tasks are loaded; those are reported by
  // the form that caused them, so only a failure of the initial fetch counts here.
  readonly error = computed(
    () => this.boardService.error() ?? (this.tasksLoaded() ? null : this.tasksError()),
  );

  readonly loading = computed(() => !this.ready() && this.error() === null);

  // Only re-requests what is actually missing, so a retry after a tasks-only failure doesn't
  // refetch boards that already arrived.
  retry(): void {
    if (!this.boardService.loaded()) {
      this.boardService.load(true);
    }
    if (!this.tasksLoaded()) {
      this.store.dispatch(TaskActions.loadTasks());
    }
  }
}
