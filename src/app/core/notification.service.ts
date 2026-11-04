import { Injectable, effect, signal } from '@angular/core';

export interface Notice {
  readonly message: string;
  readonly kind: 'success' | 'error';
}

const SUCCESS_AUTO_DISMISS_MS = 4000;
const PERSIST_SUCCESS_KEY = 'kanban-persist-success-notices';

// App-wide "here's the outcome of what you just did" banner, backed by a single signal so any
// component can post one (task saved, save failed, ...) without owning display state itself.
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly current = signal<Notice | null>(null);
  readonly notice = this.current.asReadonly();

  // User-configurable via Settings: some prefer success notices to stay put until dismissed,
  // same as errors, rather than auto-clearing.
  private readonly persistSuccessState = signal(localStorage.getItem(PERSIST_SUCCESS_KEY) === 'true');
  readonly persistSuccess = this.persistSuccessState.asReadonly();

  private dismissTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    effect(() => localStorage.setItem(PERSIST_SUCCESS_KEY, String(this.persistSuccessState())));
  }

  setPersistSuccess(value: boolean): void {
    this.persistSuccessState.set(value);
  }

  // Success notices self-clear by default; errors always stay until the user dismisses them,
  // since missing one could mean losing track of data that didn't actually save.
  success(message: string): void {
    this.show({ message, kind: 'success' }, this.persistSuccessState() ? null : SUCCESS_AUTO_DISMISS_MS);
  }

  error(message: string): void {
    this.show({ message, kind: 'error' }, null);
  }

  dismiss(): void {
    clearTimeout(this.dismissTimer);
    this.current.set(null);
  }

  private show(notice: Notice, autoDismissMs: number | null): void {
    clearTimeout(this.dismissTimer);
    this.current.set(notice);
    if (autoDismissMs !== null) {
      this.dismissTimer = setTimeout(() => this.current.set(null), autoDismissMs);
    }
  }
}
