import { Component, computed, inject, input, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink, RouterOutlet } from '@angular/router';
import { Store } from '@ngrx/store';
import { describeHttpError } from '../../../core/api/api-error';
import { NotificationService } from '../../../core/notification.service';
import { DataState } from '../../../shared/data-state/data-state';
import { SelectField, SelectFieldOption } from '../../../shared/select-field/select-field';
import { NotFound } from '../../../pages/not-found/not-found';
import { BoardSidebar } from '../board-sidebar/board-sidebar';
import { BoardDataStatus } from '../board-data-status';
import { BoardService } from '../board.service';
import { Task } from '../board-data';
import { TaskEntity } from '../store/task.model';
import { TaskActions } from '../store/task.actions';
import { selectAllTasks } from '../store/task.selectors';

const STATUS_COLUMNS: { status: Task['status']; label: string }[] = [
  { status: 'todo', label: 'Todo' },
  { status: 'doing', label: 'Doing' },
  { status: 'done', label: 'Done' },
];

@Component({
  imports: [RouterLink, RouterOutlet, SelectField, NotFound, BoardSidebar, DataState],
  selector: 'app-board-details',
  styleUrl: './board-details.css',
  templateUrl: './board-details.html',
})
export class BoardDetails {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(Store);
  private readonly boardService = inject(BoardService);
  private readonly notificationService = inject(NotificationService);
  protected readonly dataStatus = inject(BoardDataStatus);
  protected readonly deletingBoard = signal(false);

  readonly boardId = input('');
  readonly status = input('all');
  readonly sort = input<'title' | 'status'>('title');

  // Board ids come from the API, so a mistyped or stale URL (e.g. a bookmarked board that was
  // deleted) never matches one — show the same 404 as an unmatched route instead of an empty
  // board shell. Only meaningful once the boards have loaded; the template waits on that first.
  readonly boardExists = computed(() => this.boardService.boardExists(this.boardId()));

  readonly statusOptions: SelectFieldOption[] = [
    { value: 'all', label: 'All' },
    { value: 'todo', label: 'To do' },
    { value: 'doing', label: 'In progress' },
    { value: 'done', label: 'Done' },
  ];

  readonly sortOptions: SelectFieldOption[] = [
    { value: 'title', label: 'Title' },
    { value: 'status', label: 'Status' },
  ];

  // Router input binding sets these to `undefined` (not the declared default) once their
  // query param is no longer present in the URL — e.g. after a relative nav to a child route
  // that doesn't carry the params forward. Fall back to the defaults ourselves.
  readonly effectiveStatus = computed(() => this.status() ?? 'all');
  readonly effectiveSort = computed(() => this.sort() ?? 'title');

  private readonly allTasks = this.store.selectSignal(selectAllTasks);

  readonly tasks = computed(() => {
    const boardTasks = this.allTasks().filter((task) => task.boardId === this.boardId());
    const status = this.effectiveStatus();
    const sort = this.effectiveSort();
    const filtered =
      status === 'all' ? boardTasks : boardTasks.filter((task) => task.status === status);
    return [...filtered].sort((a, b) => a[sort].localeCompare(b[sort]));
  });

  // Groups the already-filtered/sorted tasks() into one section per status, for the column
  // board layout. A status filter narrows this to the single matching column rather than
  // hiding the board entirely, so "filter by status" and "view as columns" compose.
  readonly columns = computed(() => {
    const status = this.effectiveStatus();
    const tasks = this.tasks();
    const visibleColumns =
      status === 'all'
        ? STATUS_COLUMNS
        : STATUS_COLUMNS.filter((column) => column.status === status);
    return visibleColumns.map((column) => ({
      ...column,
      tasks: tasks.filter((task) => task.status === column.status),
    }));
  });

  completedSubtaskCount(task: TaskEntity): number {
    return task.subtasks.filter((subtask) => subtask.completed).length;
  }

  updateQueryParams(partial: Record<string, string>): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: partial,
      queryParamsHandling: 'merge',
    });
  }

  // Deleting a board removes all of its tasks, so unlike a single task it always asks first
  // (the "confirm before delete" preference only covers tasks). Local state is only touched
  // once the server confirms.
  deleteBoard(): void {
    const boardId = this.boardId();
    // Counted from the whole store, not tasks(), which the status filter may have narrowed.
    const taskCount = this.allTasks().filter((task) => task.boardId === boardId).length;
    const detail = taskCount === 0 ? '' : ` and its ${taskCount} task${taskCount === 1 ? '' : 's'}`;
    if (
      this.deletingBoard() ||
      !confirm(`Delete the board "${boardId}"${detail}? This can't be undone.`)
    ) {
      return;
    }
    this.deletingBoard.set(true);
    this.boardService.delete(boardId).subscribe({
      next: () => {
        this.deletingBoard.set(false);
        this.store.dispatch(TaskActions.boardRemoved({ boardId }));
        this.notificationService.success(`Board "${boardId}" was deleted.`);
        this.router.navigate(['/boards']);
      },
      error: (error: unknown) => {
        this.deletingBoard.set(false);
        this.notificationService.error(describeHttpError(error, 'delete the board'));
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/boards']);
  }
}
