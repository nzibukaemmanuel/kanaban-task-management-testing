import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { Store } from '@ngrx/store';
import { AuthService } from './core/auth.service';
import { ThemeService } from './core/theme.service';
import { TaskActions } from './features/board/store/task.actions';
import { BoardService } from './features/board/board.service';
import { Notice } from './shared/notice/notice';

@Component({
  imports: [RouterLink, RouterLinkActive, RouterOutlet, Notice],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  private readonly router = inject(Router);
  private readonly store = inject(Store);
  private readonly boardService = inject(BoardService);
  protected readonly auth = inject(AuthService);
  // Injected eagerly here (rather than only where a component happens to need it) so the
  // theme is applied to <html> as early in bootstrap as possible, minimizing any flash of
  // the wrong theme on load.
  protected readonly themeService = inject(ThemeService);

  protected readonly isNavigating = signal(false);
  protected readonly navigationError = signal<string | null>(null);

  constructor() {
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => this.onRouterEvent(event));
    // Kick off the two initial fetches once, at the root. Both results are cached (boards in
    // BoardService's signal, tasks in the NgRx store), so every page below just reads them —
    // navigating between boards never re-requests data that's already here.
    this.boardService.load();
    this.store.dispatch(TaskActions.loadTasks());
  }

  protected onRouterEvent(event: unknown): void {
    if (event instanceof NavigationStart) {
      // Route change requested — start of the navigation lifecycle.
      this.isNavigating.set(true);
      this.navigationError.set(null);
    } else if (event instanceof NavigationEnd || event instanceof NavigationCancel) {
      // Completed (NavigationEnd) or aborted, e.g. by a guard (NavigationCancel).
      this.isNavigating.set(false);
    } else if (event instanceof NavigationError) {
      // A guard/resolver/lazy-chunk load threw — surface it instead of leaving the UI stuck loading.
      this.isNavigating.set(false);
      this.navigationError.set('Something went wrong while loading that page.');
    }
  }

  protected dismissError(): void {
    this.navigationError.set(null);
  }

  protected logout(): void {
    this.auth.logout();
    this.router.navigate(['/boards']);
  }
}
