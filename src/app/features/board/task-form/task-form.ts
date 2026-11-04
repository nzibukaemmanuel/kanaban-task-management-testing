import {
  Component,
  ElementRef,
  HostListener,
  Injector,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NotificationService } from '../../../core/notification.service';
import { SelectField, SelectFieldOption } from '../../../shared/select-field/select-field';
import { Subtask, Task } from '../board-data';
import { duplicateTitleValidator } from './duplicate-title.validator';

export interface TaskFormValue {
  title: string;
  description: string;
  status: Task['status'];
  dueDate: string;
  subtasks: Subtask[];
}

const STATUS_OPTIONS: SelectFieldOption[] = [
  { value: '', label: 'Choose a status…' },
  { value: 'todo', label: 'To do' },
  { value: 'doing', label: 'In progress' },
  { value: 'done', label: 'Done' },
];

let nextFormInstanceId = 0;
let nextSubtaskSuffix = 0;

type SubtaskGroup = FormGroup<{
  id: FormControl<string>;
  title: FormControl<string>;
  completed: FormControl<boolean>;
}>;

// Presentational and reused by both the Add Task and Edit Task routes: it only knows how to
// render/validate a task's fields and emit the result — persistence and navigation stay with
// whichever page component hosts it.
@Component({
  selector: 'app-task-form',
  imports: [ReactiveFormsModule, SelectField],
  templateUrl: './task-form.html',
  styleUrl: './task-form.css',
})
export class TaskForm {
  private readonly fb = inject(FormBuilder);
  private readonly notificationService = inject(NotificationService);
  private readonly injector = inject(Injector);
  private readonly instanceId = `task-form-${nextFormInstanceId++}`;

  readonly initialTask = input<Task | null>(null);
  readonly submitLabel = input('Save task');
  // Sibling task titles on the same board (excluding this task itself, when editing) — feeds
  // the duplicate-title check below.
  readonly existingTitles = input<string[]>([]);
  // True while the host's save request is in flight: disables the submit button so a double
  // click can't post the same task twice.
  readonly saving = input(false);

  readonly save = output<TaskFormValue>();
  readonly cancel = output<void>();

  protected readonly statusOptions = STATUS_OPTIONS;
  // SelectField isn't a ControlValueAccessor, so its display value is driven by this signal
  // rather than formControlName; the "status" control below mirrors it purely so
  // Validators.required can participate in the form's overall validity/error display.
  protected readonly status = signal('');

  // Ids for aria-describedby/aria-labelledby — unique per instance so two forms on a page
  // (unlikely here, but a shared component shouldn't assume it's the only one) never collide.
  protected readonly statusLabelId = `${this.instanceId}-status-label`;
  protected readonly titleErrorId = `${this.instanceId}-title-error`;
  protected readonly descriptionErrorId = `${this.instanceId}-description-error`;
  protected readonly statusErrorId = `${this.instanceId}-status-error`;

  private readonly titleInputRef = viewChild<ElementRef<HTMLInputElement>>('titleInput');
  private readonly descriptionInputRef =
    viewChild<ElementRef<HTMLTextAreaElement>>('descriptionInput');
  private readonly dueDateInputRef = viewChild<ElementRef<HTMLInputElement>>('dueDateInput');
  private readonly statusField = viewChild(SelectField);
  private readonly addSubtaskButtonRef =
    viewChild<ElementRef<HTMLButtonElement>>('addSubtaskButton');
  private readonly subtaskTitleInputs =
    viewChildren<ElementRef<HTMLInputElement>>('subtaskTitleInput');

  protected readonly form = this.fb.nonNullable.group({
    title: [
      '',
      [
        Validators.required,
        Validators.minLength(3),
        duplicateTitleValidator(() => this.existingTitles()),
      ],
    ],
    description: ['', [Validators.maxLength(500)]],
    status: ['', [Validators.required]],
    dueDate: [''],
    subtasks: this.fb.array<SubtaskGroup>([]),
  });

  constructor() {
    // Re-syncs whenever `initialTask` changes, not just once on init: the router reuses this
    // component instance across param changes (e.g. editing task A, then navigating straight to
    // editing task B on the same board), so a one-time read would leave stale form values.
    effect(() => {
      const task = this.initialTask();
      this.form.patchValue({
        title: task?.title ?? '',
        description: task?.description ?? '',
        status: task?.status ?? '',
        dueDate: task?.dueDate ?? '',
      });
      this.resetSubtasks(task?.subtasks ?? []);
      this.form.markAsPristine();
      this.status.set(task?.status ?? '');
    });

    // Revalidates the title in isolation when the sibling-title list changes, without touching
    // the rest of the form (a plain form.setValue here would wipe in-progress edits).
    effect(() => {
      this.existingTitles();
      this.form.controls.title.updateValueAndValidity({ emitEvent: false });
    });
  }

  // Covers the case canDeactivate can't: closing the tab, hard-refreshing, or typing a new URL
  // bypasses the Angular router entirely, so the guard never runs. This is the browser-level
  // backstop for the same "you'll lose your edits" warning.
  @HostListener('window:beforeunload', ['$event'])
  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.isDirty()) {
      event.preventDefault();
      event.returnValue = true;
    }
  }

  isDirty(): boolean {
    return this.form.dirty;
  }

  protected setStatus(value: string): void {
    this.status.set(value);
    this.form.controls.status.setValue(value);
    // setValue() alone doesn't mark a control dirty — that only happens automatically for
    // UI-driven changes via formControlName. Since this update comes from a programmatic call
    // (SelectField isn't a ControlValueAccessor), the dirty/touched flags need setting by hand.
    this.form.controls.status.markAsDirty();
    this.form.controls.status.markAsTouched();
  }

  protected subtaskErrorId(index: number): string {
    return `${this.instanceId}-subtask-${index}-error`;
  }

  protected addSubtask(): void {
    this.form.controls.subtasks.push(this.createSubtaskGroup());
    // push() only updates the array's value — like setStatus() above, a programmatic structural
    // change doesn't go through the UI-driven path that marks a control dirty automatically.
    this.form.controls.subtasks.markAsDirty();

    // The new row doesn't exist in the DOM yet at this point in the click handler; focus it once
    // the next render has actually created it, so the user can start typing immediately.
    afterNextRender(
      () => {
        const inputs = this.subtaskTitleInputs();
        inputs[inputs.length - 1]?.nativeElement.focus();
      },
      { injector: this.injector },
    );
  }

  protected removeSubtask(index: number): void {
    this.form.controls.subtasks.removeAt(index);
    this.form.controls.subtasks.markAsDirty();
    // The removed row's own "Remove" button — wherever focus was — no longer exists; without
    // this, focus would silently drop to <body>, disorienting keyboard/screen-reader users.
    this.addSubtaskButtonRef()?.nativeElement.focus();
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notificationService.error('Please fix the highlighted fields before saving.');
      this.focusFirstInvalidField();
      return;
    }
    const { title, description, status, dueDate, subtasks } = this.form.getRawValue();
    this.save.emit({
      title: title.trim(),
      description: description.trim(),
      status: status as Task['status'],
      dueDate,
      subtasks: subtasks.map((subtask) => ({ ...subtask, title: subtask.title.trim() })),
    });
    // Deliberately not marked pristine here: the save may still fail on the server, and a form
    // that looks saved would let the unsaved-changes guard wave the user away from their edits.
    // The host calls markSaved() once the server confirms.
  }

  markSaved(): void {
    this.form.markAsPristine();
  }

  private createSubtaskGroup(subtask?: Subtask): SubtaskGroup {
    return this.fb.nonNullable.group({
      id: this.fb.nonNullable.control(subtask?.id ?? `subtask-${nextSubtaskSuffix++}`),
      title: this.fb.nonNullable.control(subtask?.title ?? '', [Validators.required]),
      completed: this.fb.nonNullable.control(subtask?.completed ?? false),
    });
  }

  private resetSubtasks(subtasks: Subtask[]): void {
    const array = this.form.controls.subtasks;
    array.clear({ emitEvent: false });
    for (const subtask of subtasks) {
      array.push(this.createSubtaskGroup(subtask), { emitEvent: false });
    }
  }

  // Moves focus to the first invalid field, in visual top-to-bottom order, so keyboard and
  // screen-reader users land directly on the problem instead of having to hunt for it.
  private focusFirstInvalidField(): void {
    if (this.form.controls.title.invalid) {
      this.titleInputRef()?.nativeElement.focus();
      return;
    }
    if (this.form.controls.status.invalid) {
      this.statusField()?.focus();
      return;
    }
    if (this.form.controls.description.invalid) {
      this.descriptionInputRef()?.nativeElement.focus();
      return;
    }
    if (this.form.controls.dueDate.invalid) {
      this.dueDateInputRef()?.nativeElement.focus();
      return;
    }
    const invalidIndex = this.form.controls.subtasks.controls.findIndex((group) => group.invalid);
    if (invalidIndex !== -1) {
      this.subtaskTitleInputs()[invalidIndex]?.nativeElement.focus();
    }
  }
}
