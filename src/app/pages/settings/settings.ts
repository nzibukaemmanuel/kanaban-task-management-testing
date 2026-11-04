import { Component, computed, effect, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BoardService } from '../../features/board/board.service';
import { ComponentWithUnsavedChanges } from '../../core/unsaved-changes.guard';
import { NotificationService } from '../../core/notification.service';
import { PreferencesService } from '../../core/preferences.service';
import { ThemeService } from '../../core/theme.service';
import { SelectField, SelectFieldOption } from '../../shared/select-field/select-field';

@Component({
  imports: [ReactiveFormsModule, SelectField],
  selector: 'app-settings',
  styleUrl: './settings.css',
  templateUrl: './settings.html',
})
export class Settings implements ComponentWithUnsavedChanges {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly themeService = inject(ThemeService);
  private readonly preferencesService = inject(PreferencesService);
  private readonly notificationService = inject(NotificationService);
  private readonly boardService = inject(BoardService);

  protected readonly boardOptions = computed<SelectFieldOption[]>(() => [
    { value: '', label: 'None — go to Settings after login' },
    ...this.boardService.boardIds().map((boardId) => ({ value: boardId, label: boardId })),
  ]);

  readonly form = this.fb.nonNullable.group({
    displayName: 'NZIBUKA',
    theme: this.themeService.theme(),
    confirmBeforeDelete: this.preferencesService.confirmBeforeDelete(),
    persistSuccessNotices: this.notificationService.persistSuccess(),
    defaultBoardId: this.preferencesService.defaultBoardId(),
  });

  constructor() {
    // Keeps the form in sync when the underlying service state changes elsewhere (e.g. the
    // header's theme toggle) while Settings is open and the user hasn't touched that field yet.
    effect(() => {
      const theme = this.themeService.theme();
      if (!this.form.controls.theme.dirty) {
        this.form.controls.theme.setValue(theme, { emitEvent: false });
      }
    });
    effect(() => {
      const confirmBeforeDelete = this.preferencesService.confirmBeforeDelete();
      if (!this.form.controls.confirmBeforeDelete.dirty) {
        this.form.controls.confirmBeforeDelete.setValue(confirmBeforeDelete, { emitEvent: false });
      }
    });
    effect(() => {
      const persistSuccessNotices = this.notificationService.persistSuccess();
      if (!this.form.controls.persistSuccessNotices.dirty) {
        this.form.controls.persistSuccessNotices.setValue(persistSuccessNotices, {
          emitEvent: false,
        });
      }
    });
    effect(() => {
      const defaultBoardId = this.preferencesService.defaultBoardId();
      if (!this.form.controls.defaultBoardId.dirty) {
        this.form.controls.defaultBoardId.setValue(defaultBoardId, { emitEvent: false });
      }
    });
  }

  setDefaultBoardId(value: string): void {
    this.form.controls.defaultBoardId.setValue(value);
    this.form.controls.defaultBoardId.markAsDirty();
  }

  hasUnsavedChanges(): boolean {
    return this.form.dirty;
  }

  save(): void {
    const { theme, confirmBeforeDelete, persistSuccessNotices, defaultBoardId } =
      this.form.getRawValue();
    this.themeService.setTheme(theme);
    this.preferencesService.setConfirmBeforeDelete(confirmBeforeDelete);
    this.preferencesService.setDefaultBoardId(defaultBoardId);
    // Applied before the confirmation notice so the notice itself reflects the new preference.
    this.notificationService.setPersistSuccess(persistSuccessNotices);
    this.form.markAsPristine();
    this.notificationService.success('Settings saved.');
    this.router.navigate(['/boards']);
  }
}
