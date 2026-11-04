import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { describeHttpError } from '../../core/api/api-error';
import { API_BASE_URL, API_ENDPOINTS } from '../../core/api/api.config';
import { BoardDto } from '../../core/api/api.models';

type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

// Single owner of "what boards exist" so Boards, BoardDetails, Settings and the sidebar all read
// the same list. The list is fetched once and cached in a signal: every later reader gets it
// for free, and `load()` is a no-op while a request is in flight or the list is already here, so
// opening five components that each ask for boards still costs one request.
@Injectable({ providedIn: 'root' })
export class BoardService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/${API_ENDPOINTS.boards}`;

  private readonly ids = signal<readonly string[]>([]);
  private readonly status = signal<LoadStatus>('idle');
  private readonly errorMessage = signal<string | null>(null);

  readonly boardIds = this.ids.asReadonly();
  readonly loading = computed(() => this.status() === 'loading');
  readonly loaded = computed(() => this.status() === 'loaded');
  readonly error = this.errorMessage.asReadonly();

  // Fire-and-forget: results land in the signals above. `force` bypasses the cache (used by the
  // Retry button after a failure).
  load(force = false): void {
    if (this.status() === 'loading' || (this.status() === 'loaded' && !force)) {
      return;
    }
    this.status.set('loading');
    this.errorMessage.set(null);
    this.http.get<BoardDto[]>(this.url).subscribe({
      next: (boards) => {
        this.ids.set(boards.map((board) => board.id));
        this.status.set('loaded');
      },
      error: (error: unknown) => {
        this.errorMessage.set(describeHttpError(error, 'load boards'));
        this.status.set('error');
      },
    });
  }

  boardExists(boardId: string): boolean {
    return this.ids().includes(boardId);
  }

  create(boardId: string): Observable<BoardDto> {
    return this.http
      .post<BoardDto>(this.url, { id: boardId })
      .pipe(tap((board) => this.ids.update((ids) => [...ids, board.id])));
  }

  // `_dependent=tasks` asks json-server to delete the board's tasks along with it (a real API
  // would do this itself); the in-browser mock always cascades.
  delete(boardId: string): Observable<void> {
    return this.http
      .delete<void>(`${this.url}/${encodeURIComponent(boardId)}`, {
        params: { _dependent: 'tasks' },
      })
      .pipe(tap(() => this.ids.update((ids) => ids.filter((id) => id !== boardId))));
  }
}
