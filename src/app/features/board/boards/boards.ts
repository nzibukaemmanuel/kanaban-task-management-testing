import { Component, computed, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable, map } from 'rxjs';
import { describeHttpError } from '../../../core/api/api-error';
import { AuthService } from '../../../core/auth.service';
import { NotificationService } from '../../../core/notification.service';
import { DataState } from '../../../shared/data-state/data-state';
import { SelectField, SelectFieldOption } from '../../../shared/select-field/select-field';
import { BoardDataStatus } from '../board-data-status';
import { toBoardId } from '../board-id';
import { BoardSidebar } from '../board-sidebar/board-sidebar';
import { BoardService } from '../board.service';
import { selectTasksByBoard } from '../store/task.selectors';

@Component({
  imports: [AsyncPipe, ReactiveFormsModule, RouterLink, SelectField, BoardSidebar, DataState],
  selector: 'app-boards',
  styleUrl: './boards.css',
  templateUrl: './boards.html',
})
export class Boards {
  private readonly router = inject(Router);
  private readonly boardService = inject(BoardService);
  private readonly store = inject(Store);
  private readonly fb = inject(FormBuilder);
  private readonly notificationService = inject(NotificationService);
  protected readonly dataStatus = inject(BoardDataStatus);
  protected readonly auth = inject(AuthService);

  readonly boardIds = this.boardService.boardIds;

  readonly boardOptions = computed<SelectFieldOption[]>(() => [
    { value: '', label: 'Choose a board…' },
    ...this.boardIds().map((boardId) => ({ value: boardId, label: boardId })),
  ]);

  // Creating a board is a write, so like every other write it is login-gated (the board pages
  // behind it already are); the list itself stays public.
  readonly creating = signal(false);
  readonly newBoardForm = this.fb.nonNullable.group({
    name: [
      '',
      [
        Validators.required,
        Validators.maxLength(40),
        (control: AbstractControl) => this.validateName(control),
      ],
    ],
  });

  jumpToBoard(boardId: string): void {
    if (!boardId) {
      return;
    }
    void this.router.navigate(['/boards', boardId]);
  }

  createBoard(): void {
    const { name } = this.newBoardForm.controls;
    if (this.newBoardForm.invalid || this.creating()) {
      name.markAsTouched();
      return;
    }
    const boardId = toBoardId(name.value);
    this.creating.set(true);
    this.boardService.create(boardId).subscribe({
      next: () => {
        this.creating.set(false);
        this.newBoardForm.reset();
        this.notificationService.success(`Board "${boardId}" was created.`);
      },
      error: (error: unknown) => {
        this.creating.set(false);
        this.notificationService.error(describeHttpError(error, 'create the board'));
      },
    });
  }

  // Streamed from the NgRx task store via the async pipe, so a task added/removed on a board's
  // detail page is reflected here the moment you navigate back — no local copy of the count, no
  // manual refresh. Each board's Observable is created once and memoized (rather than rebuilt in
  // a template method call) so the async pipe doesn't resubscribe on every change-detection run.
  private readonly taskCounts = new Map<string, Observable<number>>();

  taskCount$(boardId: string): Observable<number> {
    let count$ = this.taskCounts.get(boardId);
    if (!count$) {
      count$ = this.store.select(selectTasksByBoard(boardId)).pipe(map((tasks) => tasks.length));
      this.taskCounts.set(boardId, count$);
    }
    return count$;
  }

  // The id the board would get is what has to be valid and free, not the raw text typed.
  private validateName(control: AbstractControl<string>): ValidationErrors | null {
    const value = control.value ?? '';
    if (value.trim() === '') {
      return null;
    }
    const boardId = toBoardId(value);
    if (boardId === '') {
      return { unusableName: true };
    }
    return this.boardService.boardExists(boardId) ? { duplicateBoard: true } : null;
  }
}
