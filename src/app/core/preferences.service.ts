import { Injectable, effect, signal } from '@angular/core';

const CONFIRM_BEFORE_DELETE_KEY = 'kanban-confirm-before-delete';
const DEFAULT_BOARD_KEY = 'kanban-default-board';

// Small persisted preferences that don't (yet) own enough behavior to justify a dedicated
// service of their own, unlike theme/notifications.
@Injectable({ providedIn: 'root' })
export class PreferencesService {
  private readonly confirmBeforeDeleteState = signal(this.resolveConfirmBeforeDelete());
  readonly confirmBeforeDelete = this.confirmBeforeDeleteState.asReadonly();

  private readonly defaultBoardIdState = signal(localStorage.getItem(DEFAULT_BOARD_KEY) ?? '');
  readonly defaultBoardId = this.defaultBoardIdState.asReadonly();

  constructor() {
    effect(() => localStorage.setItem(CONFIRM_BEFORE_DELETE_KEY, String(this.confirmBeforeDeleteState())));
    effect(() => localStorage.setItem(DEFAULT_BOARD_KEY, this.defaultBoardIdState()));
  }

  setConfirmBeforeDelete(value: boolean): void {
    this.confirmBeforeDeleteState.set(value);
  }

  setDefaultBoardId(boardId: string): void {
    this.defaultBoardIdState.set(boardId);
  }

  // Defaults to true (the safer choice) so a first-time visitor is protected without having
  // to visit Settings first.
  private resolveConfirmBeforeDelete(): boolean {
    const stored = localStorage.getItem(CONFIRM_BEFORE_DELETE_KEY);
    return stored === null ? true : stored === 'true';
  }
}
