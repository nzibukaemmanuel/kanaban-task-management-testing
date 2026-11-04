import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NotificationService } from '../../../core/notification.service';
import { TaskForm } from './task-form';

describe('TaskForm', () => {
  let fixture: ComponentFixture<TaskForm>;
  let component: TaskForm;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaskForm],
    }).compileComponents();

    fixture = TestBed.createComponent(TaskForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function titleInput(): HTMLInputElement {
    return fixture.nativeElement.querySelector('input[type="text"]');
  }

  function descriptionInput(): HTMLTextAreaElement {
    return fixture.nativeElement.querySelector('textarea');
  }

  function dueDateInput(): HTMLInputElement {
    return fixture.nativeElement.querySelector('input[type="date"]');
  }

  function statusTrigger(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.select-trigger');
  }

  function setTitle(value: string): void {
    titleInput().value = value;
    titleInput().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function touchTitle(): void {
    titleInput().dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  }

  // Options render in STATUS_OPTIONS order: 0 = placeholder, 1 = todo, 2 = doing, 3 = done.
  function pickStatus(optionIndex: number): void {
    statusTrigger().click();
    fixture.detectChanges();
    const option = fixture.nativeElement.querySelectorAll('.select-option')[optionIndex] as HTMLLIElement;
    option.click();
    fixture.detectChanges();
  }

  function submitForm(): void {
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  function subtaskRows(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.subtask-row'));
  }

  function subtaskTitleInputs(): HTMLInputElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.subtask-row input[type="text"]'));
  }

  function subtaskCheckboxes(): HTMLInputElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.subtask-row input[type="checkbox"]'));
  }

  function addSubtaskButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.subtasks > button');
  }

  function removeSubtaskButton(index: number): HTMLButtonElement {
    return subtaskRows()[index].querySelector('button') as HTMLButtonElement;
  }

  async function clickAddSubtask(): Promise<void> {
    addSubtaskButton().click();
    fixture.detectChanges();
    await fixture.whenStable(); // flushes the afterNextRender() that focuses the new row
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('visibly marks the required fields and explains what the marker means', () => {
    expect(fixture.nativeElement.textContent).toContain('are required');
    expect(fixture.nativeElement.querySelectorAll('.required-indicator').length).toBe(2); // title + status
  });

  it('starts blank and pristine, with status unselected, when no initial task is given', () => {
    expect(titleInput().value).toBe('');
    expect(descriptionInput().value).toBe('');
    expect(dueDateInput().value).toBe('');
    expect(statusTrigger().textContent).toContain('Choose a status');
    expect(component.isDirty()).toBe(false);
  });

  it('prefills every field, including status, from the initial task and stays pristine', () => {
    fixture.componentRef.setInput('initialTask', {
      id: 't1',
      title: 'Write docs',
      description: 'Cover the API changes.',
      status: 'doing',
      dueDate: '2026-09-05',
    });
    fixture.detectChanges();

    expect(titleInput().value).toBe('Write docs');
    expect(descriptionInput().value).toBe('Cover the API changes.');
    expect(dueDateInput().value).toBe('2026-09-05');
    expect(statusTrigger().textContent).toContain('In progress');
    expect(component.isDirty()).toBe(false);
  });

  it('re-syncs to a different task when initialTask changes on the same (reused) instance', () => {
    // The router reuses this component across param changes — e.g. navigating straight from
    // editing task A to editing task B on the same board — so a stale read here would leak
    // task A's data into task B's form instead of loading task B's own details.
    fixture.componentRef.setInput('initialTask', {
      id: 'a',
      title: 'Task A',
      description: 'Description A',
      status: 'todo',
      dueDate: '2026-09-01',
    });
    fixture.detectChanges();

    fixture.componentRef.setInput('initialTask', {
      id: 'b',
      title: 'Task B',
      description: 'Description B',
      status: 'done',
      dueDate: '2026-09-20',
    });
    fixture.detectChanges();

    expect(titleInput().value).toBe('Task B');
    expect(descriptionInput().value).toBe('Description B');
    expect(dueDateInput().value).toBe('2026-09-20');
    expect(statusTrigger().textContent).toContain('Done');
    expect(component.isDirty()).toBe(false);
  });

  it('becomes dirty once the title is edited', () => {
    setTitle('New title');
    expect(component.isDirty()).toBe(true);
  });

  it('becomes dirty once a status is picked', () => {
    pickStatus(1); // todo
    expect(component.isDirty()).toBe(true);
  });

  it('rejects submission with an empty title and an unselected status', () => {
    const emitted: unknown[] = [];
    component.save.subscribe((value) => emitted.push(value));

    submitForm();

    expect(emitted).toEqual([]);
    const errors = Array.from(fixture.nativeElement.querySelectorAll('.field-error')).map(
      (el) => (el as HTMLElement).textContent,
    );
    expect(errors.some((text) => text?.includes('Title is required'))).toBe(true);
    expect(errors.some((text) => text?.includes('Status is required'))).toBe(true);
  });

  it('shows an error notice when submitting an invalid form', () => {
    const notificationService = TestBed.inject(NotificationService);

    submitForm();

    expect(notificationService.notice()?.kind).toBe('error');
  });

  it('rejects a title shorter than 3 characters', () => {
    setTitle('ab');
    touchTitle();

    expect(fixture.nativeElement.querySelector('.field-error')?.textContent).toContain('3 characters');
  });

  it('has no aria-invalid/aria-describedby on the title until it is touched and invalid', () => {
    expect(titleInput().hasAttribute('aria-invalid')).toBe(false);
    expect(titleInput().hasAttribute('aria-describedby')).toBe(false);
  });

  it('marks the title aria-invalid and points aria-describedby at its error message once touched', () => {
    touchTitle(); // empty title, touched -> invalid

    const errorId = fixture.nativeElement.querySelector('.field-error')?.id;
    expect(titleInput().getAttribute('aria-invalid')).toBe('true');
    expect(titleInput().getAttribute('aria-describedby')).toBe(errorId);
    expect(errorId).toBeTruthy();
  });

  it('marks the status trigger aria-invalid and points aria-describedby at its error message once touched', () => {
    submitForm(); // markAllAsTouched() touches every control, including status

    const statusError = Array.from(fixture.nativeElement.querySelectorAll('.field-error')).find((el) =>
      (el as HTMLElement).textContent?.includes('Status is required'),
    ) as HTMLElement;
    expect(statusTrigger().getAttribute('aria-invalid')).toBe('true');
    expect(statusTrigger().getAttribute('aria-describedby')).toBe(statusError.id);
  });

  it('moves focus to the title input when only the title is invalid', () => {
    pickStatus(1); // valid status, so title is the only problem

    submitForm();

    expect(document.activeElement).toBe(titleInput());
  });

  it('moves focus to the status field when only the status is invalid', () => {
    setTitle('Valid title');

    submitForm();

    expect(document.activeElement).toBe(statusTrigger());
  });

  it('rejects a description over 500 characters', () => {
    descriptionInput().value = 'x'.repeat(501);
    descriptionInput().dispatchEvent(new Event('input'));
    descriptionInput().dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.field-error')?.textContent).toContain('500 characters');
  });

  it('flags a title that already exists on the board, then clears the error once it is changed', () => {
    fixture.componentRef.setInput('existingTitles', ['Design review', 'Write launch docs']);
    fixture.detectChanges();

    setTitle('Design review');
    touchTitle();
    expect(fixture.nativeElement.querySelector('.field-error')?.textContent).toContain('already exists');

    setTitle('Design review v2');
    expect(fixture.nativeElement.querySelector('.field-error')).toBeNull();
  });

  it('is case-insensitive and trims whitespace when checking for a duplicate title', () => {
    fixture.componentRef.setInput('existingTitles', ['Design review']);
    fixture.detectChanges();

    setTitle('  design REVIEW  ');
    touchTitle();

    expect(fixture.nativeElement.querySelector('.field-error')?.textContent).toContain('already exists');
  });

  it('emits the trimmed title, description, status and due date on valid submit', () => {
    const emitted: unknown[] = [];
    component.save.subscribe((value) => emitted.push(value));

    setTitle('  Ship it  ');
    descriptionInput().value = '  Finish and deploy.  ';
    descriptionInput().dispatchEvent(new Event('input'));
    dueDateInput().value = '2026-09-01';
    dueDateInput().dispatchEvent(new Event('input'));
    pickStatus(1); // todo
    fixture.detectChanges();

    submitForm();

    expect(emitted).toEqual([
      { title: 'Ship it', description: 'Finish and deploy.', status: 'todo', dueDate: '2026-09-01', subtasks: [] },
    ]);
  });

  it('emits cancel when the cancel button is clicked', () => {
    const emitted: unknown[] = [];
    component.cancel.subscribe(() => emitted.push(true));

    (fixture.nativeElement.querySelector('.task-form__actions button[type="button"]') as HTMLButtonElement).click();

    expect(emitted).toEqual([true]);
  });

  describe('subtasks', () => {
    it('starts with no subtasks, shown as an empty state', () => {
      expect(subtaskRows().length).toBe(0);
      expect(fixture.nativeElement.querySelector('.subtasks .empty-state')).toBeTruthy();
    });

    it('adds a blank subtask row, focuses its name field, and marks the form dirty', async () => {
      await clickAddSubtask();

      expect(subtaskRows().length).toBe(1);
      expect(document.activeElement).toBe(subtaskTitleInputs()[0]);
      expect(component.isDirty()).toBe(true);
    });

    it('removes a subtask row and returns focus to the add-subtask button', async () => {
      await clickAddSubtask();
      await clickAddSubtask();
      expect(subtaskRows().length).toBe(2);

      removeSubtaskButton(0).click();
      fixture.detectChanges();

      expect(subtaskRows().length).toBe(1);
      expect(document.activeElement).toBe(addSubtaskButton());
    });

    it('rejects a blank subtask name', async () => {
      await clickAddSubtask();

      submitForm();

      const errors = Array.from(fixture.nativeElement.querySelectorAll('.field-error')).map(
        (el) => (el as HTMLElement).textContent,
      );
      expect(errors.some((text) => text?.includes('Subtask name is required'))).toBe(true);
    });

    it('moves focus to the invalid subtask when every other field is valid', async () => {
      setTitle('Valid title');
      pickStatus(1); // todo
      await clickAddSubtask();

      submitForm();

      expect(document.activeElement).toBe(subtaskTitleInputs()[0]);
    });

    it('emits subtasks, with trimmed names, alongside the rest of the form on valid submit', async () => {
      setTitle('Valid title');
      pickStatus(1); // todo
      await clickAddSubtask();
      subtaskTitleInputs()[0].value = '  Write tests  ';
      subtaskTitleInputs()[0].dispatchEvent(new Event('input'));
      subtaskCheckboxes()[0].click();
      fixture.detectChanges();

      const emitted: unknown[] = [];
      component.save.subscribe((value) => emitted.push(value));

      submitForm();

      expect(emitted).toEqual([
        {
          title: 'Valid title',
          description: '',
          status: 'todo',
          dueDate: '',
          subtasks: [{ id: expect.any(String), title: 'Write tests', completed: true }],
        },
      ]);
    });

    it('prefills existing subtasks from the initial task and stays pristine', () => {
      fixture.componentRef.setInput('initialTask', {
        id: 't1',
        title: 'Write docs',
        description: '',
        status: 'doing',
        dueDate: '',
        subtasks: [
          { id: 's1', title: 'Draft outline', completed: true },
          { id: 's2', title: 'Get review', completed: false },
        ],
      });
      fixture.detectChanges();

      expect(subtaskTitleInputs().map((el) => el.value)).toEqual(['Draft outline', 'Get review']);
      expect(subtaskCheckboxes().map((el) => el.checked)).toEqual([true, false]);
      expect(component.isDirty()).toBe(false);
    });

    it('re-syncs subtasks too when initialTask switches to a different task', () => {
      fixture.componentRef.setInput('initialTask', {
        id: 'a',
        title: 'Task A',
        description: '',
        status: 'todo',
        dueDate: '',
        subtasks: [{ id: 'a1', title: 'A subtask', completed: false }],
      });
      fixture.detectChanges();
      expect(subtaskRows().length).toBe(1);

      fixture.componentRef.setInput('initialTask', {
        id: 'b',
        title: 'Task B',
        description: '',
        status: 'done',
        dueDate: '',
        subtasks: [],
      });
      fixture.detectChanges();

      expect(subtaskRows().length).toBe(0);
      expect(component.isDirty()).toBe(false);
    });
  });

  describe('beforeunload — the browser-level backstop for canDeactivate', () => {
    function fireBeforeUnload(): Event {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event;
    }

    it('does not warn on tab close/refresh when the form is pristine', () => {
      const event = fireBeforeUnload();

      expect(event.defaultPrevented).toBe(false);
    });

    it('warns on tab close/refresh when the form has unsaved changes', () => {
      setTitle('New title');

      const event = fireBeforeUnload();

      expect(event.defaultPrevented).toBe(true);
    });
  });
});
